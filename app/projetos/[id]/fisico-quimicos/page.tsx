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
  Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Droplet: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Eye: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
};

type Sampling = {
  id: string;
  poco: string;
  nomenclatura: string;
  identificacao_codigo: string;
  data: string;
  hora_inicio: string;
  na_inicial?: string; 
  na_final?: string;
  fase_livre: boolean;
  espessura_fl?: string;
  leituras: any[];
};

export default function FisicoQuimicosDesktopPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("Carregando...");
  const [groupedData, setGroupedData] = useState<{ [key: string]: Sampling[] }>({});
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    // 1. Busca o nome do projeto
    const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single();
    if (proj) setProjectName(proj.name);

    // 2. Busca todas as amostragens finalizadas deste projeto
    const { data: samplings } = await supabase
      .from("water_samplings")
      .select("*")
      .eq("project_id", projectId)
      .eq("finalized", true)
      .order("data", { ascending: false });

    if (samplings) {
      // 3. MÁGICA: Agrupar as amostragens pela data (YYYY-MM-DD)
      const grouped = samplings.reduce((acc: any, curr: Sampling) => {
        const dateKey = curr.data;
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(curr);
        return acc;
      }, {});
      
      setGroupedData(grouped);
    }
    setLoading(false);
  }

  // Helper para formatar a data (Ex: 2026-03-23 -> 23/03/2026)
  function formatDateBr(dateString: string) {
    if (!dateString) return "Sem Data";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }

  // ================= FUNÇÃO NOVA: GERA O PDF GERAL DO DIA =================
  async function gerarPDFGeral(dataCampanha: string, amostras: Sampling[]) {
    setGeneratingPdf(dataCampanha);

    try {
      let whiteLogoBase64: string | null = null;
      try { whiteLogoBase64 = await generateWhiteLogoBase64("/logo.png"); } catch (e) {}

      const doc = new jsPDF("p", "mm", "a4");
      const marginX = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      let currentY = 0;

      const brandPurple: [number, number, number] = [57, 30, 42];
      const brandGreen: [number, number, number] = [128, 176, 45];

      const drawPageHeader = () => {
        doc.setFillColor(...brandPurple);
        doc.rect(0, 0, pageWidth, 35, "F");

        if (whiteLogoBase64) {
          try { doc.addImage(whiteLogoBase64, "PNG", marginX, 12.5, 35, 10); } catch (e) {}
        }

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("RELATÓRIO GERAL: FÍSICO-QUÍMICOS", pageWidth - marginX, 16, { align: "right" });
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`PROJETO: ${projectName}`, pageWidth - marginX, 23, { align: "right" });
        doc.text(`DATA DA CAMPANHA: ${formatDateBr(dataCampanha)}`, pageWidth - marginX, 28, { align: "right" });

        currentY = 45;
      };

      drawPageHeader();

      const checkPageBreak = (needed: number) => {
        if (currentY + needed > 275) {
          doc.addPage();
          drawPageHeader();
          return true;
        }
        return false;
      };

      for (let i = 0; i < amostras.length; i++) {
        const amostra = amostras[i];
        
        checkPageBreak(50); 

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...brandPurple);
        doc.text(`POÇO: ${amostra.poco} | ${amostra.nomenclatura || "Sem nomenclatura"}`, marginX, currentY);
        
        doc.setDrawColor(...brandGreen);
        doc.setLineWidth(0.8);
        doc.line(marginX, currentY + 2, marginX + 10, currentY + 2);
        currentY += 8;

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        
        const infoLinha1 = `Cód: ${amostra.identificacao_codigo || "-"}   |   Hora Início: ${amostra.hora_inicio || "-"}   |   NA Inicial: ${amostra.na_inicial || "-"} m   |   NA Final: ${amostra.na_final || "-"} m`;
        doc.text(infoLinha1, marginX, currentY);
        currentY += 5;

        if (amostra.fase_livre) {
          doc.setTextColor(200, 0, 0);
          doc.setFont("helvetica", "bold");
          doc.text(`Fase Livre: DETECTADA (Espessura: ${amostra.espessura_fl || "-"} m)`, marginX, currentY);
        } else {
          doc.setTextColor(120);
          doc.text("Fase Livre: Não Detectada", marginX, currentY);
        }
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
          headStyles: { fillColor: brandPurple, textColor: 255, fontStyle: "bold", fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 3, textColor: 50, halign: "center" },
          alternateRowStyles: { fillColor: [250, 250, 252] }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      const totalP = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalP; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(180);
        doc.text(`Documento gerado eletronicamente - Página ${i} de ${totalP}`, pageWidth / 2, 290, { align: "center" });
      }

      doc.save(`Compilado_FQ_${projectName}_${dataCampanha}.pdf`);
    } catch (error) {
      alert("Erro ao gerar o PDF Geral.");
    } finally {
      setGeneratingPdf(null);
    }
  }

  if (loading) return <AdminShell><p className="p-10 text-gray-500 font-bold">Carregando compilados...</p></AdminShell>;

  const datasAgrupadas = Object.keys(groupedData).sort((a, b) => b.localeCompare(a)); // Ordena da mais recente pra mais antiga

  return (
    <AdminShell>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* ================= HEADER DA PÁGINA ================= */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-[#391e2a] px-10 py-8 text-white flex justify-between items-center shadow-inner">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Compilado de Físico-Químicos</h1>
              <p className="text-[#80b02d] font-bold mt-2 tracking-widest uppercase text-xs">
                Projeto: {projectName}
              </p>
            </div>
            <div className="bg-white/10 px-5 py-3 rounded-2xl border border-white/20 backdrop-blur-sm text-center">
              <p className="text-3xl font-black">{datasAgrupadas.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mt-1">Dias de Campanha</p>
            </div>
          </div>
        </div>

        {/* ================= LISTA DE CARDS COMPILADOS POR DATA ================= */}
        {datasAgrupadas.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Icons.Droplet />
            </div>
            <h3 className="text-lg font-bold text-gray-700">Nenhuma amostragem recebida</h3>
            <p className="text-gray-500 mt-2">As fichas preenchidas no aplicativo aparecerão compiladas aqui.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {datasAgrupadas.map((dataCampanha) => {
              const amostrasDoDia = groupedData[dataCampanha];

              return (
                <div key={dataCampanha} className="bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden group hover:shadow-lg transition-all duration-300">
                  
                  {/* CABEÇALHO DO CARD (DATA) */}
                  <div className="bg-gray-50 border-b border-gray-200 px-8 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#80b02d]/10 text-[#80b02d] rounded-2xl flex items-center justify-center">
                        <Icons.Calendar />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-[#391e2a]">Campanha do dia {formatDateBr(dataCampanha)}</h2>
                        <p className="text-sm font-semibold text-gray-500 mt-0.5">
                          {amostrasDoDia.length} {amostrasDoDia.length === 1 ? "poço amostrado" : "poços amostrados"}
                        </p>
                      </div>
                    </div>

                    {/* BOTÃO ATUALIZADO CONFORME SEU PEDIDO */}
                    <Button 
                      onClick={() => gerarPDFGeral(dataCampanha, amostrasDoDia)}
                      disabled={generatingPdf === dataCampanha}
                      className="bg-[#391e2a] hover:bg-[#2a161f] text-white font-bold rounded-xl h-11 px-6 shadow-sm hidden md:flex items-center gap-2"
                    >
                      <Icons.Download /> {generatingPdf === dataCampanha ? "Gerando..." : "Baixar PDF Geral"}
                    </Button>
                  </div>

                  {/* TABELA COMPILADA DO DIA */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                        <tr>
                          <th className="px-8 py-4">Poço</th>
                          <th className="px-6 py-4">Amostra (Código)</th>
                          <th className="px-6 py-4">Início</th>
                          <th className="px-6 py-4">Fase Livre</th>
                          <th className="px-6 py-4">Qtd. Leituras</th>
                          <th className="px-8 py-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {amostrasDoDia.map((amostra) => (
                          <tr key={amostra.id} className="hover:bg-gray-50/50 transition-colors group/row">
                            <td className="px-8 py-4 font-bold text-[#391e2a]">
                              {amostra.poco}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-800">{amostra.nomenclatura || "-"}</span>
                                <span className="text-xs text-gray-400">{amostra.identificacao_codigo || "-"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-600">
                              {amostra.hora_inicio || "-"}
                            </td>
                            <td className="px-6 py-4">
                              {amostra.fase_livre ? (
                                <span className="bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-md text-xs">Sim</span>
                              ) : (
                                <span className="bg-gray-100 text-gray-600 font-bold px-2.5 py-1 rounded-md text-xs">Não</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-[#80b02d]/10 text-[#80b02d] font-bold px-3 py-1 rounded-full text-xs">
                                {amostra.leituras?.length || 0} leituras
                              </span>
                            </td>
                            <td className="px-8 py-4 text-right">
                              <button 
                                onClick={() => router.push(`/projetos/${projectId}/fisico-quimicos/${amostra.id}`)}
                                className="text-[#80b02d] hover:text-white hover:bg-[#80b02d] font-bold px-4 py-2 rounded-lg transition-all text-xs flex items-center gap-2 ml-auto opacity-0 group-hover/row:opacity-100"
                              >
                                <Icons.Eye /> Ver Ficha
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </AdminShell>
  );
}