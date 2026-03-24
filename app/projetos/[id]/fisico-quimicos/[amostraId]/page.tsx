"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ================= HELPERS (Logo Branco) =================
async function generateWhiteLogoBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Erro no canvas")); return; }
      ctx.drawImage(img, 0, 0);
      ctx.filter = "brightness(0) invert(1)";
      ctx.drawImage(canvas, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

// ================= ÍCONES =================
const Icons = {
  ArrowLeft: () => <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Download: () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Edit: () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Save: () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
};

export default function FisicoQuimicosDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const amostraId = params.amostraId as string;

  const [amostra, setAmostra] = useState<any>(null);
  const [projectName, setProjectName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("water_samplings").select("*").eq("id", amostraId).single();
    if (data) setAmostra(data);
    const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single();
    if (proj) setProjectName(proj.name);
  }

  function formatDateBr(dateString: string) {
    if (!dateString) return "-";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }

  async function salvarAlteracoes() {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("water_samplings")
        .update({
          poco: amostra.poco,
          nomenclatura: amostra.nomenclatura,
          identificacao_codigo: amostra.identificacao_codigo,
          data: amostra.data,
          hora_inicio: amostra.hora_inicio,
          na_inicial: amostra.na_inicial,
          na_final: amostra.na_final,
          fase_livre: amostra.fase_livre,
          espessura_fl: amostra.espessura_fl,
          leituras: amostra.leituras
        })
        .eq("id", amostraId);

      if (error) throw error;
      setIsEditing(false);
      alert("Ficha atualizada com sucesso!");
    } catch (e) {
      alert("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  // ================= GERAÇÃO DO PDF PREMIUM =================
  async function gerarPDF() {
    if (!amostra) return;

    let whiteLogoBase64: string | null = null;
    try { whiteLogoBase64 = await generateWhiteLogoBase64("/logo.png"); } catch (e) {}

    const doc = new jsPDF("p", "mm", "a4");
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginX * 2;
    let currentY = 0;

    const brandPurple: [number, number, number] = [57, 30, 42];
    const brandGreen: [number, number, number] = [128, 176, 45];
    const lightGray: [number, number, number] = [245, 245, 248];

    // HEADER
    doc.setFillColor(...brandPurple);
    doc.rect(0, 0, pageWidth, 35, "F");

    if (whiteLogoBase64) {
      try { doc.addImage(whiteLogoBase64, "PNG", marginX, 12.5, 35, 10); } catch (e) {}
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("FICHA DE AMOSTRAGEM FÍSICO-QUÍMICA", pageWidth - marginX, 16, { align: "right" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`PROJETO: ${projectName}`, pageWidth - marginX, 23, { align: "right" });
    doc.text(`DATA: ${formatDateBr(amostra.data)}`, pageWidth - marginX, 28, { align: "right" });

    currentY = 45;

    // DADOS DO POÇO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...brandPurple);
    doc.text("DADOS GERAIS E IDENTIFICAÇÃO", marginX, currentY);
    doc.setDrawColor(...brandGreen);
    doc.setLineWidth(0.8);
    doc.line(marginX, currentY + 2, marginX + 15, currentY + 2);
    currentY += 8;

    const boxWidth = contentWidth / 3 - 3;
    const drawBox = (x: number, y: number, label: string, value: string) => {
      doc.setFillColor(...lightGray);
      doc.roundedRect(x, y, boxWidth, 15, 1, 1, "F");
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.setFont("helvetica", "bold");
      doc.text(label.toUpperCase(), x + 3, y + 5);
      doc.setFontSize(9);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      doc.text(value || "-", x + 3, y + 11);
    };

    drawBox(marginX, currentY, "Identificação do Poço", amostra.poco);
    drawBox(marginX + boxWidth + 4.5, currentY, "Nomenclatura", amostra.nomenclatura);
    drawBox(marginX + (boxWidth * 2) + 9, currentY, "Código da Amostra", amostra.identificacao_codigo);
    
    currentY += 19;

    drawBox(marginX, currentY, "Horário de Início", amostra.hora_inicio);
    drawBox(marginX + boxWidth + 4.5, currentY, "Nível D'água Inicial", `${amostra.na_inicial || "-"} m`);
    drawBox(marginX + (boxWidth * 2) + 9, currentY, "Nível D'água Final", `${amostra.na_final || "-"} m`);

    currentY += 19;

    // FASE LIVRE
    doc.setFillColor(amostra.fase_livre ? 255 : 245, amostra.fase_livre ? 235 : 245, amostra.fase_livre ? 235 : 248);
    doc.roundedRect(marginX, currentY, contentWidth, 15, 1, 1, "F");
    doc.setFontSize(8);
    doc.setTextColor(amostra.fase_livre ? 150 : 120, amostra.fase_livre ? 50 : 120, amostra.fase_livre ? 50 : 120);
    doc.text("DETECÇÃO DE FASE LIVRE (FL)", marginX + 3, currentY + 5);
    
    doc.setFontSize(10);
    doc.setTextColor(amostra.fase_livre ? 200 : 80, amostra.fase_livre ? 0 : 80, amostra.fase_livre ? 0 : 80);
    if (amostra.fase_livre) {
      doc.text(`SIM - Espessura: ${amostra.espessura_fl || "Não informada"} m`, marginX + 3, currentY + 11);
    } else {
      doc.text("NÃO DETECTADA", marginX + 3, currentY + 11);
    }

    currentY += 25;

    // TABELA LEITURAS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...brandPurple);
    doc.text("PARÂMETROS DE PURGA (LEITURAS)", marginX, currentY);
    doc.setDrawColor(...brandGreen);
    doc.setLineWidth(0.8);
    doc.line(marginX, currentY + 2, marginX + 15, currentY + 2);
    currentY += 6;

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      head: [["Horário", "NA (m)", "pH", "ORP (mV)", "OD (mg/L)", "Cond. (µS/cm)"]],
      body: amostra.leituras?.map((l: any) => [
        l.horario || "-", 
        l.na || "-", 
        l.ph || "-", 
        l.orp || "-", 
        l.od || "-", 
        l.condutividade || "-"
      ]) || [],
      theme: 'striped',
      headStyles: { fillColor: brandPurple, textColor: 255, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 4, textColor: 50, halign: "center" },
      alternateRowStyles: { fillColor: [250, 250, 252] }
    });

    // RODAPÉ
    const totalP = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalP; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(180);
      doc.text(`Documento gerado eletronicamente - Página ${i} de ${totalP}`, pageWidth / 2, 290, { align: "center" });
    }

    doc.save(`Ficha_FQ_${amostra.poco}_${amostra.data}.pdf`);
  }

  if (!amostra) return <AdminShell><p className="p-10 font-bold text-gray-500">Carregando ficha...</p></AdminShell>;

  return (
    <AdminShell>
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        
        {/* BOTÃO VOLTAR */}
        <button onClick={() => router.back()} className="text-gray-500 hover:text-[#80b02d] font-bold text-sm flex items-center transition-colors">
          <Icons.ArrowLeft /> Voltar para Compilados
        </button>

        {/* HEADER DA PÁGINA */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-[#391e2a] px-8 py-6 text-white flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-inner">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Ficha Físico-Química</h1>
              <p className="text-[#80b02d] font-semibold mt-1 uppercase tracking-wider text-xs">
                POÇO {amostra.poco} • {formatDateBr(amostra.data)}
              </p>
            </div>
            <div className="flex gap-3">
              {isEditing ? (
                <Button onClick={salvarAlteracoes} disabled={isSaving} className="bg-white text-[#391e2a] hover:bg-gray-100 font-bold shadow-sm">
                  {isSaving ? "Salvando..." : <><Icons.Save /> Salvar Edição</>}
                </Button>
              ) : (
                <Button onClick={() => setIsEditing(true)} className="bg-transparent border border-white/30 hover:bg-white/10 text-white font-bold shadow-sm">
                  <Icons.Edit /> Editar Ficha
                </Button>
              )}
              <Button onClick={gerarPDF} className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold shadow-lg">
                <Icons.Download /> Gerar Laudo PDF
              </Button>
            </div>
          </div>

          <div className="p-8 space-y-8 bg-gray-50/50">
            
            {/* SEÇÃO 1: DADOS GERAIS */}
            <div>
              <h3 className="text-sm font-extrabold text-[#391e2a] uppercase tracking-wider mb-4 border-b-2 border-gray-200 pb-2">Identificação e Dados Gerais</h3>
              <div className="grid grid-cols-3 gap-4">
                <InputView label="Poço" value={amostra.poco} isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, poco: v})} />
                <InputView label="Nomenclatura" value={amostra.nomenclatura} isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, nomenclatura: v})} />
                <InputView label="Código (Amostra)" value={amostra.identificacao_codigo} isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, identificacao_codigo: v})} />
                <InputView label="Data" value={amostra.data} type="date" isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, data: v})} />
                <InputView label="Hora Início" value={amostra.hora_inicio} type="time" isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, hora_inicio: v})} />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <InputView label="Nível D'água Inicial (m)" value={amostra.na_inicial} type="number" isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, na_inicial: v})} />
                <InputView label="Nível D'água Final (m)" value={amostra.na_final} type="number" isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, na_final: v})} />
              </div>
            </div>

            {/* SEÇÃO 2: FASE LIVRE */}
            <div className={`p-5 rounded-2xl border ${amostra.fase_livre ? 'bg-red-50 border-red-100' : 'bg-gray-100 border-gray-200'}`}>
              <h3 className={`text-sm font-extrabold uppercase tracking-wider mb-3 ${amostra.fase_livre ? 'text-red-700' : 'text-gray-500'}`}>
                Detecção de Fase Livre
              </h3>
              {isEditing ? (
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 font-bold text-sm">
                    <input type="checkbox" checked={amostra.fase_livre} onChange={(e) => setAmostra({...amostra, fase_livre: e.target.checked})} className="w-5 h-5 rounded text-[#80b02d]" />
                    Sim, Fase Livre detectada
                  </label>
                  {amostra.fase_livre && (
                    <input type="number" value={amostra.espessura_fl || ""} onChange={(e) => setAmostra({...amostra, espessura_fl: e.target.value})} placeholder="Espessura (m)" className="border p-2 rounded text-sm outline-none focus:border-[#80b02d]" />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 font-bold text-lg">
                  {amostra.fase_livre ? <span className="text-red-600">⚠️ SIM (Espessura: {amostra.espessura_fl}m)</span> : <span className="text-gray-600">NÃO DETECTADA</span>}
                </div>
              )}
            </div>

            {/* SEÇÃO 3: LEITURAS (TABELA) */}
            <div>
              <h3 className="text-sm font-extrabold text-[#391e2a] uppercase tracking-wider mb-4 border-b-2 border-gray-200 pb-2">Leituras de Purga ({amostra.leituras?.length || 0})</h3>
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#391e2a]/5 font-bold text-[#391e2a] text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-center">Nº</th>
                      <th className="px-4 py-3">Horário</th>
                      <th className="px-4 py-3">NA (m)</th>
                      <th className="px-4 py-3">pH</th>
                      <th className="px-4 py-3">ORP (mV)</th>
                      <th className="px-4 py-3">OD (mg/L)</th>
                      <th className="px-4 py-3">Cond. (µS/cm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {amostra.leituras?.map((leit: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-center font-bold text-gray-400">{idx + 1}</td>
                        {isEditing ? (
                          <>
                            <td className="px-2 py-2"><input type="time" value={leit.horario} onChange={(e) => { const n = [...amostra.leituras]; n[idx].horario = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                            <td className="px-2 py-2"><input type="number" value={leit.na} onChange={(e) => { const n = [...amostra.leituras]; n[idx].na = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                            <td className="px-2 py-2"><input type="number" value={leit.ph} onChange={(e) => { const n = [...amostra.leituras]; n[idx].ph = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                            <td className="px-2 py-2"><input type="number" value={leit.orp} onChange={(e) => { const n = [...amostra.leituras]; n[idx].orp = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                            <td className="px-2 py-2"><input type="number" value={leit.od} onChange={(e) => { const n = [...amostra.leituras]; n[idx].od = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                            <td className="px-2 py-2"><input type="number" value={leit.condutividade} onChange={(e) => { const n = [...amostra.leituras]; n[idx].condutividade = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-semibold text-gray-700">{leit.horario || "-"}</td>
                            <td className="px-4 py-3">{leit.na || "-"}</td>
                            <td className="px-4 py-3 font-semibold text-[#80b02d]">{leit.ph || "-"}</td>
                            <td className="px-4 py-3">{leit.orp || "-"}</td>
                            <td className="px-4 py-3 text-blue-600 font-semibold">{leit.od || "-"}</td>
                            <td className="px-4 py-3">{leit.condutividade || "-"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// === COMPONENTE AUXILIAR PARA INPUT / VIEW ===
function InputView({ label, value, isEditing, onChange, type = "text" }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</label>
      {isEditing ? (
        <input 
          type={type} 
          value={value || ""} 
          onChange={(e) => onChange(e.target.value)} 
          className="border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-[#80b02d]/50 focus:border-[#80b02d] transition-all bg-white" 
        />
      ) : (
        <div className="font-semibold text-gray-800 text-sm py-1">{value || "-"}</div>
      )}
    </div>
  );
}