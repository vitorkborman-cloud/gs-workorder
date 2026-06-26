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

  // ─── gerador de HTML (idêntico ao Puppeteer) ─────────────────────────────

  function buildProfileHTML(logoBase64: string): string {
    const ESCALA = 45;
    const preFiltroTopo = parseFloat(data.pre_filtro);
    const filtroTopo    = parseFloat(data.secao_filtrante_topo);
    const filtroBase    = parseFloat(data.secao_filtrante_base);
    const nivelAgua     = parseFloat(data.nivel_agua);
    const hasWell       = !isNaN(filtroTopo) || !isNaN(preFiltroTopo);
    const TOP_OFFSET    = hasWell ? 18 : 0;

    const getY = (depth: number | string) => {
      let y = TOP_OFFSET;
      let d = parseFloat(String(depth));
      if (isNaN(d)) return TOP_OFFSET;
      for (const l of layers) {
        const de  = parseFloat(String(l.de));
        const ate = parseFloat(String(l.ate));
        const hOrig      = (ate - de) * ESCALA;
        const hStretched = Math.max(40, hOrig);
        if (d <= de) break;
        if (d >= ate) y += hStretched;
        else { y += ((d - de) / (ate - de)) * hStretched; break; }
      }
      return y;
    };

    const getEstiloSolo = (tipo: string) => {
      if (!tipo) return "background-color: #f0f0f0;";
      const t = tipo.toLowerCase().trim();
      let bgColor = "#e0e0e0";
      if (t.includes("brita") || t.includes("rach") || t.includes("concreto") || t.includes("cascalho")) bgColor = "#cccccc";
      else if (t.includes("aterro") || t.includes("orgânica") || t.includes("turfa")) bgColor = "#8b7355";
      else if (t.startsWith("areia")) bgColor = t.includes("argil") ? "#E6C27A" : t.includes("silt") ? "#EEDD82" : "#FCE663";
      else if (t.startsWith("silte")) bgColor = t.includes("aren") ? "#D1B280" : t.includes("argil") ? "#B88655" : "#C19A6B";
      else if (t.startsWith("argila")) bgColor = t.includes("aren") ? "#CC6B58" : t.includes("silt") ? "#B86554" : "#D47A6A";

      const texturas: string[] = [], sizes: string[] = [];
      if (t.includes("brita") || t.includes("rach") || t.includes("cascalho")) {
        texturas.push("radial-gradient(circle at 30% 30%, #777 20%, transparent 22%)", "radial-gradient(circle at 70% 70%, #666 22%, transparent 24%)");
        const size = t.includes("rach") ? "24px 24px" : "14px 14px";
        sizes.push(size, size);
      }
      if (t.includes("areia") || t.includes("arenos")) {
        texturas.push("radial-gradient(circle, rgba(0,0,0,0.35) 1px, transparent 1px)");
        sizes.push("6px 6px");
      }
      if (t.includes("argila") || t.includes("argilos")) {
        texturas.push("repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(0,0,0,0.2) 6px, rgba(0,0,0,0.2) 7px)");
        sizes.push("100% 100%");
      }
      if (t.includes("silte") || t.includes("siltos")) {
        texturas.push("repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.15) 5px, rgba(0,0,0,0.15) 6px)");
        sizes.push("100% 100%");
      }
      return `background-color: ${bgColor};${texturas.length ? ` background-image: ${texturas.join(", ")}; background-size: ${sizes.join(", ")};` : ""}`;
    };

    const profTotal = parseFloat(data.profundidade_total) || (layers.length ? parseFloat(String(layers[layers.length - 1].ate)) : 10);
    let construtivoHTML = "";

    if (hasWell) {
      const leftPoco = 65, widthPoco = 50, leftTubo = 80, widthTubo = 20;
      const yF = getY(profTotal);
      if (!isNaN(preFiltroTopo)) {
        const ySolo = getY(0), hBentonita = getY(preFiltroTopo) - ySolo;
        construtivoHTML += `<div style="position:absolute;left:${leftPoco}px;width:${widthPoco}px;top:${ySolo}px;height:${hBentonita}px;background-color:#c98a51;border-left:0.5px solid #333;border-right:0.5px solid #333;z-index:4;"></div>`;
        const hPreFiltro = yF - getY(preFiltroTopo);
        construtivoHTML += `<div style="position:absolute;left:${leftPoco}px;width:${widthPoco}px;top:${getY(preFiltroTopo)}px;height:${hPreFiltro}px;background-color:#fce663;background-image:radial-gradient(black 1px,transparent 1px);background-size:6px 6px;border-left:0.5px solid #333;border-right:0.5px solid #333;border-bottom:0.5px solid #333;z-index:4;"></div>`;
      }
      if (!isNaN(filtroTopo)) {
        construtivoHTML += `<div style="position:absolute;left:${leftTubo - 8}px;width:${widthTubo + 16}px;top:0;height:10px;background-color:#888;border:1.5px solid #333;z-index:6;"></div>`;
        construtivoHTML += `<div style="position:absolute;left:${leftTubo}px;width:${widthTubo}px;top:10px;height:${getY(filtroTopo) - 10}px;background-color:white;border:1.5px solid #333;border-top:none;z-index:5;"></div>`;
      }
      if (!isNaN(filtroTopo) && !isNaN(filtroBase)) {
        const yTF = getY(filtroTopo), yBF = getY(filtroBase);
        construtivoHTML += `<div style="position:absolute;left:${leftTubo}px;width:${widthTubo}px;top:${yTF}px;height:${yBF - yTF}px;background-color:white;background-image:repeating-linear-gradient(0deg,transparent,transparent 3px,#333 3px,#333 4px);border:1.5px solid #333;border-top:none;border-bottom:none;z-index:5;"></div>`;
        construtivoHTML += `<div style="position:absolute;left:115px;width:10px;top:${yTF}px;border-top:0.5px dashed #333;z-index:10;"></div><div style="position:absolute;left:128px;top:${yTF - 8}px;background-color:white;border:0.5px solid #333;padding:2px 4px;font-size:9px;font-weight:bold;border-radius:3px;z-index:11;">${filtroTopo}m</div>`;
        construtivoHTML += `<div style="position:absolute;left:115px;width:10px;top:${yBF}px;border-top:0.5px dashed #333;z-index:10;"></div><div style="position:absolute;left:128px;top:${yBF - 8}px;background-color:white;border:0.5px solid #333;padding:2px 4px;font-size:9px;font-weight:bold;border-radius:3px;z-index:11;">${filtroBase}m</div>`;
        if (getY(profTotal) - yBF > 0) construtivoHTML += `<div style="position:absolute;left:${leftTubo}px;width:${widthTubo}px;top:${yBF}px;height:${getY(profTotal) - yBF}px;background-color:white;border:1.5px solid #333;border-top:none;border-bottom:none;z-index:5;"></div>`;
        construtivoHTML += `<div style="position:absolute;left:${leftTubo}px;width:${widthTubo}px;top:${getY(profTotal) - 5}px;height:5px;background-color:#333;z-index:6;"></div>`;
        const dS = data.diametro_sondagem || "Furo", dP = data.diametro_poco || "Tubo";
        construtivoHTML += `<div style="position:absolute;left:80px;width:20px;top:${yF}px;border-left:0.5px solid #333;border-right:0.5px solid #333;border-bottom:0.5px solid #333;height:8px;z-index:10;"></div><div style="position:absolute;left:90px;top:${yF + 11}px;transform:translateX(-50%);background-color:white;border:0.5px solid #333;padding:2px 4px;font-size:8px;font-weight:bold;z-index:11;white-space:nowrap;border-radius:2px;">Ø ${dP}</div>`;
        construtivoHTML += `<div style="position:absolute;left:65px;width:50px;top:${yF + 20}px;border-left:0.5px solid #333;border-right:0.5px solid #333;border-bottom:0.5px solid #333;height:8px;z-index:10;"></div><div style="position:absolute;left:90px;top:${yF + 31}px;transform:translateX(-50%);background-color:white;border:0.5px solid #333;padding:2px 4px;font-size:8px;font-weight:bold;z-index:11;white-space:nowrap;border-radius:2px;">Ø ${dS}</div>`;
      }
    }

    if (!isNaN(nivelAgua)) {
      const yNA = getY(nivelAgua);
      construtivoHTML += `<div style="position:absolute;left:10px;width:160px;top:${yNA}px;border-top:1.5px solid #005fcc;z-index:10;"></div><div style="position:absolute;left:25px;top:${yNA - 6}px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #005fcc;z-index:11;"></div><div style="position:absolute;left:12px;top:${yNA - 22}px;background-color:white;border:1px solid #005fcc;padding:2px 4px;color:#005fcc;font-size:10px;font-weight:bold;border-radius:3px;z-index:11;">NA: ${nivelAgua}m</div>`;
    }

    const nom  = data.nomenclatura_poco?.trim();
    const sond = data.nome_sondagem?.trim();
    const ident = (nom && sond) ? `${nom} / ${sond}` : nom || sond || "—";

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
      *, *::before, *::after { box-sizing: border-box; }
      :root { --escala: ${ESCALA}px; }
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; color: #333; background: white; }
      .header-main { width: 100%; border: 2px solid #391e2a; border-collapse: collapse; table-layout: fixed; }
      .header-main td { border: 1.5px solid #391e2a; padding: 6px 10px; vertical-align: middle; overflow: hidden; }
      .logo-cell { width: 160px; text-align: center; background-color: #fff; }
      .title-cell { background-color: #391e2a; color: white; text-align: center; }
      .title-cell h1 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
      .destaque { font-weight: bold; color: #391e2a; text-transform: uppercase; font-size: 9px; margin-right: 4px; }
      .valor { font-size: 11px; }
      .corpo-relatorio { display: flex; flex-direction: column; border: 2px solid #391e2a; border-top: none; }
      .linha-titulos { display: flex; background-color: #80b02d; color: white; font-weight: bold; text-align: center; border-bottom: 2px solid #391e2a; }
      .linha-titulos > div { padding: 10px 5px; border-right: 0.5px solid #391e2a; display: flex; align-items: center; justify-content: center; }
      .linha-titulos > div:last-child { border-right: none; }
      .linha-camada { display: flex; border-bottom: 0.5px solid #391e2a; }
      .celula { border-right: 0.5px solid #391e2a; display: flex; align-items: center; justify-content: center; }
      .celula:last-child { border-right: none; }
      .cel-prof { flex-direction: column; justify-content: space-between !important; padding: 4px 8px; color: #666; font-size: 10px; text-align: center; }
      .cel-voc { font-weight: bold; color: #80b02d; }
      .cel-desc { flex-direction: row !important; justify-content: flex-start !important; padding: 8px 12px; text-align: left; gap: 12px; }
      .desc-text-container { word-wrap: break-word; overflow-wrap: break-word; max-width: 380px; }
    </style></head><body>
      <table class="header-main">
        <tr>
          <td rowspan="3" class="logo-cell">${logoBase64 ? `<img src="${logoBase64}" style="max-width:140px;max-height:80px;" />` : "<b>GREENSOIL</b>"}</td>
          <td colspan="3" class="title-cell"><h1>Perfil Técnico e Descritivo de Sondagem</h1></td>
        </tr>
        <tr>
          <td style="width:25%;"><span class="destaque">Poço/Sondagem</span><br/><span class="valor">${ident}</span></td>
          <td style="width:25%;"><span class="destaque">MÉTODO:</span><br/><span class="valor">${data.tipo_sondagem || "—"}</span></td>
          <td style="width:50%;"><span class="destaque">COORDENADAS (UTM):</span><br/><span class="valor">X: ${data.coord_x || "—"} &nbsp;|&nbsp; Y: ${data.coord_y || "—"}<br/>Zona: ${data.utm_zona || "—"} &nbsp;|&nbsp; Cota: ${data.cota ? data.cota + " m" : "—"}</span></td>
        </tr>
        <tr>
          <td><span class="destaque">DATA:</span><br/><span class="valor">${data.data || "—"}</span></td>
          <td><span class="destaque">NÍVEL D'ÁGUA:</span><br/><span class="valor">${data.nivel_agua ? data.nivel_agua + " m" : "—"}</span></td>
          <td><span class="destaque">PROF. FINAL:</span><br/><span class="valor">${data.profundidade_total ? data.profundidade_total + " m" : "—"}</span></td>
        </tr>
      </table>
      <div class="corpo-relatorio">
        <div class="linha-titulos">
          <div style="width:65px;">Prof. (m)</div>
          <div style="width:65px;">VOC (ppm)</div>
          <div style="width:180px;">Perfil Geológico e Construtivo</div>
          <div style="flex:1;">Descrição Litológica</div>
        </div>
        <div style="position:relative;width:100%;">
          <div style="position:absolute;top:0;left:130px;width:180px;height:100%;pointer-events:none;z-index:10;">${construtivoHTML}</div>
          ${hasWell ? `<div class="linha-camada" style="height:${TOP_OFFSET}px;min-height:${TOP_OFFSET}px;border-bottom:2px solid #391e2a;background-color:#fff;"><div class="celula" style="width:65px;"></div><div class="celula" style="width:65px;"></div><div class="celula" style="width:180px;"></div><div class="celula" style="flex:1;"></div></div>` : ""}
          ${layers.map(l => {
            const esp = parseFloat(String(l.ate)) - parseFloat(String(l.de));
            const estilo = getEstiloSolo(l.tipo);
            return `<div class="linha-camada" style="min-height:max(40px,calc(${esp} * var(--escala)));">
              <div class="celula cel-prof" style="width:65px;"><span>${l.de}</span><span>${l.ate}</span></div>
              <div class="celula cel-voc" style="width:65px;">${l.leitura_voc || "—"}</div>
              <div class="celula" style="width:180px;${estilo}"></div>
              <div class="celula cel-desc" style="flex:1;">
                <div style="width:28px;height:28px;min-width:28px;border:0.5px solid #333;border-radius:4px;${estilo}"></div>
                <div class="desc-text-container" style="margin-left:12px;"><b style="color:#391e2a;font-size:13px;">${(l.tipo || "N/A").toUpperCase()}</b>${l.coloracao ? `<div style="margin-top:2px;color:#555;">Observações: ${l.coloracao}</div>` : ""}</div>
              </div>
            </div>`;
          }).join("")}
          ${hasWell ? `<div class="linha-camada" style="height:55px;min-height:55px;background-color:#fff;border-bottom:none;"><div class="celula" style="width:65px;"></div><div class="celula" style="width:65px;"></div><div class="celula" style="width:180px;"></div><div class="celula" style="flex:1;"></div></div>` : ""}
        </div>
      </div>
    </body></html>`;
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
        // posiciona a imagem deslocada para mostrar a fatia correta
        pdf.addImage(imgData, "JPEG", 0, -offsetY, imgW, imgH);
        remaining -= pageH;
        offsetY   += pageH;
        if (remaining > 0) pdf.addPage();
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