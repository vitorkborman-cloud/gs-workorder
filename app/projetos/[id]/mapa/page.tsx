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
import {
  interpolarIDW,
  construirFaixas,
  gradeParaCanvas,
  utmParaLatLon,
  latLonParaUtm,
  anguloEntrePontos,
  type FaixaPluma,
  type FluxoDirecaoAncorado,
} from "@/lib/geo/plume";
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

type FluxoSalvo = {
  id: string;
  rodada: string;
  rotulo: string | null;
  origemX: number;
  origemY: number;
  pontaX: number;
  pontaY: number;
  utmZona: string;
  direcaoGraus: number;
  razaoAnisotropia: number;
  mapaReferenciaUrl: string | null;
  mapaReferenciaNome: string | null;
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

  // ── Direção do fluxo — várias setas por rodada, uma por sub-região do
  // site (um mapa potenciométrico real não é um vetor único; ver laudo
  // citado na migração 0017). Desenhada no mapa, não digitada em graus.
  const [fluxosPorRodada, setFluxosPorRodada] = useState<Map<string, FluxoSalvo[]>>(new Map());
  const [fluxoEtapa, setFluxoEtapa] = useState<"inativo" | "aguardando_origem" | "aguardando_ponta" | "editando">("inativo");
  const [fluxoEditandoId, setFluxoEditandoId] = useState<string | null>(null);
  const [fluxoOrigemLatLon, setFluxoOrigemLatLon] = useState<[number, number] | null>(null);
  const [fluxoPontaLatLon, setFluxoPontaLatLon] = useState<[number, number] | null>(null);
  const [fluxoRotulo, setFluxoRotulo] = useState("");
  const [razaoAnisotropia, setRazaoAnisotropia] = useState("2.5");
  const [fluxoArquivo, setFluxoArquivo] = useState<File | null>(null);
  const [salvandoFluxo, setSalvandoFluxo] = useState(false);

  const fluxoOrigemMarkerRef = useRef<any>(null);
  const fluxoPontaMarkerRef = useRef<any>(null);
  const fluxoLinhaRef = useRef<any>(null);
  const outrasSetasLayerRef = useRef<any>(null);

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

  const setasDaRodada = plumaRodada ? fluxosPorRodada.get(plumaRodada) || [] : [];

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: proj }, { data: solos }, { data: resultadosData }, { data: fluxosData }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      supabase
        .from("soil_descriptions")
        .select("id, nomenclatura_poco, nome_sondagem, coord_x, coord_y, utm_zona")
        .eq("project_id", projectId),
      supabase
        .from("analytical_results")
        .select("soil_description_id, matriz, contaminante, concentracao, unidade, cma, campanha, data_coleta")
        .eq("project_id", projectId),
      supabase
        .from("groundwater_flow_directions")
        .select("id, rodada, rotulo, origem_x, origem_y, ponta_x, ponta_y, utm_zona, direcao_graus, razao_anisotropia, mapa_referencia_url, mapa_referencia_nome")
        .eq("project_id", projectId),
    ]);
    if (proj) setProjectName(proj.name);
    if (solos) {
      const { validos, pendentes } = classificarPocos(solos);
      setValidos(validos);
      setPendentes(pendentes);
    }
    setResultados((resultadosData as ResultadoPluma[]) || []);
    const mapaFluxos = new Map<string, FluxoSalvo[]>();
    (fluxosData || []).forEach((f: any) => {
      const item: FluxoSalvo = {
        id: f.id,
        rodada: f.rodada,
        rotulo: f.rotulo,
        origemX: f.origem_x,
        origemY: f.origem_y,
        pontaX: f.ponta_x,
        pontaY: f.ponta_y,
        utmZona: f.utm_zona,
        direcaoGraus: f.direcao_graus,
        razaoAnisotropia: f.razao_anisotropia,
        mapaReferenciaUrl: f.mapa_referencia_url,
        mapaReferenciaNome: f.mapa_referencia_nome,
      };
      const lista = mapaFluxos.get(f.rodada) || [];
      lista.push(item);
      mapaFluxos.set(f.rodada, lista);
    });
    setFluxosPorRodada(mapaFluxos);
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

  const utmZonaReferencia = validos[0]?.utmZona || "23S";

  function calcularGrausFluxo(origem: [number, number], ponta: [number, number]): number {
    const o = latLonParaUtm(origem[0], origem[1], utmZonaReferencia);
    const p = latLonParaUtm(ponta[0], ponta[1], utmZonaReferencia);
    return anguloEntrePontos(o.x, o.y, p.x, p.y);
  }

  function rotuloOuIndice(f: FluxoSalvo, lista: FluxoSalvo[]): string {
    if (f.rotulo?.trim()) return f.rotulo.trim();
    const idx = lista.findIndex((x) => x.id === f.id);
    return `Seta ${idx + 1}`;
  }

  // Zera o estado de edição sempre que a rodada muda — as setas já salvas
  // dessa rodada aparecem via o efeito de "outras setas" abaixo, não
  // precisa carregar nada aqui.
  useEffect(() => {
    setFluxoEtapa("inativo");
    setFluxoEditandoId(null);
    setFluxoOrigemLatLon(null);
    setFluxoPontaLatLon(null);
    setFluxoRotulo("");
    setRazaoAnisotropia("2.5");
    setFluxoArquivo(null);
  }, [plumaRodada]);

  // Clique no mapa pra desenhar a seta — só ativo enquanto aguardando os
  // dois pontos (origem/ponta); fora disso não interfere no mapa normal.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || (fluxoEtapa !== "aguardando_origem" && fluxoEtapa !== "aguardando_ponta")) return;

    function aoClicar(e: any) {
      const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
      if (fluxoEtapa === "aguardando_origem") {
        setFluxoOrigemLatLon(latlng);
        setFluxoEtapa("aguardando_ponta");
      } else {
        setFluxoPontaLatLon(latlng);
        setFluxoEtapa("editando");
      }
    }
    map.on("click", aoClicar);
    return () => { map.off("click", aoClicar); };
  }, [fluxoEtapa]);

  // Desenha/atualiza a seta ATIVA (a que está sendo desenhada ou ajustada)
  // — origem, ponta, linha. Arrastável só em modo "editando".
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (fluxoOrigemMarkerRef.current) { fluxoOrigemMarkerRef.current.remove(); fluxoOrigemMarkerRef.current = null; }
    if (fluxoPontaMarkerRef.current) { fluxoPontaMarkerRef.current.remove(); fluxoPontaMarkerRef.current = null; }
    if (fluxoLinhaRef.current) { fluxoLinhaRef.current.remove(); fluxoLinhaRef.current = null; }

    if (!fluxoOrigemLatLon) return;
    const arrastavel = fluxoEtapa === "editando";

    const origemIcon = L.divIcon({
      className: "",
      html: `<div style="width:10px;height:10px;border-radius:50%;background:#391e2a;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.5);"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
    const origemMarker = L.marker(fluxoOrigemLatLon, { icon: origemIcon, draggable: arrastavel, zIndexOffset: 800 }).addTo(map);
    if (arrastavel) {
      origemMarker.on("dragend", (e: any) => {
        const p = e.target.getLatLng();
        setFluxoOrigemLatLon([p.lat, p.lng]);
      });
    }
    fluxoOrigemMarkerRef.current = origemMarker;

    if (fluxoPontaLatLon) {
      const graus = calcularGrausFluxo(fluxoOrigemLatLon, fluxoPontaLatLon);
      const pontaIcon = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;transform:rotate(${graus}deg);transform-origin:center;">
          <svg width="22" height="22" viewBox="0 0 22 22"><path d="M11 1 L18 20 L11 15 L4 20 Z" fill="#391e2a" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const pontaMarker = L.marker(fluxoPontaLatLon, { icon: pontaIcon, draggable: arrastavel, zIndexOffset: 800 }).addTo(map);
      if (arrastavel) {
        pontaMarker.on("dragend", (e: any) => {
          const p = e.target.getLatLng();
          setFluxoPontaLatLon([p.lat, p.lng]);
        });
      }
      fluxoPontaMarkerRef.current = pontaMarker;

      fluxoLinhaRef.current = L.polyline([fluxoOrigemLatLon, fluxoPontaLatLon], { color: "#391e2a", weight: 2, dashArray: "4 6" }).addTo(map);
    }
  }, [fluxoOrigemLatLon, fluxoPontaLatLon, fluxoEtapa]);

  // Desenha as OUTRAS setas já salvas dessa rodada (tudo exceto a que está
  // sendo editada agora) — mais discretas, não arrastáveis, só pra dar
  // contexto de onde as outras zonas já apontam enquanto se ajusta uma.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (outrasSetasLayerRef.current) { outrasSetasLayerRef.current.remove(); outrasSetasLayerRef.current = null; }
    if (!plumaRodada) return;

    const grupo = L.layerGroup().addTo(map);
    setasDaRodada
      .filter((f) => f.id !== fluxoEditandoId)
      .forEach((f) => {
        const origem = utmParaLatLon(f.origemX, f.origemY, f.utmZona);
        const ponta = utmParaLatLon(f.pontaX, f.pontaY, f.utmZona);
        L.polyline([origem, ponta], { color: "#9a8f95", weight: 1.5, dashArray: "2 5" }).addTo(grupo);
        const icone = L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;transform:rotate(${f.direcaoGraus}deg);transform-origin:center;">
            <svg width="16" height="16" viewBox="0 0 22 22"><path d="M11 1 L18 20 L11 15 L4 20 Z" fill="#9a8f95" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>
          </div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker(ponta, { icon: icone, interactive: false }).addTo(grupo);
      });
    outrasSetasLayerRef.current = grupo;
  }, [plumaRodada, fluxosPorRodada, fluxoEditandoId, mapReady]);

  function iniciarDesenhoFluxo() {
    setFluxoEditandoId(null);
    setFluxoOrigemLatLon(null);
    setFluxoPontaLatLon(null);
    setFluxoRotulo("");
    setRazaoAnisotropia("2.5");
    setFluxoArquivo(null);
    setFluxoEtapa("aguardando_origem");
  }

  function ajustarFluxo(f: FluxoSalvo) {
    setFluxoEditandoId(f.id);
    setFluxoOrigemLatLon(utmParaLatLon(f.origemX, f.origemY, f.utmZona));
    setFluxoPontaLatLon(utmParaLatLon(f.pontaX, f.pontaY, f.utmZona));
    setFluxoRotulo(f.rotulo || "");
    setRazaoAnisotropia(String(f.razaoAnisotropia));
    setFluxoArquivo(null);
    setFluxoEtapa("editando");
  }

  function cancelarDesenhoFluxo() {
    setFluxoEtapa("inativo");
    setFluxoEditandoId(null);
    setFluxoOrigemLatLon(null);
    setFluxoPontaLatLon(null);
    setFluxoRotulo("");
    setFluxoArquivo(null);
  }

  async function salvarFluxo() {
    if (!fluxoOrigemLatLon || !fluxoPontaLatLon || !plumaRodada) return;
    setSalvandoFluxo(true);
    try {
      const origem = latLonParaUtm(fluxoOrigemLatLon[0], fluxoOrigemLatLon[1], utmZonaReferencia);
      const ponta = latLonParaUtm(fluxoPontaLatLon[0], fluxoPontaLatLon[1], utmZonaReferencia);
      const direcaoGraus = anguloEntrePontos(origem.x, origem.y, ponta.x, ponta.y);
      const razao = parseFloat(razaoAnisotropia) || 2.5;

      const existente = fluxoEditandoId ? setasDaRodada.find((f) => f.id === fluxoEditandoId) : null;
      let mapaReferenciaUrl = existente?.mapaReferenciaUrl || null;
      let mapaReferenciaNome = existente?.mapaReferenciaNome || null;
      if (fluxoArquivo) {
        const path = `${projectId}/fluxo_${Date.now()}_${fluxoArquivo.name}`;
        const { error: upErr } = await supabase.storage.from("project-documents").upload(path, fluxoArquivo);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("project-documents").getPublicUrl(path);
        mapaReferenciaUrl = publicUrl;
        mapaReferenciaNome = fluxoArquivo.name;
      }

      const payload = {
        project_id: projectId,
        rodada: plumaRodada,
        rotulo: fluxoRotulo.trim() || null,
        origem_x: origem.x,
        origem_y: origem.y,
        ponta_x: ponta.x,
        ponta_y: ponta.y,
        utm_zona: utmZonaReferencia,
        direcao_graus: direcaoGraus,
        razao_anisotropia: razao,
        mapa_referencia_url: mapaReferenciaUrl,
        mapa_referencia_nome: mapaReferenciaNome,
        updated_at: new Date().toISOString(),
      };

      let idFinal = fluxoEditandoId;
      if (fluxoEditandoId) {
        const { error } = await supabase.from("groundwater_flow_directions").update(payload).eq("id", fluxoEditandoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("groundwater_flow_directions").insert(payload).select("id").single();
        if (error) throw error;
        idFinal = data.id;
      }

      const novoItem: FluxoSalvo = {
        id: idFinal!,
        rodada: plumaRodada,
        rotulo: payload.rotulo,
        origemX: origem.x,
        origemY: origem.y,
        pontaX: ponta.x,
        pontaY: ponta.y,
        utmZona: utmZonaReferencia,
        direcaoGraus,
        razaoAnisotropia: razao,
        mapaReferenciaUrl,
        mapaReferenciaNome,
      };
      setFluxosPorRodada((prev) => {
        const next = new Map(prev);
        const lista = [...(next.get(plumaRodada) || [])];
        const idx = lista.findIndex((f) => f.id === idFinal);
        if (idx >= 0) lista[idx] = novoItem; else lista.push(novoItem);
        next.set(plumaRodada, lista);
        return next;
      });
      cancelarDesenhoFluxo();
    } catch (err) {
      alert("Erro ao salvar a direção do fluxo. Verifique o console.");
      console.error(err);
    } finally {
      setSalvandoFluxo(false);
    }
  }

  async function removerFluxo(id: string) {
    if (!confirm("Remover essa seta de fluxo?")) return;
    await supabase.from("groundwater_flow_directions").delete().eq("id", id);
    setFluxosPorRodada((prev) => {
      const next = new Map(prev);
      next.set(plumaRodada, (next.get(plumaRodada) || []).filter((f) => f.id !== id));
      return next;
    });
    if (fluxoEditandoId === id) cancelarDesenhoFluxo();
  }

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

    // Cada seta salva vira uma direção ancorada no meio do próprio traço —
    // a interpolação mistura as setas próximas por distância, então o
    // sentido do fluxo pode variar de uma sub-região do site pra outra em
    // vez de forçar um vetor único (ver migração 0017).
    const fluxosAncorados: FluxoDirecaoAncorado[] = setasDaRodada.map((f) => ({
      x: (f.origemX + f.pontaX) / 2,
      y: (f.origemY + f.pontaY) / 2,
      direcaoGraus: f.direcaoGraus,
      razaoAnisotropia: f.razaoAnisotropia,
    }));

    const grade = interpolarIDW(pontos, fluxosAncorados.length > 0 ? { fluxos: fluxosAncorados } : undefined);
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

            {plumaRodada && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 mb-2">
                  Direção do fluxo de água subterrânea (opcional) — pode ter mais de uma, uma por sub-região do site
                </p>

                {setasDaRodada.length > 0 && fluxoEtapa !== "editando" && (
                  <div className="space-y-1.5 mb-3">
                    {setasDaRodada.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#391e2a] truncate">{rotuloOuIndice(f, setasDaRodada)}</p>
                          <p className="text-[11px] text-gray-400">{Math.round(f.direcaoGraus)}° · alongamento {f.razaoAnisotropia}x</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {f.mapaReferenciaUrl && (
                            <a href={f.mapaReferenciaUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-[#2f7ea1] hover:underline">
                              Ver referência
                            </a>
                          )}
                          <button type="button" onClick={() => ajustarFluxo(f)} className="text-[11px] font-bold text-gray-500 hover:text-[#391e2a] transition">
                            Ajustar
                          </button>
                          <button type="button" onClick={() => removerFluxo(f.id)} className="text-[11px] font-bold text-gray-400 hover:text-red-500 transition">
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {fluxoEtapa === "inativo" && (
                  <button
                    type="button"
                    onClick={iniciarDesenhoFluxo}
                    className="text-xs font-bold text-[#391e2a] border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition"
                  >
                    + Adicionar seta de fluxo
                  </button>
                )}

                {fluxoEtapa === "aguardando_origem" && (
                  <p className="text-xs text-[#391e2a] font-bold bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Clique no mapa no ponto de origem do fluxo (de onde a água vem) — olhe o mapa que o cliente enviou como referência.
                  </p>
                )}
                {fluxoEtapa === "aguardando_ponta" && (
                  <p className="text-xs text-[#391e2a] font-bold bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Agora clique na direção pra onde a água escoa.
                  </p>
                )}

                {fluxoEtapa === "editando" && fluxoOrigemLatLon && fluxoPontaLatLon && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">
                      Direção calculada: <strong className="text-[#391e2a]">{Math.round(calcularGrausFluxo(fluxoOrigemLatLon, fluxoPontaLatLon))}°</strong> — arraste os pontos no mapa pra ajustar a seta.
                    </p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Rótulo da zona (opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex.: Galpão/Administração"
                          value={fluxoRotulo}
                          onChange={(e) => setFluxoRotulo(e.target.value)}
                          className="border rounded-lg px-2.5 py-2 text-sm w-52 focus:ring-2 focus:ring-[#80b02d] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Razão de alongamento</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={razaoAnisotropia}
                          onChange={(e) => setRazaoAnisotropia(e.target.value)}
                          className="border rounded-lg px-2.5 py-2 text-sm w-24 focus:ring-2 focus:ring-[#80b02d] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Mapa de referência do cliente (opcional)</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setFluxoArquivo(e.target.files?.[0] || null)}
                          className="text-xs"
                        />
                      </div>
                      <Button onClick={salvarFluxo} disabled={salvandoFluxo || !fluxoPontaLatLon} className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold h-[38px]">
                        {salvandoFluxo ? "Salvando..." : "Salvar seta"}
                      </Button>
                      <button type="button" onClick={cancelarDesenhoFluxo} className="text-xs font-bold text-gray-400 hover:text-red-500 transition h-[38px]">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-gray-400 mt-3 max-w-2xl">
              Interpolação por distância inversa (IDW), não krigagem.{" "}
              {setasDaRodada.length > 0
                ? `${setasDaRodada.length} seta${setasDaRodada.length === 1 ? "" : "s"} de fluxo aplicada${setasDaRodada.length === 1 ? "" : "s"} — a interpolação alonga conforme a mais próxima de cada ponto.`
                : "Sem direção de fluxo definida, o cálculo é isotrópico (círculo)."}{" "}
              De qualquer forma, é uma aproximação visual, não uma delimitação hidrogeológica formal.
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
