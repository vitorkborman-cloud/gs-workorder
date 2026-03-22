"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AdminShell from "../../../../../components/layout/AdminShell";
import { Button } from "../../../../../components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  /* ================= CORES AUTOMÁTICAS E PDF (INTACTOS) ================= */
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

  async function gerarPDF() {
    if (!data) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const marginX = 15;

    const brandPurple: [number, number, number] = [57, 30, 42];
    const brandGreen: [number, number, number] = [128, 176, 45];

    // ================= PÁGINA 1 =================
    pdf.setFillColor(...brandPurple);
    pdf.rect(0, 0, pageWidth, 35, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("PERFIL DESCRITIVO DE SONDAGEM", pageWidth - marginX, 15, { align: "right" });
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${data.nome_sondagem} | Data: ${data.data || "-"}`, pageWidth - marginX, 22, { align: "right" });

    let currentY = 45;

    autoTable(pdf, {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      head: [["1. Dados da Sondagem", "2. Dados de Instalação", "3. Coordenadas"]],
      body: [[
        `Sondagem: ${data.nome_sondagem || "-"}\nData: ${data.data || "-"}\nHora: ${data.hora || "-"}\nTipo: ${data.tipo_sondagem || "-"}\nNível d'água: ${data.nivel_agua || "-"} m\nProf. total: ${data.profundidade_total || "-"} m`,
        `Ø Sondagem: ${data.diametro_sondagem || "-"} in\nØ Poço: ${data.diametro_poco || "-"} in\nPré-filtro: ${data.pre_filtro || "-"} m\nFiltro Topo: ${data.secao_filtrante_topo || "-"} m\nFiltro Base: ${data.secao_filtrante_base || "-"} m`,
        `Coord X:\n${data.coord_x || "-"}\n\nCoord Y:\n${data.coord_y || "-"}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: brandPurple, textColor: 255, fontStyle: "bold", fontSize: 10, cellPadding: 3 },
      styles: { fontSize: 9, cellPadding: 4, valign: 'top', textColor: 40 },
      columnStyles: { 
        0: { cellWidth: (pageWidth - marginX * 2) / 3 }, 
        1: { cellWidth: (pageWidth - marginX * 2) / 3 }, 
        2: { cellWidth: (pageWidth - marginX * 2) / 3 } 
      }
    });

    currentY = (pdf as any).lastAutoTable.finalY + 15;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...brandPurple);
    pdf.text("4. Camadas Estratigráficas", marginX, currentY);
    currentY += 5;

    autoTable(pdf, {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      head: [["De (m)", "Até (m)", "Tipo de Solo", "Coloração", "VOC (ppm)"]],
      body: layers.map(l => [
        l.de || "-", l.ate || "-", l.tipo || "-", l.coloracao || "-", l.leitura_voc ? `${l.leitura_voc}` : "-"
      ]),
      theme: 'striped',
      headStyles: { fillColor: brandGreen, textColor: 255, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 4, textColor: 60 },
      alternateRowStyles: { fillColor: [248, 248, 248] }
    });

    // ================= PÁGINA 2 =================
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...brandPurple);
    pdf.text("Representação Visual do Perfil", pageWidth / 2, 20, { align: "center" });

    const topo = 35;
    const alturaMax = 170;
    const larguraPerfil = 40;
    const centro = pageWidth / 2 - 35; 
    const esquerdaPerfil = centro - larguraPerfil / 2;
    const direitaPerfil = centro + larguraPerfil / 2;
    const profundidadeTotal = parseFloat(data.profundidade_total || "1");
    const escala = alturaMax / profundidadeTotal;

    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.setDrawColor(150);
    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
      const yEscala = topo + i * escala;
      pdf.line(esquerdaPerfil - 6, yEscala, esquerdaPerfil, yEscala);
      pdf.text(`${i.toFixed(1)} m`, esquerdaPerfil - 25, yEscala + 2);
    }

    layers.forEach((l) => {
      const de = parseFloat(l.de);
      const ate = parseFloat(l.ate);
      const altura = (ate - de) * escala;
      const yCamada = topo + de * escala;
      const [r, g, b] = gerarCor(l.tipo);

      pdf.setFillColor(r, g, b);
      pdf.rect(esquerdaPerfil, yCamada, larguraPerfil, altura, "F");

      const tipo = l.tipo.toLowerCase();
      if (tipo.includes("brita")) {
        const espacamento = 3; const raio = 0.6; pdf.setDrawColor(0);
        for (let yDot = yCamada + 2; yDot < yCamada + altura; yDot += espacamento) {
          for (let xDot = esquerdaPerfil + 2; xDot < esquerdaPerfil + larguraPerfil; xDot += espacamento) pdf.circle(xDot, yDot, raio);
        }
      }
      if (tipo.includes("rachão") || tipo.includes("rachao")) {
        const espacamento = 4; const raio = 1; pdf.setDrawColor(0);
        for (let yDot = yCamada + 2; yDot < yCamada + altura; yDot += espacamento) {
          for (let xDot = esquerdaPerfil + 2; xDot < esquerdaPerfil + larguraPerfil; xDot += espacamento) pdf.circle(xDot, yDot, raio);
        }
      }
      if (tipo.includes("siltosa")) {
        const espacamento = 2; const tamanhoX = 0.33; pdf.setDrawColor(0);
        for (let yDot = yCamada + 1; yDot < yCamada + altura; yDot += espacamento) {
          for (let xDot = esquerdaPerfil + 1; xDot < esquerdaPerfil + larguraPerfil; xDot += espacamento) {
            pdf.line(xDot - tamanhoX, yDot - tamanhoX, xDot + tamanhoX, yDot + tamanhoX);
            pdf.line(xDot - tamanhoX, yDot + tamanhoX, xDot + tamanhoX, yDot - tamanhoX);
          }
        }
      }
      if (tipo.includes("areia") || tipo.includes("arenoso") || tipo.includes("arenosa")) {
        let espacamento = 1; let raio = 0.15;
        if (tipo.includes("fina")) { espacamento = 1; raio = 0.1; }
        if (tipo.includes("grossa")) { espacamento = 1; raio = 0.3; }
        pdf.setFillColor(0, 0, 0);
        for (let yDot = yCamada + 1; yDot < yCamada + altura; yDot += espacamento) {
          for (let xDot = esquerdaPerfil + 1; xDot < esquerdaPerfil + larguraPerfil; xDot += espacamento) pdf.circle(xDot, yDot, raio, "F");
        }
      }

      if (l.leitura_voc && l.leitura_voc.trim() !== "") {
        const yCenter = yCamada + (altura / 2);
        pdf.setDrawColor(180);
        pdf.setLineWidth(0.3);
        pdf.line(direitaPerfil, yCenter, direitaPerfil + 4, yCenter);
        pdf.setFontSize(8);
        pdf.setTextColor(60, 60, 60);
        pdf.setFont("helvetica", "bold");
        pdf.text(`[${l.de} a ${l.ate}m]`, direitaPerfil + 6, yCenter - 1);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...brandGreen);
        pdf.text(`VOC: ${l.leitura_voc} ppm`, direitaPerfil + 6, yCenter + 3);
      }
    });

    pdf.setDrawColor(0);
    pdf.setLineWidth(0.5);
    pdf.rect(esquerdaPerfil, topo, larguraPerfil, alturaMax);

    let yLegenda = topo;
    pdf.setFontSize(8);
    pdf.setTextColor(80);

    layers.forEach((l) => {
      const de = parseFloat(l.de);
      const ate = parseFloat(l.ate);
      const [r, g, b] = gerarCor(l.tipo);
      const xLegenda = direitaPerfil + 45; 
      const tamanhoLegenda = 6;
      pdf.setFillColor(r, g, b);
      pdf.setDrawColor(150);
      pdf.setLineWidth(0.2);
      pdf.rect(xLegenda, yLegenda, tamanhoLegenda, tamanhoLegenda, "FD");
      pdf.text(`${de} a ${ate}m : ${l.tipo}`, xLegenda + 9, yLegenda + 4.5);
      yLegenda += 10;
    });

    const larguraTubo = 12;
    const esquerdaTubo = centro - larguraTubo / 2;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(50);
    pdf.setLineWidth(0.3);
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax, "FD");

    const topoFiltro = parseFloat(data.secao_filtrante_topo);
    const baseFiltro = parseFloat(data.secao_filtrante_base);

    if (!isNaN(topoFiltro) && !isNaN(baseFiltro)) {
      const yTopoFiltro = topo + topoFiltro * escala;
      const yBaseFiltro = topo + baseFiltro * escala;
      const alturaFiltro = yBaseFiltro - yTopoFiltro;
      pdf.rect(esquerdaTubo, yTopoFiltro, larguraTubo, alturaFiltro);
      for (let i = 3; i < alturaFiltro; i += 3) {
        pdf.line(esquerdaTubo + 0.5, yTopoFiltro + i, esquerdaTubo + larguraTubo - 0.5, yTopoFiltro + i);
      }
    }

    const topoPrefiltro = parseFloat(data.pre_filtro);
    if (!isNaN(topoPrefiltro)) {
      const larguraPrefiltro = larguraPerfil * 0.07;
      const yInicioPrefiltro = topo + topoPrefiltro * escala;
      const alturaPrefiltro = (profundidadeTotal - topoPrefiltro) * escala;
      const esquerdaPrefiltro = esquerdaTubo - larguraPrefiltro;
      const direitaPrefiltro = esquerdaTubo + larguraTubo;

      pdf.setFillColor(245, 222, 179);
      pdf.rect(esquerdaPrefiltro, topo, larguraPrefiltro, yInicioPrefiltro - topo, "F");
      pdf.rect(direitaPrefiltro, topo, larguraPrefiltro, yInicioPrefiltro - topo, "F");
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.2);
      pdf.rect(esquerdaPrefiltro, topo, larguraPrefiltro, yInicioPrefiltro - topo);
      pdf.rect(direitaPrefiltro, topo, larguraPrefiltro, yInicioPrefiltro - topo);

      pdf.setFillColor(210, 180, 140);
      pdf.rect(esquerdaPrefiltro, yInicioPrefiltro, larguraPrefiltro, alturaPrefiltro, "F");
      pdf.rect(direitaPrefiltro, yInicioPrefiltro, larguraPrefiltro, alturaPrefiltro, "F");
      pdf.rect(esquerdaPrefiltro, yInicioPrefiltro, larguraPrefiltro, alturaPrefiltro);
      pdf.rect(direitaPrefiltro, yInicioPrefiltro, larguraPrefiltro, alturaPrefiltro);

      pdf.setFillColor(0, 0, 0);
      const espacamentoPF = 2.4;
      const raioBase = 0.25;
      for (let yDot = yInicioPrefiltro + 1; yDot < yInicioPrefiltro + alturaPrefiltro; yDot += espacamentoPF) {
        for (let xDot = esquerdaPrefiltro + 0.8; xDot < esquerdaPrefiltro + larguraPrefiltro - 0.8; xDot += espacamentoPF) {
          const jitterX = (Math.random() - 0.5) * 0.6; const jitterY = (Math.random() - 0.5) * 0.6;
          pdf.circle(xDot + jitterX, yDot + jitterY, raioBase + (Math.random() - 0.5) * 0.1, "F");
        }
        for (let xDot = direitaPrefiltro + 0.8; xDot < direitaPrefiltro + larguraPrefiltro - 0.8; xDot += espacamentoPF) {
          const jitterX = (Math.random() - 0.5) * 0.6; const jitterY = (Math.random() - 0.5) * 0.6;
          pdf.circle(xDot + jitterX, yDot + jitterY, raioBase + (Math.random() - 0.5) * 0.1, "F");
        }
      }
    }

    if (data.nivel_agua) {
      const nivel = Number(String(data.nivel_agua).replace(",", "."));
      if (!isNaN(nivel)) {
        const yNivel = topo + nivel * escala;
        pdf.setDrawColor(135, 206, 235);
        pdf.setLineWidth(0.7);
        pdf.line(esquerdaPerfil - 10, yNivel, direitaPerfil + 10, yNivel);
        pdf.setFillColor(135, 206, 235);
        pdf.triangle(esquerdaPerfil - 12, yNivel, esquerdaPerfil - 15, yNivel - 2, esquerdaPerfil - 15, yNivel + 2, "F");
      }
    }

    const yCota1 = topo + alturaMax + 10;
    const yCota2 = topo + alturaMax + 20;
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.3);
    pdf.setTextColor(60);

    const diametroPoco = data.diametro_poco ?? "-";
    pdf.line(esquerdaTubo, topo + alturaMax, esquerdaTubo, yCota1);
    pdf.line(esquerdaTubo + larguraTubo, topo + alturaMax, esquerdaTubo + larguraTubo, yCota1);
    pdf.line(esquerdaTubo, yCota1, esquerdaTubo + larguraTubo, yCota1);
    pdf.setFontSize(8);
    pdf.text(`Ø ${diametroPoco} (Poço)`, esquerdaTubo + (larguraTubo/2), yCota1 + 4, { align: "center" });

    const diametroSondagem = data.diametro_sondagem ?? "-";
    pdf.line(esquerdaPerfil, topo + alturaMax, esquerdaPerfil, yCota2);
    pdf.line(direitaPerfil, topo + alturaMax, direitaPerfil, yCota2);
    pdf.line(esquerdaPerfil, yCota2, direitaPerfil, yCota2);
    pdf.text(`Ø ${diametroSondagem} (Furo)`, centro, yCota2 + 4, { align: "center" });

    pdf.save(`Perfil_Sondagem_${data.nome_sondagem}.pdf`);
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
              <p className="opacity-80 mt-1">Sondagem: {data.nome_sondagem}</p>
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
                    <EditInput label="Coord. X" value={editForm.coord_x} onChange={(v) => handleFieldChange("coord_x", v)} />
                    <EditInput label="Coord. Y" value={editForm.coord_y} onChange={(v) => handleFieldChange("coord_y", v)} />
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
                        <th className="p-3 font-bold text-[#391e2a] text-xs">Coloração</th>
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
                    <Info label="Coord. X" value={data.coord_x} />
                    <Info label="Coord. Y" value={data.coord_y} />
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
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">Coloração</th>
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

// Mini input interno para o modo de edição (Desktop friendly)
function EditInput({ label, value, onChange, type = "text" }: { label: string, value: string, onChange: (v: string) => void, type?: string }) {
  return (
    <div className="flex flex-col">
      <label className="text-[11px] font-bold text-gray-400 tracking-wide uppercase mb-1">{label}</label>
      <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none" />
    </div>
  );
}