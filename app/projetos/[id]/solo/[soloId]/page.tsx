"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AdminShell from "../../../../../components/layout/AdminShell";
import { Button } from "../../../../../components/ui/button";
import jsPDF from "jspdf";

async function fetchLogoBase64(src: string): Promise<string> {
  const resp = await fetch(src);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type Layer = {
  de: string;
  ate: string;
  tipo: string;
  coloracao?: string;
  leitura_voc?: string;
};

const tiposSolo = [
  "Areia", "Areia de granulação variada argilosa", "Areia de granulação variada pouco argilosa",
  "Areia de granulação variada pouco siltosa", "Areia de granulação variada silto argilosa",
  "Areia de granulação variada siltosa", "Areia de granulação variada muito argilosa",
  "Areia fina", "Areia fina argilosa", "Areia fina e média argilosa", "Areia fina e média pouco argilosa",
  "Areia fina e média pouco siltosa", "Areia fina e média silto argilosa", "Areia fina e média siltosa",
  "Areia fina e média muito argilosa", "Areia fina pouco argilosa", "Areia fina pouco siltosa",
  "Areia fina silto argilosa", "Areia fina siltosa", "Areia fina muito argilosa", "Areia grossa",
  "Areia grossa argilosa", "Areia grossa pouco argilosa", "Areia grossa pouco siltosa",
  "Areia grossa silto argilosa", "Areia grossa siltosa", "Areia grossa muito argilosa", "Areia média",
  "Argila", "Argila orgânica", "Argila plástica", "Argila silto arenosa", "Argila siltosa",
  "Argila siltosa pouco arenosa", "Argila siltosa muito arenosa", "Aterro", "Britas", "Concreto",
  "Rachão", "Silte", "Silte argilo arenoso", "Silte argiloso", "Silte areno argiloso",
  "Silte arenoso", "Silte muito arenoso"
];

export default function SoloDetailPage() {
  const params = useParams();
  const soloId = params.soloId as string;

  const [data, setData] = useState<any>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [loading, setLoading] = useState(true);

  // === ESTADOS DO MODO EDIÇÃO ===
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editLayers, setEditLayers] = useState<Layer[]>([]);

  async function load() {
    const { data } = await supabase.from("soil_descriptions").select("*").eq("id", soloId).single();
    if (data) {
      setData(data);
      setLayers((data.layers as Layer[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // === FUNÇÕES DE EDIÇÃO ===
  function startEditing() {
    setEditForm({ ...data });
    setEditLayers(layers.length > 0 ? JSON.parse(JSON.stringify(layers)) : [{ de: "", ate: "", tipo: "", coloracao: "", leitura_voc: "" }]);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("soil_descriptions")
        .update({ ...editForm, layers: editLayers })
        .eq("id", soloId);
      
      if (error) throw error;
      
      await load(); // Recarrega os dados novos do banco
      setIsEditing(false);
    } catch (error) {
      alert("Erro ao salvar alterações.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange(field: string, value: string) {
    setEditForm((prev: any) => ({ ...prev, [field]: value }));
  }

  function handleLayerChange(index: number, field: keyof Layer, value: string) {
    const newLayers = [...editLayers];
    newLayers[index] = { ...newLayers[index], [field]: value };
    setEditLayers(newLayers);
  }

  function addLayer() {
    setEditLayers([...editLayers, { de: "", ate: "", tipo: "", coloracao: "", leitura_voc: "" }]);
  }

  function removeLayer(index: number) {
    setEditLayers(editLayers.filter((_, i) => i !== index));
  }

  /* ================= CORES AUTOMÁTICAS E PDF ================= */
  function gerarCor(nome: string): [number, number, number] {
    const n = nome.toLowerCase();
    if (n.includes("concreto")) return [200, 200, 200];
    if (n.includes("rachão") || n.includes("rachao")) return [100, 100, 100];
    if (n.includes("brita")) return [140, 140, 140];
    if (n.includes("cascalho")) return [120, 120, 120];
    if (n.includes("argila")) {
      if (n.includes("silt")) return [220, 120, 120];
      if (n.includes("aren")) return [200, 70, 70];
      return [150, 40, 40];
    }
    if (n.includes("silte")) {
      if (n.includes("silt")) return [185, 120, 95];
      if (n.includes("aren")) return [200, 140, 90];
      return [170, 95, 70];
    }
    if (n.includes("areia")) {
      if (n.includes("fina")) return [235, 210, 140];
      if (n.includes("grossa")) return [220, 190, 110];
      return [230, 200, 120];
    }
    if (n.includes("orgânica") || n.includes("organica")) return [60, 60, 60];
    if (n.includes("turfa")) return [40, 40, 40];
    return [200, 180, 140];
  }

  // ─── gera um tile de textura como data URI (suportado pelo html2canvas) ──

  function makeTile(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    draw(ctx);
    return c.toDataURL("image/png");
  }

  // Pré-gera os tiles uma vez
  const TILE = {
    areia:  makeTile(6, 6,   ctx => { ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.arc(3, 3, 1, 0, Math.PI * 2); ctx.fill(); }),
    argila: makeTile(1, 7,   ctx => { ctx.fillStyle = "rgba(0,0,0,0.2)";  ctx.fillRect(0, 6, 1, 1); }),
    silte:  makeTile(6, 6,   ctx => { ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(0, 5); ctx.stroke(); }),
    brita:  makeTile(14, 14, ctx => { ctx.strokeStyle = "rgba(80,80,80,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(7, 7, 4, 0, Math.PI * 2); ctx.stroke(); }),
    filtro: makeTile(1, 4,   ctx => { ctx.fillStyle = "#333"; ctx.fillRect(0, 3, 1, 1); }),
  };

  // ─── NOVO gerador de HTML — design profissional ──────────────────────────

  function buildProfileHTML(logoBase64: string): string {
    const ESCALA     = 42;   // px por metro
    const MIN_H      = 44;   // altura mínima de cada linha
    const PAGE_W     = 794;  // largura total da página
    const PAD        = 18;   // padding horizontal
    const CONTENT_W  = PAGE_W - PAD * 2; // 758px

    // Colunas do perfil
    const C_PROF = 52;   // profundidade
    const C_PERF = 170;  // perfil geológico
    const C_VOC  = 56;   // VOC
    const C_DESC = CONTENT_W - C_PROF - C_PERF - C_VOC; // restante (~480px)

    const preFiltroTopo = parseFloat(data.pre_filtro);
    const filtroTopo    = parseFloat(data.secao_filtrante_topo);
    const filtroBase    = parseFloat(data.secao_filtrante_base);
    const nivelAgua     = parseFloat(data.nivel_agua);
    const hasWell       = !isNaN(filtroTopo) || !isNaN(preFiltroTopo);
    const TOP_OFFSET    = hasWell ? 20 : 0;

    const profTotal = parseFloat(data.profundidade_total)
      || (layers.length ? parseFloat(String(layers[layers.length - 1].ate)) : 10);

    // Altura de cada camada
    const rowHeights = layers.map(l => {
      const esp = parseFloat(String(l.ate)) - parseFloat(String(l.de));
      return Math.max(MIN_H, esp * ESCALA);
    });
    const profileH = TOP_OFFSET + rowHeights.reduce((s, h) => s + h, 0) + (hasWell ? 60 : 0);

    // getY: posição Y absoluta dentro do overlay do perfil
    const getY = (depth: number | string): number => {
      let y = TOP_OFFSET;
      let d = parseFloat(String(depth));
      if (isNaN(d)) return TOP_OFFSET;
      for (let i = 0; i < layers.length; i++) {
        const de  = parseFloat(String(layers[i].de));
        const ate = parseFloat(String(layers[i].ate));
        const rH  = rowHeights[i];
        if (d <= de) break;
        if (d >= ate) y += rH;
        else { y += ((d - de) / (ate - de)) * rH; break; }
      }
      return y;
    };

    // Estilo de solo (cor + textura tile)
    const soloStyle = (tipo: string): string => {
      if (!tipo) return "background-color:#f0f0f0;";
      const t = tipo.toLowerCase().trim();
      let bg = "#e0e0e0";
      if (t.includes("brita") || t.includes("rach") || t.includes("concreto") || t.includes("cascalho")) bg = "#c8c8c8";
      else if (t.includes("aterro") || t.includes("orgân") || t.includes("turfa")) bg = "#8b7355";
      else if (t.startsWith("areia"))  bg = t.includes("argil") ? "#E6C27A" : t.includes("silt") ? "#EEDD82" : "#FCE663";
      else if (t.startsWith("silte"))  bg = t.includes("aren") ? "#D1B280" : t.includes("argil") ? "#B88655" : "#C19A6B";
      else if (t.startsWith("argila")) bg = t.includes("aren") ? "#CC6B58" : t.includes("silt") ? "#B86554" : "#D47A6A";

      let tile = "", sz = "6px 6px";
      if (t.includes("brita") || t.includes("rach") || t.includes("cascalho"))      { tile = TILE.brita; sz = "14px 14px"; }
      else if (t.includes("areia") || t.includes("arenos"))                          { tile = TILE.areia; sz = "6px 6px"; }
      else if (t.includes("argila") || t.includes("argilos"))                        { tile = TILE.argila; sz = "1px 7px"; }
      else if (t.includes("silte") || t.includes("siltos"))                          { tile = TILE.silte; sz = "6px 6px"; }

      return `background-color:${bg};${tile ? `background-image:url(${tile});background-size:${sz};background-repeat:repeat;` : ""}`;
    };

    // ── CONSTRUTIVO DO POÇO ───────────────────────────────────────────────
    // Dentro da coluna de 170px:
    //   x 0–54     → zona esquerda (labels seção filtrante)
    //   x 55–115   → tubo/casing centrado em x=85
    //   x 116–170  → zona direita (NA, prof. total)

    const CX     = 85;  // centro do tubo
    const TW     = 16;  // tubo interno
    const CW     = 46;  // casing / bentonita
    const tL     = CX - TW / 2;   // 77
    const tR     = CX + TW / 2;   // 93
    const cL     = CX - CW / 2;   // 62
    const txtS   = (c: string) => `position:absolute;font-size:8px;font-weight:bold;color:${c};z-index:14;white-space:nowrap;text-shadow:0 0 2px #fff,0 0 2px #fff;`;

    let cHTML = "";

    if (hasWell) {
      const yF = getY(profTotal);

      // Bentonita (selo de topo)
      if (!isNaN(preFiltroTopo)) {
        const hBen = getY(preFiltroTopo) - TOP_OFFSET;
        if (hBen > 0) cHTML += `<div style="position:absolute;left:${cL}px;width:${CW}px;top:${TOP_OFFSET}px;height:${hBen}px;background-color:#c98a51;border-left:1px solid #555;border-right:1px solid #555;z-index:4;"></div>`;
        // Pré-filtro
        const yPF = getY(preFiltroTopo);
        const hPF = yF - yPF;
        if (hPF > 0) cHTML += `<div style="position:absolute;left:${cL}px;width:${CW}px;top:${yPF}px;height:${hPF}px;background-color:#fce663;background-image:url(${TILE.areia});background-size:6px 6px;background-repeat:repeat;border-left:1px solid #555;border-right:1px solid #555;border-bottom:1px solid #555;z-index:4;"></div>`;
      }

      // Tampão superior + tubo liso
      if (!isNaN(filtroTopo)) {
        cHTML += `<div style="position:absolute;left:${tL - 7}px;width:${TW + 14}px;top:0;height:10px;background-color:#777;border:1.5px solid #333;z-index:6;"></div>`;
        const hLiso = getY(filtroTopo) - 10;
        if (hLiso > 0) cHTML += `<div style="position:absolute;left:${tL}px;width:${TW}px;top:10px;height:${hLiso}px;background-color:#fff;border-left:1.5px solid #333;border-right:1.5px solid #333;z-index:5;"></div>`;
      }

      if (!isNaN(filtroTopo) && !isNaN(filtroBase)) {
        const yTF = getY(filtroTopo), yBF = getY(filtroBase);

        // Seção filtrante ranhurada
        cHTML += `<div style="position:absolute;left:${tL}px;width:${TW}px;top:${yTF}px;height:${yBF - yTF}px;background-color:#fff;background-image:url(${TILE.filtro});background-size:1px 4px;background-repeat:repeat;border-left:1.5px solid #333;border-right:1.5px solid #333;z-index:5;"></div>`;

        // Tubo liso abaixo + tampa
        const hAb = yF - yBF;
        if (hAb > 0) cHTML += `<div style="position:absolute;left:${tL}px;width:${TW}px;top:${yBF}px;height:${hAb}px;background-color:#fff;border-left:1.5px solid #333;border-right:1.5px solid #333;z-index:5;"></div>`;
        cHTML += `<div style="position:absolute;left:${tL}px;width:${TW}px;top:${yF - 5}px;height:5px;background-color:#333;z-index:6;"></div>`;

        // Labels seção filtrante — ESQUERDA
        cHTML += `<div style="position:absolute;left:0;width:${tL - 2}px;top:${yTF}px;border-top:0.5px dashed #666;z-index:11;"></div>`;
        cHTML += `<div style="${txtS("#444")}left:2px;top:${yTF - 12}px;">Início filtro<br/>${filtroTopo}m</div>`;
        cHTML += `<div style="position:absolute;left:0;width:${tL - 2}px;top:${yBF}px;border-top:0.5px dashed #666;z-index:11;"></div>`;
        cHTML += `<div style="${txtS("#444")}left:2px;top:${yBF + 2}px;">Fim filtro<br/>${filtroBase}m</div>`;

        // Prof. total — DIREITA
        cHTML += `<div style="position:absolute;left:${tR + 2}px;width:${170 - tR - 2}px;top:${yF}px;border-top:0.5px dashed #666;z-index:11;"></div>`;
        cHTML += `<div style="${txtS("#444")}left:${tR + 4}px;top:${yF + 2}px;">${profTotal}m</div>`;
      }
    }

    // NA — linha azul tracejada + label direita
    if (!isNaN(nivelAgua)) {
      const yNA = getY(nivelAgua);
      cHTML += `<div style="position:absolute;left:0;width:170px;top:${yNA}px;border-top:2px dashed #1d6fd8;z-index:12;"></div>`;
      cHTML += `<div style="${txtS("#1d6fd8")}left:${tR + 4}px;top:${yNA - 12}px;">NA: ${nivelAgua}m</div>`;
    }

    // ── LEGENDA (solos presentes) ──────────────────────────────────────────
    const uniqueTypes = [...new Set(layers.map(l => l.tipo).filter(Boolean))];
    const legendItems = uniqueTypes.map(tipo => {
      const st = soloStyle(tipo);
      return `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
        <div style="width:22px;height:13px;border:0.5px solid #888;flex-shrink:0;${st}"></div>
        <span style="font-size:8.5px;color:#333;">${tipo}</span>
      </div>`;
    }).join("");

    const hasLegend = uniqueTypes.length > 0;

    // ── METADADOS ─────────────────────────────────────────────────────────
    const nom   = data.nomenclatura_poco?.trim();
    const sond  = data.nome_sondagem?.trim();
    const ident = (nom && sond) ? `${nom} / ${sond}` : nom || sond || "—";

    const meta = (label: string, val: string) => `
      <div style="padding:6px 10px;border-right:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0;min-width:0;">
        <div style="font-size:7px;font-weight:700;color:#80b02d;text-transform:uppercase;letter-spacing:0.6px;">${label}</div>
        <div style="font-size:10px;font-weight:600;color:#222;margin-top:2px;">${val || "—"}</div>
      </div>`;

    const now = new Date().toLocaleString("pt-BR");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${PAGE_W}px; background: #fff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; }
  .page { width: ${PAGE_W}px; padding: ${PAD}px; }

  /* ── header ── */
  .hdr { display: flex; border: 2px solid #391e2a; border-radius: 4px 4px 0 0; overflow: hidden; }
  .hdr-logo { width: 130px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 10px; background: #fff; border-right: 2px solid #391e2a; }
  .hdr-body { flex: 1; display: flex; flex-direction: column; }
  .hdr-title { background: #391e2a; color: #fff; text-align: center; padding: 9px 12px; font-size: 13px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; border-bottom: 3px solid #80b02d; }
  .hdr-sub { display: grid; grid-template-columns: repeat(3, 1fr); border-top: none; }
  .hdr-cell { padding: 7px 12px; border-right: 1px solid #ddd; }
  .hdr-cell:last-child { border-right: none; }
  .hdr-lbl { font-size: 7.5px; font-weight: 700; color: #391e2a; text-transform: uppercase; letter-spacing: 0.5px; }
  .hdr-val { font-size: 10.5px; font-weight: 600; margin-top: 2px; }

  /* ── meta grid ── */
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); border: 2px solid #391e2a; border-top: none; border-radius: 0 0 4px 4px; margin-bottom: 10px; background: #fafafa; }

  /* ── profile table ── */
  .ptbl { border: 2px solid #391e2a; border-radius: 4px; overflow: hidden; }
  .ptbl-head { display: flex; background: #391e2a; }
  .ptbl-hcell { display: flex; align-items: center; justify-content: center; text-align: center; padding: 9px 4px; color: #fff; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; border-right: 1px solid rgba(255,255,255,0.15); }
  .ptbl-hcell:last-child { border-right: none; }
  .ptbl-body { position: relative; }
  .ptbl-row { display: flex; border-bottom: 0.5px solid #ccc; }
  .ptbl-row:last-child { border-bottom: none; }

  /* cells */
  .c-prof { width: ${C_PROF}px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 5px 6px; border-right: 0.5px solid #ccc; font-size: 9.5px; color: #555; font-weight: 600; }
  .c-perf { width: ${C_PERF}px; flex-shrink: 0; border-right: 0.5px solid #ccc; }
  .c-desc { flex: 1; min-width: 0; display: flex; align-items: center; padding: 10px 14px; gap: 12px; border-right: 0.5px solid #ccc; }
  .c-voc  { width: ${C_VOC}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #5a8a1e; }
  .desc-swatch { width: 26px; height: 26px; flex-shrink: 0; border: 0.5px solid #888; border-radius: 3px; }
  .desc-text { flex: 1; min-width: 0; }
  .desc-tipo { font-size: 11.5px; font-weight: 800; color: #391e2a; text-transform: uppercase; word-break: break-word; }
  .desc-obs  { font-size: 9px; color: #666; margin-top: 3px; word-break: break-word; }

  /* ── legend ── */
  .legend { margin-top: 10px; border: 1.5px solid #391e2a; border-radius: 4px; overflow: hidden; }
  .legend-title { background: #391e2a; color: #fff; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 5px 10px; border-bottom: 2px solid #80b02d; }
  .legend-body { display: flex; flex-wrap: wrap; gap: 0; padding: 8px 10px; background: #fafafa; }

  /* ── footer ── */
  .footer { margin-top: 10px; padding-top: 7px; border-top: 2px solid #80b02d; display: flex; justify-content: space-between; align-items: flex-start; }
  .footer-l { font-size: 7px; color: #aaa; line-height: 1.6; }
  .footer-r { font-size: 7px; color: #aaa; text-align: right; line-height: 1.6; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="hdr">
    <div class="hdr-logo">
      ${logoBase64 ? `<img src="${logoBase64}" style="max-width:105px;max-height:48px;object-fit:contain;" />` : `<span style="font-size:13px;font-weight:900;color:#391e2a;">GREENSOIL</span>`}
    </div>
    <div class="hdr-body">
      <div class="hdr-title">Perfil Técnico e Descritivo de Sondagem</div>
      <div class="hdr-sub">
        <div class="hdr-cell">
          <div class="hdr-lbl">Poço / Sondagem</div>
          <div class="hdr-val">${ident}</div>
        </div>
        <div class="hdr-cell">
          <div class="hdr-lbl">Método de Sondagem</div>
          <div class="hdr-val">${data.tipo_sondagem || "—"}</div>
        </div>
        <div class="hdr-cell" style="border-right:none;">
          <div class="hdr-lbl">Elaborado por</div>
          <div class="hdr-val">GreenSoil do Brasil</div>
        </div>
      </div>
    </div>
  </div>

  <!-- METADATA GRID -->
  <div class="meta">
    ${meta("Data", data.data || "—")}
    ${meta("Nível d'Água (NA)", data.nivel_agua ? data.nivel_agua + " m" : "—")}
    ${meta("Profundidade Total", data.profundidade_total ? data.profundidade_total + " m" : "—")}
    ${meta("Cota / Altitude", data.cota ? data.cota + " m" : "—")}
    ${meta("UTM Este (X)", data.coord_x || "—")}
    ${meta("UTM Norte (Y)", data.coord_y || "—")}
    ${meta("Zona UTM", data.utm_zona || "—")}
    ${meta("Ø Instalação / Sondagem", `${data.diametro_poco || "—"} / ${data.diametro_sondagem || "—"}`)}
  </div>

  <!-- PROFILE TABLE -->
  <div class="ptbl">
    <div class="ptbl-head">
      <div class="ptbl-hcell" style="width:${C_PROF}px;">Prof.<br/>(m)</div>
      <div class="ptbl-hcell" style="width:${C_PERF}px;">Perfil Geológico<br/>e Construtivo</div>
      <div class="ptbl-hcell" style="flex:1;">Descrição Litológica</div>
      <div class="ptbl-hcell" style="width:${C_VOC}px;">VOC<br/>(ppm)</div>
    </div>

    <div class="ptbl-body">
      <!-- Overlay do construtivo posicionado sobre a coluna de perfil -->
      <div style="position:absolute;top:0;left:${C_PROF}px;width:${C_PERF}px;height:${profileH}px;pointer-events:none;z-index:10;overflow:visible;">
        ${cHTML}
      </div>

      ${hasWell ? `
        <div class="ptbl-row" style="height:${TOP_OFFSET}px;background:#fff;border-bottom:1.5px solid #391e2a;">
          <div class="c-prof"></div>
          <div class="c-perf"></div>
          <div class="c-desc"></div>
          <div class="c-voc"></div>
        </div>` : ""}

      ${layers.map((l, i) => {
        const rH  = rowHeights[i];
        const st  = soloStyle(l.tipo);
        const alt = i % 2 === 0 ? "#fff" : "#fafafa";
        return `
        <div class="ptbl-row" style="height:${rH}px;">
          <div class="c-prof"><span>${l.de}</span><span>${l.ate}</span></div>
          <div class="c-perf" style="${st}"></div>
          <div class="c-desc" style="background:${alt};">
            <div class="desc-swatch" style="${st}"></div>
            <div class="desc-text">
              <div class="desc-tipo">${(l.tipo || "N/A").toUpperCase()}</div>
              ${l.coloracao ? `<div class="desc-obs">Obs.: ${l.coloracao}</div>` : ""}
            </div>
          </div>
          <div class="c-voc" style="background:${alt};">${l.leitura_voc || "—"}</div>
        </div>`;
      }).join("")}

      ${hasWell ? `
        <div class="ptbl-row" style="height:60px;background:#fff;border-bottom:none;">
          <div class="c-prof"></div>
          <div class="c-perf"></div>
          <div class="c-desc"></div>
          <div class="c-voc"></div>
        </div>` : ""}
    </div>
  </div>

  ${hasLegend ? `
  <!-- LEGEND -->
  <div class="legend">
    <div class="legend-title">Legenda — Tipos de Solo Identificados</div>
    <div class="legend-body">
      ${legendItems}
    </div>
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-l">
      GreenSoil do Brasil LTDA &nbsp;·&nbsp; CNPJ: 29.088.151/0001-25<br>
      Documento gerado eletronicamente em ${now}
    </div>
    <div class="footer-r">
      ${ident}<br>
      Perfil Técnico de Sondagem
    </div>
  </div>

</div>
</body>
</html>`;
  }

  // ─── gerador principal (html2canvas → jsPDF, idêntico ao Puppeteer) ─────

  async function gerarPDF() {
    if (!data) return;

    try {
      // 1. Busca a logo como base64 para embutir no HTML
      let logoB64 = "";
      try { logoB64 = await fetchLogoBase64("/logo.png"); } catch (_) {}

      // 2. Gera o HTML idêntico ao que o Puppeteer usava
      const html = buildProfileHTML(logoB64);

      // 3. Renderiza o HTML completo num iframe oculto (mantém CSS intacto)
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;top:-99999px;left:-99999px;width:794px;height:2000px;border:none;visibility:hidden;";
      document.body.appendChild(iframe);

      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        iframe.srcdoc = html;
      });

      // Aguarda imagens e fontes carregarem
      await new Promise(r => setTimeout(r, 800));

      // Ajusta altura do iframe ao conteúdo real
      const iframeDoc = iframe.contentDocument!;
      const contentH = iframeDoc.documentElement.scrollHeight;
      iframe.style.height = contentH + "px";
      await new Promise(r => setTimeout(r, 200));

      // 4. Captura com html2canvas em alta resolução (scale 3 ≈ 300dpi)
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(iframeDoc.body, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
      });

      document.body.removeChild(iframe);

      // 5. Monta o PDF A4, distribuindo em páginas se necessário
      const pdf      = new jsPDF("p", "mm", "a4");
      const pageW    = pdf.internal.pageSize.getWidth();
      const pageH    = pdf.internal.pageSize.getHeight();
      const imgData  = canvas.toDataURL("image/jpeg", 0.97);
      const imgW     = pageW;
      const imgH     = (canvas.height / canvas.width) * imgW;

      let remaining = imgH;
      let offsetY   = 0;

      while (remaining > 0) {
        pdf.addImage(imgData, "JPEG", 0, -offsetY, imgW, imgH);
        remaining -= pageH;
        offsetY   += pageH;
        // Só cria nova página se sobrar conteúdo significativo (mais de 30mm)
        if (remaining > 30) pdf.addPage();
      }

      const nom   = data.nomenclatura_poco?.trim();
      const sond  = data.nome_sondagem?.trim();
      const ident = (nom && sond) ? `${nom}_${sond}` : nom || sond || "Sondagem";
      pdf.save(`Perfil_${ident.replace(/[/\\:*?"<>|]/g, "-")}.pdf`);

    } catch (error) {
      console.error(error);
      alert("Erro ao exportar PDF. Verifique o console.");
    }
  }

  if (loading) return <AdminShell><p className="p-10 text-center text-gray-500">Carregando...</p></AdminShell>;
  if (!data) return <AdminShell><p className="p-10 text-center text-red-500">Perfil não encontrado.</p></AdminShell>;

  // ================= RENDERIZAÇÃO PRINCIPAL =================
  return (
    <AdminShell>
      <div className="bg-gray-50 min-h-screen pb-12">
        
        {/* HEADER */}
        <div className="bg-[#391e2a] text-white px-10 py-8 shadow-md transition-all">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold">{isEditing ? "Modo Edição" : "Visualização do Perfil"}</h1>
              <p className="opacity-80 mt-1">Poço/Sondagem: {data.nomenclatura_poco ? `${data.nomenclatura_poco} / ${data.nome_sondagem}` : data.nome_sondagem}</p>
            </div>
            
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <Button onClick={cancelEditing} variant="outline" className="text-[#391e2a] bg-white hover:bg-gray-100 font-bold px-6 h-12">
                    Cancelar
                  </Button>
                  <Button onClick={saveChanges} disabled={saving} className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold px-8 h-12 shadow-lg">
                    {saving ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={startEditing} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-6 h-12 backdrop-blur-sm">
                    Editar Perfil
                  </Button>
                  <Button onClick={gerarPDF} className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold px-8 h-12 shadow-lg">
                    Baixar PDF
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* MODO EDIÇÃO VS MODO LEITURA */}
        <div className="max-w-6xl mx-auto mt-10 px-6">
          {isEditing ? (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="grid md:grid-cols-3 gap-6">
                
                <Section title="Dados da Sondagem">
                  <div className="space-y-4">
                    <EditInput label="Nomenclatura do poço" value={editForm.nomenclatura_poco} onChange={(v) => handleFieldChange("nomenclatura_poco", v)} />
                    <EditInput label="Sondagem" value={editForm.nome_sondagem} onChange={(v) => handleFieldChange("nome_sondagem", v)} />
                    <EditInput label="Tipo" value={editForm.tipo_sondagem} onChange={(v) => handleFieldChange("tipo_sondagem", v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <EditInput label="Data" type="date" value={editForm.data} onChange={(v) => handleFieldChange("data", v)} />
                      <EditInput label="Hora" type="time" value={editForm.hora} onChange={(v) => handleFieldChange("hora", v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <EditInput label="Nível d'água (m)" type="number" value={editForm.nivel_agua} onChange={(v) => handleFieldChange("nivel_agua", v)} />
                      <EditInput label="Prof. Total (m)" type="number" value={editForm.profundidade_total} onChange={(v) => handleFieldChange("profundidade_total", v)} />
                    </div>
                  </div>
                </Section>

                <Section title="Dados de Instalação">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <EditInput label="Ø Sondagem" value={editForm.diametro_sondagem} onChange={(v) => handleFieldChange("diametro_sondagem", v)} />
                      <EditInput label="Ø Poço" value={editForm.diametro_poco} onChange={(v) => handleFieldChange("diametro_poco", v)} />
                    </div>
                    <EditInput label="Pré-filtro (m)" type="number" value={editForm.pre_filtro} onChange={(v) => handleFieldChange("pre_filtro", v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <EditInput label="Filtro Topo (m)" type="number" value={editForm.secao_filtrante_topo} onChange={(v) => handleFieldChange("secao_filtrante_topo", v)} />
                      <EditInput label="Filtro Base (m)" type="number" value={editForm.secao_filtrante_base} onChange={(v) => handleFieldChange("secao_filtrante_base", v)} />
                    </div>
                  </div>
                </Section>

                <Section title="Geolocalização">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <EditInput label="UTM Este (X)" value={editForm.coord_x} onChange={(v) => handleFieldChange("coord_x", v)} />
                      <EditInput label="UTM Norte (Y)" value={editForm.coord_y} onChange={(v) => handleFieldChange("coord_y", v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <EditInput label="Zona UTM" value={editForm.utm_zona} onChange={(v) => handleFieldChange("utm_zona", v)} />
                      <EditInput label="Cota / Alt. (m)" type="number" value={editForm.cota} onChange={(v) => handleFieldChange("cota", v)} />
                    </div>
                  </div>
                </Section>
              </div>

              <Section title="Planilha de Camadas Estratigráficas">
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm border-collapse text-left bg-white">
                    <thead>
                      <tr className="bg-[#391e2a]/5 border-b border-gray-200">
                        <th className="p-3 font-bold text-[#391e2a] text-xs">De (m)</th>
                        <th className="p-3 font-bold text-[#391e2a] text-xs">Até (m)</th>
                        <th className="p-3 font-bold text-[#391e2a] text-xs w-[30%]">Tipo de Solo</th>
                        <th className="p-3 font-bold text-[#391e2a] text-xs">Observações</th>
                        <th className="p-3 font-bold text-[#391e2a] text-xs">VOC (ppm)</th>
                        <th className="p-3 font-bold text-[#391e2a] text-xs text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editLayers.map((layer, index) => (
                        <tr key={index} className="hover:bg-gray-50/50">
                          <td className="p-2"><input type="number" className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-[#80b02d]" value={layer.de} onChange={(e) => handleLayerChange(index, "de", e.target.value)} /></td>
                          <td className="p-2"><input type="number" className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-[#80b02d]" value={layer.ate} onChange={(e) => handleLayerChange(index, "ate", e.target.value)} /></td>
                          <td className="p-2">
                            <select className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-[#80b02d]" value={layer.tipo} onChange={(e) => handleLayerChange(index, "tipo", e.target.value)}>
                              <option value="">Selecione...</option>
                              {tiposSolo.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </td>
                          <td className="p-2"><input type="text" className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-[#80b02d]" value={layer.coloracao || ""} onChange={(e) => handleLayerChange(index, "coloracao", e.target.value)} /></td>
                          <td className="p-2"><input type="number" className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-[#80b02d]" value={layer.leitura_voc || ""} onChange={(e) => handleLayerChange(index, "leitura_voc", e.target.value)} /></td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeLayer(index)} className="text-red-400 hover:text-red-600 font-bold p-2 bg-red-50 rounded-md">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button onClick={addLayer} variant="outline" className="w-full mt-4 border-dashed border-2 text-[#391e2a] font-bold">
                  + Adicionar Nova Linha
                </Button>
              </Section>
            </div>
          ) : (
            // === MODO LEITURA (VISUALIZAÇÃO NORMAL) ===
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid md:grid-cols-3 gap-6">
                <Section title="Dados da Sondagem">
                  <Grid>
                    <Info label="Nomenclatura do poço" value={data.nomenclatura_poco} />
                    <Info label="Sondagem" value={data.nome_sondagem} />
                    <Info label="Tipo" value={data.tipo_sondagem} />
                    <Info label="Data" value={data.data} />
                    <Info label="Hora" value={data.hora} />
                    <Info label="Nível d’água" value={data.nivel_agua ? `${data.nivel_agua} m` : "-"} />
                    <Info label="Profundidade Total" value={`${data.profundidade_total} m`} />
                  </Grid>
                </Section>
                <Section title="Dados de Instalação">
                  <Grid>
                    <Info label="Ø Sondagem" value={data.diametro_sondagem} />
                    <Info label="Ø Poço" value={data.diametro_poco} />
                    <Info label="Pré-filtro" value={data.pre_filtro ? `${data.pre_filtro} m` : "-"} />
                    <Info label="Seção Filtrante" value={`${data.secao_filtrante_topo ?? "-"} a ${data.secao_filtrante_base ?? "-"} m`} />
                  </Grid>
                </Section>
                <Section title="Geolocalização">
                  <Grid>
                    <Info label="Este (X)" value={data.coord_x} />
                    <Info label="Norte (Y)" value={data.coord_y} />
                    <Info label="Zona UTM" value={data.utm_zona} />
                    <Info label="Cota / Alt." value={data.cota ? `${data.cota} m` : "-"} />
                  </Grid>
                </Section>
              </div>

              <Section title="Camadas Estratigráficas">
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm border-collapse text-left bg-white">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">De (m)</th>
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">Até (m)</th>
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">Tipo de Solo</th>
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">Observações</th>
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">VOC (ppm)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {layers.map((layer, index) => (
                        <tr key={index} className="hover:bg-gray-50/50 transition">
                          <td className="p-4 text-gray-700">{layer.de}</td>
                          <td className="p-4 text-gray-700">{layer.ate}</td>
                          <td className="p-4 font-medium text-[#391e2a]">{layer.tipo}</td>
                          <td className="p-4 text-gray-600">{layer.coloracao || "-"}</td>
                          <td className="p-4 text-[#80b02d] font-bold">{layer.leitura_voc || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

// === COMPONENTES DE UI COMPARTILHADOS ===

function Section({ title, children }: any) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 h-full">
      <h2 className="text-sm font-extrabold text-[#391e2a] uppercase tracking-wider mb-5">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Grid({ children }: any) {
  return <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-sm">{children}</div>;
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold text-gray-400 tracking-wide uppercase mb-1">{label}</span>
      <span className="font-semibold text-gray-800">{value || "-"}</span>
    </div>
  );
}

function EditInput({ label, value, onChange, type = "text" }: { label: string, value: string, onChange: (v: string) => void, type?: string }) {
  return (
    <div className="flex flex-col">
      <label className="text-[11px] font-bold text-gray-400 tracking-wide uppercase mb-1">{label}</label>
      <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none" />
    </div>
  );
}