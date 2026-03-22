"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isMobileDevice } from "@/lib/isMobile";
import jsPDF from "jspdf";
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

// ================= TIPOS =================
type Activity = {
  id: string;
  description: string;
  status: string | null;
  note: string | null;
  images: string[] | null;
};

// ================= ÍCONES =================
const Icons = {
  Check: () => <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
  X: () => <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
  Plus: () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Download: () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Lock: () => <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
};

export default function WorkOrderPage() {
  const params = useParams();
  const workOrderId = params.id as string;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [finalized, setFinalized] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    setMobile(isMobileDevice());
    load();
  }, []);

  async function load() {
    const { data: wo } = await supabase
      .from("work_orders")
      .select(`*, projects ( name )`)
      .eq("id", workOrderId)
      .single();

    setFinalized(!!wo?.finalized);
    setWorkOrder(wo);

    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true });

    if (data) setActivities(data);
  }

  async function createActivity() {
    const description = prompt("Descrição da nova atividade:");
    if (!description) return;

    await supabase.from("activities").insert({
      description,
      work_order_id: workOrderId,
    });
    load();
  }

  async function updateStatus(id: string, status: string) {
    if (finalized) return;
    setActivities(prev => prev.map(a => (a.id === id ? { ...a, status } : a)));
    await supabase.from("activities").update({ status }).eq("id", id);
  }

  async function updateNote(id: string, note: string) {
    if (finalized) return;
    setActivities(prev => prev.map(a => (a.id === id ? { ...a, note } : a)));
    await supabase.from("activities").update({ note }).eq("id", id);
  }

  async function finalizeWorkOrder() {
    if (finalized) return;
    const incomplete = activities.some(a => !a.status);
    if (incomplete) {
      alert("⚠️ Todas as atividades precisam ter um status (Concluído ou Não Concluído) antes de finalizar.");
      return;
    }

    const ok = confirm("Tem certeza que deseja finalizar esta Work Order? Após finalizada, ela não poderá ser editada.");
    if (!ok) return;

    await supabase.from("work_orders").update({ finalized: true }).eq("id", workOrderId);
    load();
  }

  // ================= GERADOR DE PDF OTIMIZADO =================
  async function gerarPDF() {
    if (!workOrder) return;
    setGeneratingPdf(true);

    try {
      let whiteLogoBase64: string | null = null;
      try { whiteLogoBase64 = await generateWhiteLogoBase64("/logo.png"); } catch (e) { console.warn("Logo branco falhou"); }

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let currentY = 0;

      const brandPurple: [number, number, number] = [57, 30, 42];
      const brandGreen: [number, number, number] = [128, 176, 45];

      async function urlToBase64(url: string) {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      function addHeaderBase(title: string = "RELATÓRIO WORK ORDER") {
        pdf.setFillColor(...brandPurple);
        pdf.rect(0, 0, pageWidth, 28, "F");
        pdf.setFillColor(...brandGreen);
        pdf.rect(0, 28, pageWidth, 2, "F");

        if (whiteLogoBase64) {
          pdf.addImage(whiteLogoBase64, "PNG", margin, 9, 30, 9);
        }

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, pageWidth - margin, 18, { align: "right" });
        pdf.setTextColor(0, 0, 0);
        currentY = 45;
      }

      const checkPageBreak = (needed: number) => {
        if (currentY + needed > pageHeight - 20) {
          pdf.addPage();
          addHeaderBase();
          return true;
        }
        return false;
      };

      /* ================= 1. CAPA EXECUTIVA ================= */
      pdf.setFillColor(...brandPurple);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      if (whiteLogoBase64) {
        pdf.addImage(whiteLogoBase64, "PNG", pageWidth / 2 - 35, 60, 70, 20);
      }

      pdf.setTextColor(...brandGreen);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("WORK ORDER", pageWidth / 2, 110, { align: "center" });

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.text(workOrder.title.toUpperCase(), pageWidth / 2, 125, { align: "center" });

      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(0.5);
      pdf.line(pageWidth / 2 - 40, 135, pageWidth / 2 + 40, 135);

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`PROJETO: ${workOrder.projects?.name ?? "Não atribuído"}`, pageWidth / 2, 150, { align: "center" });
      pdf.text(`DATA: ${new Date().toLocaleDateString()}`, pageWidth / 2, 160, { align: "center" });

      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text("GreenSoil do Brasil LTDA", pageWidth / 2, pageHeight - 30, { align: "center" });
      pdf.text("CNPJ: 29.088.151/0001-25", pageWidth / 2, pageHeight - 24, { align: "center" });

      /* ================= 2. TABELA DE RESUMO ================= */
      pdf.addPage();
      addHeaderBase("RESUMO DAS ATIVIDADES");

      autoTable(pdf, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [["Descrição da Atividade", "Status", "Observações"]],
        body: activities.map(a => [
          a.description, 
          a.status === "concluído" ? "Concluído" : a.status === "não concluído" ? "Não Concluído" : "Pendente",
          a.note || "-"
        ]),
        theme: 'striped',
        headStyles: { fillColor: brandPurple, textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 4 },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 1) {
            const s = String(data.cell.raw).toLowerCase();
            if (s.includes("não") || s.includes("pendente")) data.cell.styles.textColor = [200, 50, 50];
            else data.cell.styles.textColor = [50, 150, 50];
          }
        }
      });
      currentY = (pdf as any).lastAutoTable.finalY + 15;

      /* ================= 3. REGISTROS FOTOGRÁFICOS ================= */
      const activitiesWithPhotos = activities.filter(a => a.images && a.images.length > 0);
      
      if (activitiesWithPhotos.length > 0) {
        pdf.addPage();
        addHeaderBase("REGISTRO FOTOGRÁFICO");

        for (const act of activitiesWithPhotos) {
          checkPageBreak(80);
          
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(...brandPurple);
          pdf.text(`Ref: ${act.description}`, margin, currentY);
          currentY += 6;

          for (const imgUrl of act.images!) {
            try {
              const imgBase64 = await urlToBase64(imgUrl);
              const img = new Image();
              img.src = imgBase64;
              await new Promise(resolve => (img.onload = resolve));

              const maxWidth = 100;
              const maxHeight = 80;
              let w = img.width;
              let h = img.height;
              const ratio = w / h;

              if (w > maxWidth) { w = maxWidth; h = w / ratio; }
              if (h > maxHeight) { h = maxHeight; w = h * ratio; }

              checkPageBreak(h + 10);
              pdf.addImage(imgBase64, "JPEG", margin, currentY, w, h);
              
              pdf.setDrawColor(200);
              pdf.rect(margin, currentY, w, h);
              currentY += h + 15;
            } catch (e) {
              console.error("Erro ao inserir foto:", e);
            }
          }
        }
      }

      /* ================= 4. INFORMAÇÕES EXTRAS E ASSINATURA ================= */
      if (workOrder.additional_info || workOrder.signature_url) {
        checkPageBreak(80);
        
        if (workOrder.additional_info) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(12);
          pdf.setTextColor(...brandPurple);
          pdf.text("Notas Adicionais", margin, currentY);
          currentY += 8;

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.setTextColor(60);
          const splitText = pdf.splitTextToSize(workOrder.additional_info, pageWidth - margin * 2);
          pdf.text(splitText, margin, currentY);
          currentY += (splitText.length * 5) + 20;
        }

        if (workOrder.signature_url) {
          checkPageBreak(50);
          try {
            const signBase64 = await urlToBase64(workOrder.signature_url);
            pdf.addImage(signBase64, "PNG", pageWidth / 2 - 30, currentY, 60, 25);
            currentY += 25;
          } catch(e) {}
          
          pdf.setDrawColor(150);
          pdf.line(pageWidth / 2 - 40, currentY + 5, pageWidth / 2 + 40, currentY + 5);
          pdf.setFontSize(9);
          pdf.setTextColor(0);
          pdf.text("Assinatura do Responsável", pageWidth / 2, currentY + 10, { align: "center" });
        }
      }

      // Numeração de páginas (exceto capa)
      const totalPages = pdf.getNumberOfPages();
      for (let i = 2; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
      }

      pdf.save(`WO_${workOrder.title.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      alert("Erro ao gerar o PDF. Verifique o console.");
      console.error(error);
    } finally {
      setGeneratingPdf(false);
    }
  }

  if (!workOrder) return <AdminShell><p className="p-10 text-gray-500">Carregando Work Order...</p></AdminShell>;

  // ================= RENDERIZAÇÃO DA PÁGINA =================
  return (
    <AdminShell>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
        
        {/* CABEÇALHO EXECUTIVO */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-[#391e2a] px-8 py-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">{workOrder.title}</h1>
                {finalized && (
                  <span className="bg-[#80b02d] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider flex items-center">
                    Finalizada <Icons.Lock />
                  </span>
                )}
              </div>
              <p className="text-[#80b02d] font-semibold text-sm">
                PROJETO: {workOrder.projects?.name ?? "N/A"}
              </p>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              {!mobile && !finalized && (
                <Button onClick={createActivity} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold px-4">
                  <Icons.Plus /> Nova Atividade
                </Button>
              )}
              {finalized && (
                <Button onClick={gerarPDF} disabled={generatingPdf} className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold px-6 shadow-lg w-full md:w-auto">
                  {generatingPdf ? "Processando..." : <><Icons.Download /> Baixar Relatório</>}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* LISTA DE ATIVIDADES */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#391e2a] px-2">Checklist de Atividades</h2>
          
          {activities.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-400 font-medium">
              Nenhuma atividade cadastrada nesta Work Order.
            </div>
          ) : (
            <div className="grid gap-4">
              {activities.map((act, index) => {
                const isConcluido = act.status === "concluído";
                const isNaoConcluido = act.status === "não concluído";

                return (
                  <Card key={act.id} className={`border border-gray-200 shadow-sm transition-all ${isConcluido ? "bg-green-50/30" : isNaoConcluido ? "bg-red-50/30" : "bg-white"}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        
                        {/* Descrição */}
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <span className="bg-[#391e2a]/10 text-[#391e2a] font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">
                              {index + 1}
                            </span>
                            <p className="font-semibold text-gray-800 text-lg leading-snug">{act.description}</p>
                          </div>
                        </div>

                        {/* Controles (Status e Notas) */}
                        <div className="flex-1 space-y-4 md:max-w-md">
                          {!finalized ? (
                            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl">
                              <button
                                onClick={() => updateStatus(act.id, "concluído")}
                                className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-bold transition-all ${
                                  isConcluido ? "bg-white text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                }`}
                              >
                                <Icons.Check /> Concluído
                              </button>
                              <button
                                onClick={() => updateStatus(act.id, "não concluído")}
                                className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-bold transition-all ${
                                  isNaoConcluido ? "bg-white text-red-600 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                }`}
                              >
                                <Icons.X /> Não concluído
                              </button>
                            </div>
                          ) : (
                            <div className="flex">
                              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center ${
                                isConcluido ? "bg-green-100 text-green-700" : isNaoConcluido ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                              }`}>
                                {isConcluido ? <><Icons.Check /> Concluído</> : isNaoConcluido ? <><Icons.X /> Não Concluído</> : "Pendente"}
                              </span>
                            </div>
                          )}

                          <textarea
                            placeholder="Adicionar observações de campo..."
                            value={act.note ?? ""}
                            disabled={finalized}
                            onChange={(e) => updateNote(act.id, e.target.value)}
                            className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#80b02d] focus:border-transparent outline-none transition-all resize-none h-20 placeholder:text-gray-400 disabled:opacity-70"
                          />
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTÃO FINALIZAR GIGANTE */}
        {!finalized && activities.length > 0 && (
          <div className="pt-6 pb-10">
            <Button 
              onClick={finalizeWorkOrder} 
              className="w-full bg-[#391e2a] hover:bg-[#2a161f] text-white h-14 rounded-2xl font-bold text-lg shadow-xl hover:-translate-y-1 transition-all"
            >
              <Icons.Lock /> Trancar e Finalizar Work Order
            </Button>
            <p className="text-center text-xs text-gray-400 mt-3 font-medium">
              Após finalizar, o PDF será liberado para download e as atividades não poderão ser alteradas.
            </p>
          </div>
        )}

      </div>
    </AdminShell>
  );
}