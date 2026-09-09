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
import { interpolarIDW, construirFaixas, gradeParaCanvas, utmParaLatLon, type FaixaPluma } from "@/lib/geo/plume";
import "leaflet/dist/leaflet.css";

type ResultadoPluma = {
  soil_description_id: string;
  matriz: "agua_subterranea" | "solo";
  contaminante: string;
  concentracao: number;
  unidade: string;
  cma: number | null;
  campanha: string | null;
  data_coleta: string;
};

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
  const [resultados, setResultados] = useState<ResultadoPluma[]>([]);

  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const plumaOverlayRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Cor por tipo de poço (prefixo do nome) + contagem — mesma lógica usada
  // no PDF, pra tela e documento exportado mostrarem sempre a mesma legenda.
  const legendaGrupos = useMemo(() => construirLegendaGrupos(validos), [validos]);

  // ── Pluma de contaminação (IDW) ──────────────────────────────────────
  const [plumaMatriz, setPlumaMatriz] = useState<"agua_subterranea" | "solo">("agua_subterranea");
  const [plumaContaminante, setPlumaContaminante] = useState("");
  const [plumaRodada, setPlumaRodada] = useState("");
  const [plumaAtiva, setPlumaAtiva] = useState(false);
  const [plumaFaixas, setPlumaFaixas] = useState<FaixaPluma[]>([]);
  const [plumaErro, setPlumaErro] = useState("");

  const pocoPorId = useMemo(() => new Map(validos.map((p) => [p.id, p])), [validos]);

  // Só entram resultados de poços que aparecem no mapa (coordenada válida) —
  // um resultado num poço pendente não tem onde ser plotado.
  const resultadosComPonto = useMemo(
    () => resultados.filter((r) => pocoPorId.has(r.soil_description_id)),
    [resultados, pocoPorId]
  );

  const matrizesComDados = useMemo(
    () => Array.from(new Set(resultadosComPonto.map((r) => r.matriz))),
    [resultadosComPonto]
  );

  const contaminantesDisponiveis = useMemo(
    () => Array.from(new Set(resultadosComPonto.filter((r) => r.matriz === plumaMatriz).map((r) => r.contaminante))).sort(),
    [resultadosComPonto, plumaMatriz]
  );

  function rodadaDe(r: ResultadoPluma) {
    return r.campanha?.trim() || r.data_coleta;
  }

  const rodadasDisponiveis = useMemo(() => {
    const porRodada = new Map<string, { count: number; maisRecente: string }>();
    resultadosComPonto
      .filter((r) => r.matriz === plumaMatriz && r.contaminante === plumaContaminante)
      .forEach((r) => {
        const key = rodadaDe(r);
        const atual = porRodada.get(key);
        if (!atual) porRodada.set(key, { count: 1, maisRecente: r.data_coleta });
        else {
          atual.count += 1;
          if (r.data_coleta > atual.maisRecente) atual.maisRecente = r.data_coleta;
        }
      });
    return Array.from(porRodada.entries())
      .map(([rodada, info]) => ({ rodada, ...info }))
      .sort((a, b) => b.maisRecente.localeCompare(a.maisRecente));
  }, [resultadosComPonto, plumaMatriz, plumaContaminante]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: proj }, { data: solos }, { data: resultadosData }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      supabase
        .from("soil_descriptions")
        .select("id, nomenclatura_poco, nome_sondagem, coord_x, coord_y, utm_zona")
        .eq("project_id", projectId),
      supabase
        .from("analytical_results")
        .select("soil_description_id, matriz, contaminante, concentracao, unidade, cma, campanha, data_coleta")
        .eq("project_id", projectId),
    ]);
    if (proj) setProjectName(proj.name);
    if (solos) {
      const { validos, pendentes } = classificarPocos(solos);
      setValidos(validos);
      setPendentes(pendentes);
    }
    setResultados((resultadosData as ResultadoPluma[]) || []);
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
      leafletRef.current = L;

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

  function removerPluma() {
    if (plumaOverlayRef.current) {
      plumaOverlayRef.current.remove();
      plumaOverlayRef.current = null;
    }
    setPlumaAtiva(false);
    setPlumaErro("");
  }

  function gerarPluma() {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !plumaContaminante || !plumaRodada) return;

    const linhas = resultadosComPonto.filter(
      (r) => r.matriz === plumaMatriz && r.contaminante === plumaContaminante && rodadaDe(r) === plumaRodada
    );

    // Um poço pode ter mais de uma linha na mesma rodada só por erro de
    // digitação duplicada — agrega por média em vez de contar duas vezes o
    // mesmo ponto espacial.
    const porPoco = new Map<string, { soma: number; n: number; cma: number | null }>();
    linhas.forEach((r) => {
      const atual = porPoco.get(r.soil_description_id);
      if (atual) {
        atual.soma += r.concentracao;
        atual.n += 1;
        if (atual.cma == null) atual.cma = r.cma;
      } else {
        porPoco.set(r.soil_description_id, { soma: r.concentracao, n: 1, cma: r.cma });
      }
    });

    const pontos: { x: number; y: number; valor: number }[] = [];
    let cma: number | null = null;
    let utmZona = "";
    porPoco.forEach((info, soilId) => {
      const poco = pocoPorId.get(soilId);
      if (!poco) return;
      pontos.push({ x: poco.coordX, y: poco.coordY, valor: info.soma / info.n });
      if (cma == null) cma = info.cma;
      utmZona = poco.utmZona;
    });

    if (pontos.length < 2) {
      setPlumaErro("Precisa de pelo menos 2 poços com esse contaminante nessa rodada pra interpolar.");
      return;
    }

    const grade = interpolarIDW(pontos);
    if (!grade) {
      setPlumaErro("Não foi possível interpolar com esses pontos.");
      return;
    }

    const valorMax = Math.max(...pontos.map((p) => p.valor));
    const faixas = construirFaixas(cma, valorMax);
    const canvas = gradeParaCanvas(grade, faixas, 0.6);

    const [swLat, swLon] = utmParaLatLon(grade.minX, grade.minY, utmZona);
    const [neLat, neLon] = utmParaLatLon(grade.maxX, grade.maxY, utmZona);

    if (plumaOverlayRef.current) plumaOverlayRef.current.remove();
    plumaOverlayRef.current = L.imageOverlay(canvas.toDataURL(), [
      [swLat, swLon],
      [neLat, neLon],
    ], { opacity: 1, interactive: false }).addTo(map);

    setPlumaFaixas(faixas);
    setPlumaAtiva(true);
    setPlumaErro("");
  }

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

        {resultadosComPonto.length > 0 && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Pluma de contaminação (interpolação IDW)</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Matriz</label>
                <select
                  value={plumaMatriz}
                  onChange={(e) => {
                    setPlumaMatriz(e.target.value as "agua_subterranea" | "solo");
                    setPlumaContaminante("");
                    setPlumaRodada("");
                  }}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none min-w-[160px]"
                >
                  {matrizesComDados.includes("agua_subterranea") && <option value="agua_subterranea">Água subterrânea</option>}
                  {matrizesComDados.includes("solo") && <option value="solo">Solo</option>}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Contaminante</label>
                <select
                  value={plumaContaminante}
                  onChange={(e) => { setPlumaContaminante(e.target.value); setPlumaRodada(""); }}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none min-w-[180px]"
                >
                  <option value="">Selecione...</option>
                  {contaminantesDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Rodada</label>
                <select
                  value={plumaRodada}
                  onChange={(e) => setPlumaRodada(e.target.value)}
                  disabled={!plumaContaminante}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none min-w-[180px] disabled:opacity-50"
                >
                  <option value="">Selecione...</option>
                  {rodadasDisponiveis.map((r) => (
                    <option key={r.rodada} value={r.rodada}>{r.rodada} ({r.count} poços)</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={gerarPluma}
                disabled={!plumaContaminante || !plumaRodada}
                className="bg-[#391e2a] hover:bg-[#2a161f] text-white font-bold h-[38px]"
              >
                Gerar pluma
              </Button>
              {plumaAtiva && (
                <button onClick={removerPluma} className="text-xs font-bold text-gray-400 hover:text-red-500 transition h-[38px]">
                  Remover pluma
                </button>
              )}
            </div>
            {plumaErro && <p className="text-xs text-red-500 font-medium mt-2">{plumaErro}</p>}
            <p className="text-[11px] text-gray-400 mt-3 max-w-2xl">
              Interpolação por distância inversa (IDW), não krigagem — não modela direção de fluxo de água subterrânea. É uma aproximação visual, não uma delimitação hidrogeológica formal.
            </p>
          </div>
        )}

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
            {plumaAtiva && plumaFaixas.length > 0 && (
              <div className="absolute bottom-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-gray-200 px-3 py-2.5 max-w-[220px]">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  {plumaContaminante} — {plumaMatriz === "agua_subterranea" ? "água subterrânea" : "solo"}
                </p>
                <div className="space-y-1">
                  {plumaFaixas.map((f) => (
                    <div key={f.label} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: f.cor }} />
                      <span className="text-[11px] text-gray-700">{f.label}</span>
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
