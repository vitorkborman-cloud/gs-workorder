"use client";

import { useEffect, useRef, useState } from "react";
import proj4 from "proj4";
import "leaflet/dist/leaflet.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";

// Alternativa gratuita ao GPS do celular: o técnico clica no ponto exato
// direto sobre imagem de satélite (Esri World Imagery, sem chave/custo),
// em vez de depender do chip GPS do aparelho — que tem erro de 2-3m e
// costuma inverter a posição de poços muito próximos entre si. A conversão
// lat/lng → UTM usa a mesma lógica (proj4) já usada na captura por GPS do
// app mobile, então o resultado cai nos mesmos campos (coord_x/coord_y/utm_zona).

const DEFAULT_CENTER: [number, number] = [-15.78, -47.93]; // Brasil (Brasília), fallback sem coordenada prévia
const DEFAULT_ZOOM = 4;
const PICKED_ZOOM = 19;
const GPS_CENTER_ZOOM = 18; // perto o suficiente pra já mostrar o entorno, mas sem assumir que o GPS acertou o ponto exato

function forwardToUtm(lat: number, lon: number) {
  const zoneNum = Math.floor((lon + 180) / 6) + 1;
  const isSouth = lat < 0;
  const [easting, northing] = proj4(
    "+proj=longlat +datum=WGS84 +no_defs",
    `+proj=utm +zone=${zoneNum} ${isSouth ? "+south" : ""} +datum=WGS84 +units=m +no_defs`,
    [lon, lat]
  );
  return { easting, northing, zona: `${zoneNum}${isSouth ? "S" : "N"}` };
}

function utmToLatLng(coordX: string, coordY: string, utmZona: string): [number, number] | null {
  const x = parseFloat(coordX), y = parseFloat(coordY);
  const zoneNum = parseInt(utmZona, 10);
  if (isNaN(x) || isNaN(y) || isNaN(zoneNum)) return null;
  const isSouth = /s/i.test(utmZona);
  const [lon, lat] = proj4(
    `+proj=utm +zone=${zoneNum} ${isSouth ? "+south" : ""} +datum=WGS84 +units=m +no_defs`,
    "+proj=longlat +datum=WGS84 +no_defs",
    [x, y]
  );
  return [lat, lon];
}

type SearchResult = { display_name: string; lat: string; lon: string };

export function CoordinatePickerModal({
  open,
  onOpenChange,
  initial,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: { coordX?: string; coordY?: string; utmZona?: string };
  onConfirm: (result: { coordX: string; coordY: string; utmZona: string }) => void;
}) {
  // Container do mapa como state (não useRef): o conteúdo do Dialog (Radix)
  // só é inserido no DOM depois do commit inicial, então um useEffect com
  // useRef rodava antes do <div> existir de fato (mapRef.current ficava
  // null na primeira execução, e nada disparava de novo depois). Com o
  // elemento em state, o efeito abaixo re-roda assim que ele aparece.
  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);
  const [utmPreview, setUtmPreview] = useState<{ easting: number; northing: number; zona: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open || !mapEl || mapInstanceRef.current) return;

    let cancelled = false;
    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled) return;

      const initialLatLng = initial?.coordX && initial?.coordY && initial?.utmZona
        ? utmToLatLng(initial.coordX, initial.coordY, initial.utmZona)
        : null;

      const map = L.map(mapEl, {
        center: initialLatLng || DEFAULT_CENTER,
        zoom: initialLatLng ? PICKED_ZOOM : DEFAULT_ZOOM,
      });
      mapInstanceRef.current = map;

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri",
        maxZoom: 19,
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: "",
        html: `<svg width="30" height="40" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="#391e2a" stroke="#80b02d" stroke-width="2"/>
          <circle cx="16" cy="16" r="6" fill="#fff"/>
        </svg>`,
        iconSize: [30, 40],
        iconAnchor: [15, 40],
      });

      function placeMarker(lat: number, lon: number) {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lon]);
        } else {
          markerRef.current = L.marker([lat, lon], { icon: pinIcon, draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const pos = markerRef.current.getLatLng();
            setPicked({ lat: pos.lat, lon: pos.lng });
            setUtmPreview(forwardToUtm(pos.lat, pos.lng));
          });
        }
        setPicked({ lat, lon });
        setUtmPreview(forwardToUtm(lat, lon));
      }

      if (initialLatLng) {
        placeMarker(initialLatLng[0], initialLatLng[1]);
      } else if (navigator.geolocation) {
        // Sem coordenada salva ainda: centraliza no GPS aproximado do
        // dispositivo só pra abrir a área certa (evita começar do zero,
        // navegando o Brasil inteiro) — o ponto final continua sendo o
        // clique manual sobre a imagem de satélite, não o GPS.
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            map.setView([pos.coords.latitude, pos.coords.longitude], GPS_CENTER_ZOOM);
            setLocating(false);
          },
          () => { if (!cancelled) setLocating(false); },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      }

      map.on("click", (e: any) => placeMarker(e.latlng.lat, e.latlng.lng));
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mapEl]);

  // Destrói o mapa quando o modal fecha, pra poder reabrir do zero na próxima vez
  // (Leaflet não gosta de reaproveitar o mesmo container/elemento DOM).
  useEffect(() => {
    if (!open && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      setMapEl(null);
      setPicked(null);
      setUtmPreview(null);
      setSearchQuery("");
      setSearchResults([]);
      setLocating(false);
    }
  }, [open]);

  async function buscarEndereco() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(searchQuery)}`
      );
      const results = await resp.json();
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function irParaResultado(r: SearchResult) {
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    mapInstanceRef.current?.setView([lat, lon], 17);
    setSearchResults([]);
    setSearchQuery(r.display_name);
  }

  function confirmar() {
    if (!utmPreview) return;
    onConfirm({
      coordX: utmPreview.easting.toFixed(2),
      coordY: utmPreview.northing.toFixed(2),
      utmZona: utmPreview.zona,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Selecionar coordenada no mapa</DialogTitle>
          <DialogDescription>
            Clique no ponto exato do poço sobre a imagem de satélite (ou arraste o pino). Mais preciso que o GPS do celular pra poços próximos entre si.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarEndereco(); } }}
              placeholder="Buscar endereço, cidade ou local para navegar até a área..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
            />
            <Button type="button" onClick={buscarEndereco} disabled={searching} className="shrink-0">
              {searching ? "Buscando..." : "Buscar"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="absolute z-[1000] top-11 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => irParaResultado(r)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <div ref={setMapEl} className="w-full h-[420px] rounded-xl border border-gray-200 z-0" />
            {locating && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 text-[#391e2a] text-xs font-bold px-3 py-1.5 rounded-full shadow-md border border-gray-200 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Localizando você...
              </div>
            )}
          </div>

          <div className="mt-2 text-sm text-gray-500">
            {utmPreview ? (
              <span>
                <strong className="text-[#391e2a]">UTM:</strong> Este (X) {utmPreview.easting.toFixed(2)} · Norte (Y) {utmPreview.northing.toFixed(2)} · Zona {utmPreview.zona}
                {picked && <span className="text-gray-400"> &nbsp;(Lat {picked.lat.toFixed(6)}, Lon {picked.lon.toFixed(6)})</span>}
              </span>
            ) : (
              "Clique no mapa para marcar o ponto."
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={confirmar} disabled={!utmPreview} className="bg-[#80b02d] hover:bg-[#6c9526] text-white">
            Usar este ponto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
