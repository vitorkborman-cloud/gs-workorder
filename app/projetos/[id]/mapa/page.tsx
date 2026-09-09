"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import {
  classificarPocos,
  buildMapaGeralPdf,
  construirMapaCores,
  construirLegendaGrupos,
  type PocoMapa,
  type PocoPendente,
} from "@/lib/pdf/mapa-geral";
import "leaflet/dist/leaflet.css";

const MOTIVO_LABEL: Record<PocoPendente["motivo"], string> = {
  sem_coordenada: "Sem coordenada cadastrada",
  coordenada_suspeita: "Coordenada parece ser latitude/longitude, não UTM",
  zona_ausente: "Coordenada sem zona UTM definida",
};

export default function MapaGeralPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [validos, setValidos] = useState<PocoMapa[]>([]);
  const [pendentes, setPendentes] = useState<PocoPendente[]>([]);
  const [generating, setGenerating] = useState(false);

  const mapInstanceRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Cor por tipo de poço (prefixo do nome) + contagem — mesma lógica usada
  // no PDF, pra tela e documento exportado mostrarem sempre a mesma legenda.
  const legendaGrupos = useMemo(() => construirLegendaGrupos(validos), [validos]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: proj }, { data: solos }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      supabase
        .from("soil_descriptions")
        .select("id, nomenclatura_poco, nome_sondagem, coord_x, coord_y, utm_zona")
        .eq("project_id", projectId),
    ]);
    if (proj) setProjectName(proj.name);
    if (solos) {
      const { validos, pendentes } = classificarPocos(solos);
      setValidos(validos);
      setPendentes(pendentes);
    }
    setLoading(false);
  }

  // Monta o mapa Leaflet assim que o container existir e houver ao menos um
  // poço com coordenada válida pra centralizar nele.
  useEffect(() => {
    if (!mapContainerRef.current || validos.length === 0 || mapInstanceRef.current) return;
    let cancelled = false;
    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, { center: [validos[0].lat, validos[0].lon], zoom: 19 });
      mapInstanceRef.current = map;

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri",
        maxZoom: 19,
        crossOrigin: true,
      }).addTo(map);

      // Marcação técnica neutra (ponto centrado no local exato) — mais perto
      // de convenção de planta topográfica do que de pino de mapa de app.
      // A cor identifica o tipo do poço (prefixo do nome); ver legenda.
      const corPorGrupo = construirMapaCores(validos.map((p) => p.grupo));
      const iconCache = new Map<string, any>();
      function iconeParaGrupo(grupo: string) {
        const cor = corPorGrupo.get(grupo) || "#000";
        if (!iconCache.has(cor)) {
          iconCache.set(
            cor,
            L.divIcon({
              className: "",
              html: `<div style="width:9px;height:9px;border-radius:50%;background:${cor};border:1.6px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.7);"></div>`,
              iconSize: [9, 9],
              iconAnchor: [4.5, 4.5],
            })
          );
        }
        return iconCache.get(cor);
      }

      const bounds: [number, number][] = [];
      validos.forEach((p) => {
        const marker = L.marker([p.lat, p.lon], { icon: iconeParaGrupo(p.grupo) }).addTo(map);
        marker.bindTooltip(p.nomenclatura, { permanent: true, direction: "top", offset: [0, -8], className: "poco-label" });
        bounds.push([p.lat, p.lon]);
      });

      // Padding pequeno de propósito — a prioridade é dar o máximo de zoom
      // que ainda cabe todos os poços, não sobrar moldura em volta deles.
      if (bounds.length > 1) map.fitBounds(bounds as any, { padding: [12, 12], maxZoom: 19 });

      L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);

      setMapReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [validos]);

  async function baixarPdf() {
    if (!mapContainerRef.current || validos.length === 0) return;
    setGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(mapContainerRef.current, { useCORS: true, allowTaint: false, scale: 2 });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = await buildMapaGeralPdf({
        projectName,
        mapImageDataUrl: dataUrl,
        mapImageAspect: canvas.width / canvas.height,
        totalValidos: validos.length,
        totalPendentes: pendentes.length,
        legendaGrupos,
      });
      pdf.save(`Mapa_Geral_${projectName}.pdf`);
    } catch (err) {
      alert("Erro ao gerar o PDF. Verifique o console.");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse">Carregando mapa...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <style>{`
        .poco-label {
          background: transparent;
          border: none;
          box-shadow: none;
          color: #111;
          font-weight: 700;
          font-size: 11px;
          padding: 0;
          text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 3px #fff;
        }
        .poco-label::before { display: none; }
      `}</style>

      <div className="max-w-7xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#391e2a] tracking-tight">Mapa Geral do Site</h1>
            <p className="text-sm text-gray-400 mt-1">{projectName}</p>
          </div>
          <Button
            onClick={baixarPdf}
            disabled={generating || validos.length === 0}
            className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold px-6 h-11 shadow-sm"
          >
            {generating ? "Gerando..." : "Baixar PDF"}
          </Button>
        </div>

        {validos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
            Nenhum poço com coordenada válida neste projeto ainda. Corrija as pendências abaixo pra o mapa aparecer aqui.
          </div>
        ) : (
          <div className="relative">
            <div
              ref={mapContainerRef}
              className="w-full h-[780px]"
              style={{ borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
            />
            {mapReady && legendaGrupos.length > 0 && (
              <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-gray-200 px-3 py-2.5 max-w-[170px]">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Tipo de poço</p>
                <div className="space-y-1">
                  {legendaGrupos.map((g) => (
                    <div key={g.grupo} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: g.cor, border: "1.5px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.6)" }}
                      />
                      <span className="text-xs text-gray-700 truncate">
                        {g.grupo} <span className="text-gray-400">({g.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="bg-amber-50 px-6 py-3 border-b border-amber-200">
              <p className="text-sm font-bold text-amber-800">
                {pendentes.length} poço{pendentes.length === 1 ? "" : "s"} não {pendentes.length === 1 ? "aparece" : "aparecem"} no mapa — coordenada pendente
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {pendentes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/projetos/${projectId}/solo/${p.id}`)}
                  className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-gray-50 transition"
                >
                  <div>
                    <p className="text-sm font-bold text-[#391e2a]">{p.nomenclatura}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{MOTIVO_LABEL[p.motivo]}</p>
                  </div>
                  <span className="text-xs font-bold text-[#80b02d] shrink-0 ml-3">Corrigir no mapa →</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
