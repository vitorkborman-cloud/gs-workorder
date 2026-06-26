"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AdminShell from "../../../../../components/layout/AdminShell";
import { Button } from "../../../../../components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

async function generateWhiteLogoBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
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

  // ─── helpers de canvas ────────────────────────────────────────────────────

  function soilColor(tipo: string): string {
    const t = tipo.toLowerCase();
    if (t.includes("concreto"))                      return "#cccccc";
    if (t.includes("rachão") || t.includes("rachao")) return "#888888";
    if (t.includes("brita") || t.includes("cascalho")) return "#aaaaaa";
    if (t.includes("aterro"))                        return "#8b7355";
    if (t.startsWith("argila")) {
      if (t.includes("aren"))  return "#cc6b58";
      if (t.includes("silt"))  return "#b86554";
      return "#d47a6a";
    }
    if (t.startsWith("silte")) {
      if (t.includes("aren"))  return "#d1b280";
      if (t.includes("argil")) return "#b88655";
      return "#c19a6b";
    }
    if (t.startsWith("areia")) {
      if (t.includes("argil")) return "#e6c27a";
      if (t.includes("silt"))  return "#eedd82";
      return "#fce663";
    }
    return "#e0e0e0";
  }

  function drawTexture(ctx: CanvasRenderingContext2D, tipo: string, x: number, y: number, w: number, h: number) {
    const t = tipo.toLowerCase();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    if (t.includes("areia") || t.includes("arenos")) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      for (let px = x + 3; px < x + w; px += 6)
        for (let py = y + 3; py < y + h; py += 6) {
          ctx.beginPath(); ctx.arc(px, py, 1, 0, Math.PI * 2); ctx.fill();
        }
    }
    if (t.includes("argila") || t.includes("argilos")) {
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 0.7;
      for (let py = y + 7; py < y + h; py += 7) {
        ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke();
      }
    }
    if (t.includes("silte") || t.includes("siltos")) {
      ctx.strokeStyle = "rgba(0,0,0,0.14)";
      ctx.lineWidth = 0.6;
      for (let d = 0; d < w + h; d += 6) {
        ctx.beginPath();
        ctx.moveTo(x + d, y);
        ctx.lineTo(x, y + d);
        ctx.stroke();
      }
    }
    if (t.includes("brita") || t.includes("rachão") || t.includes("concreto") || t.includes("cascalho")) {
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 1;
      for (let px = x + 10; px < x + w; px += 18)
        for (let py = y + 10; py < y + h; py += 18) {
          ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.stroke();
        }
    }
    ctx.restore();
  }

  function canvasWrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line.trim(), x, y);
        line = word + " ";
        y += lh;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), x, y);
  }

  // ─── gerador principal ────────────────────────────────────────────────────

  async function gerarPDF() {
    if (!data) return;

    try {
      // Logo branca
      let logoB64: string | null = null;
      try { logoB64 = await generateWhiteLogoBase64("/logo.png"); } catch (_) {}

      const pdf = new jsPDF("p", "mm", "a4");
      const pageW  = pdf.internal.pageSize.getWidth();
      const pageH  = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const purple: [number,number,number] = [57, 30, 42];
      const green:  [number,number,number] = [128, 176, 45];
      let Y = 0;

      const nom  = data.nomenclatura_poco?.trim();
      const sond = data.nome_sondagem?.trim();
      const ident = (nom && sond) ? `${nom} / ${sond}` : nom || sond || "Sondagem";

      // ── Cabeçalho ──
      pdf.setFillColor(...purple);
      pdf.rect(0, 0, pageW, 30, "F");
      pdf.setFillColor(...green);
      pdf.rect(0, 30, pageW, 1.5, "F");
      if (logoB64) pdf.addImage(logoB64, "PNG", margin, 9, 32, 10);
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12); pdf.setFont("helvetica", "bold");
      pdf.text("PERFIL TÉCNICO E DESCRITIVO DE SONDAGEM", pageW - margin, 13, { align: "right" });
      pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
      pdf.text(`Poço/Sondagem: ${ident}`, pageW - margin, 20, { align: "right" });
      pdf.text(`Data: ${data.data || "—"}   |   Método: ${data.tipo_sondagem || "—"}`, pageW - margin, 26, { align: "right" });
      pdf.setTextColor(0, 0, 0);
      Y = 40;

      // ── Tabela de metadados ──
      autoTable(pdf, {
        startY: Y,
        margin: { left: margin, right: margin },
        head: [["Poço / Sondagem", "Coord. UTM (X / Y / Zona)", "Cota", "Prof. Total", "NA"]],
        body: [[
          ident,
          `X: ${data.coord_x || "—"}  Y: ${data.coord_y || "—"}  Zona: ${data.utm_zona || "—"}`,
          data.cota ? `${data.cota} m` : "—",
          data.profundidade_total ? `${data.profundidade_total} m` : "—",
          data.nivel_agua ? `${data.nivel_agua} m` : "—",
        ]],
        theme: "grid",
        headStyles: { fillColor: purple, textColor: 255, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 1: { cellWidth: 60 } },
      });
      Y = (pdf as any).lastAutoTable.finalY + 8;

      // ── Desenho do perfil geológico em Canvas ──
      const SCALE  = 45;
      const C_PROF = 70, C_VOC = 65, C_PERF = 170, C_DESC = 330;
      const TOTAL_W = C_PROF + C_VOC + C_PERF + C_DESC;
      const HDR_H  = 36;

      // Calcula altura total
      let totalCanvasH = HDR_H;
      const layerHeights = layers.map(l => {
        const esp = parseFloat(String(l.ate)) - parseFloat(String(l.de));
        return Math.max(50, esp * SCALE);
      });
      layerHeights.forEach(h => totalCanvasH += h);
      totalCanvasH += 30; // espaço extra em baixo para construtivo

      const canvas = document.createElement("canvas");
      canvas.width  = TOTAL_W;
      canvas.height = totalCanvasH;
      const ctx = canvas.getContext("2d")!;

      // Fundo branco
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, TOTAL_W, totalCanvasH);

      // Cabeçalho das colunas
      const cols = [
        { x: 0,                        w: C_PROF, label: "Prof. (m)" },
        { x: C_PROF,                   w: C_VOC,  label: "VOC (ppm)" },
        { x: C_PROF + C_VOC,           w: C_PERF, label: "Perfil Geológico e Construtivo" },
        { x: C_PROF + C_VOC + C_PERF, w: C_DESC, label: "Descrição Litológica" },
      ];
      cols.forEach(col => {
        ctx.fillStyle   = "#80b02d";
        ctx.fillRect(col.x, 0, col.w, HDR_H);
        ctx.strokeStyle = "#391e2a";
        ctx.lineWidth   = 0.8;
        ctx.strokeRect(col.x, 0, col.w, HDR_H);
        ctx.fillStyle   = "#ffffff";
        ctx.font        = "bold 13px Arial";
        ctx.textAlign   = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(col.label, col.x + col.w / 2, HDR_H / 2);
      });

      // Camadas
      let curY = HDR_H;
      layers.forEach((layer, i) => {
        const rowH = layerHeights[i];
        const profX = C_PROF + C_VOC;

        // Cor + textura do solo
        ctx.fillStyle = soilColor(layer.tipo || "");
        ctx.fillRect(profX, curY, C_PERF, rowH);
        drawTexture(ctx, layer.tipo || "", profX, curY, C_PERF, rowH);

        // Bordas
        ctx.strokeStyle = "#391e2a";
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(0, curY, C_PROF, rowH);
        ctx.strokeRect(C_PROF, curY, C_VOC, rowH);
        ctx.strokeRect(profX, curY, C_PERF, rowH);
        ctx.strokeRect(profX + C_PERF, curY, C_DESC, rowH);

        // Profundidade
        ctx.fillStyle    = "#444444";
        ctx.font         = "12px Arial";
        ctx.textAlign    = "center";
        ctx.textBaseline = "top";
        ctx.fillText(String(layer.de),  C_PROF / 2, curY + 6);
        ctx.textBaseline = "bottom";
        ctx.fillText(String(layer.ate), C_PROF / 2, curY + rowH - 6);

        // VOC
        ctx.fillStyle    = "#5a8a1e";
        ctx.font         = "bold 13px Arial";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(layer.leitura_voc || "—", C_PROF + C_VOC / 2, curY + rowH / 2);

        // Descrição
        const descX = profX + C_PERF + 12;
        ctx.fillStyle    = "#391e2a";
        ctx.font         = "bold 13px Arial";
        ctx.textAlign    = "left";
        ctx.textBaseline = "top";
        canvasWrapText(ctx, (layer.tipo || "N/A").toUpperCase(), descX, curY + 12, C_DESC - 20, 17);

        if (layer.coloracao) {
          ctx.fillStyle = "#666666";
          ctx.font      = "11px Arial";
          canvasWrapText(ctx, `Obs: ${layer.coloracao}`, descX, curY + 34, C_DESC - 20, 15);
        }

        curY += rowH;
      });

      // Nível d'água
      const naVal = parseFloat(data.nivel_agua);
      if (!isNaN(naVal)) {
        let naY = HDR_H;
        for (let i = 0; i < layers.length; i++) {
          const de  = parseFloat(String(layers[i].de));
          const ate = parseFloat(String(layers[i].ate));
          const rH  = layerHeights[i];
          if (naVal >= de && naVal <= ate) { naY += ((naVal - de) / (ate - de)) * rH; break; }
          if (naVal > ate) naY += rH;
        }
        const profX = C_PROF + C_VOC;
        ctx.strokeStyle = "#005fcc";
        ctx.lineWidth   = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(profX, naY);
        ctx.lineTo(profX + C_PERF, naY);
        ctx.stroke();
        ctx.setLineDash([]);
        // seta
        ctx.fillStyle = "#005fcc";
        ctx.beginPath();
        ctx.moveTo(profX + 20, naY - 6);
        ctx.lineTo(profX + 26, naY);
        ctx.lineTo(profX + 20, naY + 6);
        ctx.fill();
        ctx.font      = "bold 11px Arial";
        ctx.fillStyle = "#005fcc";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`NA: ${naVal}m`, profX + 6, naY - 2);
      }

      // ── Incorpora o canvas no PDF ──
      const imgData = canvas.toDataURL("image/png", 1.0);
      const availW  = pageW - margin * 2;
      const imgH    = availW * (canvas.height / canvas.width);

      // Quebra de página se necessário
      if (Y + imgH > pageH - 20) {
        pdf.addPage();
        Y = 20;
      }

      // Se o perfil for muito alto, escala para caber
      const maxH = pageH - Y - 20;
      const finalH = Math.min(imgH, maxH);
      const finalW = finalH * (canvas.width / canvas.height);

      pdf.addImage(imgData, "PNG", margin, Y, finalW, finalH);

      // ── Rodapé em todas as páginas ──
      const totalPg = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPg; i++) {
        pdf.setPage(i);
        pdf.setFillColor(245, 245, 245);
        pdf.rect(0, pageH - 10, pageW, 10, "F");
        pdf.setFontSize(7);
        pdf.setTextColor(150);
        pdf.text("GreenSoil do Brasil LTDA   |   Documento gerado eletronicamente", margin, pageH - 3.5);
        pdf.text(`Página ${i} de ${totalPg}`, pageW - margin, pageH - 3.5, { align: "right" });
      }

      pdf.save(`Perfil_${ident.replace(/[/\\]/g, "-")}.pdf`);

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