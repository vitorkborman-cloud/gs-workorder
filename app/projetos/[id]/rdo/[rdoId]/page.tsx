"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function RdoViewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const rdoId = params.rdoId as string;

  const [rdo, setRdo] = useState<any>(null);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("rdo_reports").select("*").eq("id", rdoId).single();
    if (data) setRdo(data);

    const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single();
    if (proj) setProjectName(proj.name);
  }

  async function gerarPDF() {
    if (!rdo) return;

    const doc = new jsPDF("p", "mm", "a4");
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginX * 2;
    let currentY = 0;

    // --- CORES DE ELITE ---
    const brandPurple: [number, number, number] = [57, 30, 42];
    const brandGreen: [number, number, number] = [128, 176, 45];
    const lightGray: [number, number, number] = [245, 245, 247];
    const textMain: [number, number, number] = [40, 40, 40];

    // --- 1. CABEÇALHO MODERNO (DARK MODE STYLE) ---
    doc.setFillColor(...brandPurple);
    doc.rect(0, 0, pageWidth, 40, "F"); // Faixa superior
    
    try {
      doc.addImage("/logo.png", "PNG", marginX, 10, 35, 10);
    } catch (e) {}

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("DIÁRIO DE OBRA", pageWidth - marginX, 18, { align: "right" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${projectName} | ${rdo.data}`, pageWidth - marginX, 25, { align: "right" });
    
    currentY = 50;

    // --- 2. DASHBOARD DE RESUMO (KPIs) ---
    const cardW = contentWidth / 3 - 5;
    const drawCard = (x: number, title: string, value: string, color: [number, number, number]) => {
      doc.setFillColor(...lightGray);
      doc.roundedRect(x, currentY, cardW, 20, 2, 2, "F");
      doc.setDrawColor(...color);
      doc.setLineWidth(1);
      doc.line(x, currentY + 18, x + cardW, currentY + 18);
      
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.setFont("helvetica", "bold");
      doc.text(title.toUpperCase(), x + 5, currentY + 7);
      
      doc.setFontSize(11);
      doc.setTextColor(...brandPurple);
      doc.text(value, x + 5, currentY + 14);
    };

    const totalColab = rdo.envolvidos?.reduce((acc: number, cur: any) => acc + (Number(cur.colaboradores) || 0), 0) || 0;
    drawCard(marginX, "Efetivo Total", `${totalColab} Colaboradores`, brandGreen);
    drawCard(marginX + cardW + 7.5, "Clima Predominante", rdo.clima?.[0]?.condicao || "N/A", brandGreen);
    drawCard(marginX + (cardW + 7.5) * 2, "Segurança (SHEQ)", rdo.sheq?.incidente === "Não" ? "Operação Segura" : "Alerta de Incidente", [200, 0, 0]);

    currentY += 35;

    // --- FUNÇÕES AUXILIARES ---
    const checkPageBreak = (needed: number) => {
      if (currentY + needed > 275) {
        doc.addPage();
        currentY = 20;
        return true;
      }
      return false;
    };

    const sectionHeader = (title: string) => {
      checkPageBreak(15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...brandPurple);
      doc.text(title, marginX, currentY);
      doc.setDrawColor(...brandGreen);
      doc.setLineWidth(0.5);
      doc.line(marginX, currentY + 2, marginX + 20, currentY + 2);
      currentY += 10;
    };

    // --- 3. TABELAS ESTILIZADAS ---
    const tableBaseConfig: any = {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: brandPurple, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] }
    };

    // Tabela de Atividades com Lógica de Cores no Status
    if (rdo.atividades?.length > 0) {
      sectionHeader("CRONOGRAMA E ATIVIDADES");
      autoTable(doc, {
        ...tableBaseConfig,
        startY: currentY,
        head: [["Atividade", "Responsável", "Status", "Observações"]],
        body: rdo.atividades.map((a: any) => [a.atividade, a.empresa, a.status, a.obs || "-"]),
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 2) {
            const val = String(data.cell.raw).toLowerCase();
            if (val.includes("conclu") || val.includes("final")) data.cell.styles.textColor = [0, 128, 0];
            if (val.includes("andamento")) data.cell.styles.textColor = [210, 105, 30];
          }
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // --- 4. COMENTÁRIOS COM DESIGN DE CITAÇÃO ---
    if (rdo.comentarios) {
      sectionHeader("NOTAS DE CAMPO");
      const lines = doc.splitTextToSize(rdo.comentarios, contentWidth - 10);
      const h = (lines.length * 5) + 10;
      checkPageBreak(h);
      
      doc.setFillColor(...lightGray);
      doc.rect(marginX, currentY, contentWidth, h, "F");
      doc.setDrawColor(...brandGreen);
      doc.setLineWidth(1);
      doc.line(marginX, currentY, marginX, currentY + h); // Barra lateral esquerda
      
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...textMain);
      doc.text(lines, marginX + 5, currentY + 7);
      currentY += h + 15;
    }

    // --- 5. GALERIA FOTOGRÁFICA (POLAROID STYLE) ---
    if (rdo.fotos?.length > 0) {
      sectionHeader("EVIDÊNCIAS FOTOGRÁFICAS");
      const imgW = (contentWidth / 2) - 5;
      const imgH = 45;

      rdo.fotos.forEach((foto: any, i: number) => {
        const x = i % 2 === 0 ? marginX : marginX + imgW + 10;
        checkPageBreak(imgH + 20);
        
        if (foto.preview) {
          try {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(220, 220, 220);
            doc.rect(x, currentY, imgW, imgH + 10, "FD"); // Moldura
            doc.addImage(foto.preview, "JPEG", x + 2, currentY + 2, imgW - 4, imgH - 4);
            
            doc.setFontSize(7);
            doc.setTextColor(100);
            doc.text(foto.legenda || "Sem legenda", x + 2, currentY + imgH + 5);
          } catch (e) {}
        }
        if (i % 2 !== 0 || i === rdo.fotos.length - 1) currentY += imgH + 20;
      });
    }

    // --- 6. ASSINATURAS E RODAPÉ ---
    if (rdo.assinaturas?.length > 0) {
      sectionHeader("VALIDAÇÃO");
      currentY += 5;
      rdo.assinaturas.forEach((a: any, i: number) => {
        checkPageBreak(35);
        const x = i % 2 === 0 ? marginX : pageWidth / 2 + 5;
        if (a.assinatura) {
          try { doc.addImage(a.assinatura, "PNG", x + 10, currentY, 40, 15); } catch(e) {}
        }
        doc.setDrawColor(200);
        doc.line(x, currentY + 16, x + 60, currentY + 16);
        doc.setFontSize(8);
        doc.setTextColor(...brandPurple);
        doc.text(a.empresa || "Empresa", x, currentY + 21);
        if (i % 2 !== 0 || i === rdo.assinaturas.length - 1) currentY += 30;
      });
    }

    // Numeração de páginas final
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Relatório Gerado via Sistema RDO - Página ${i} de ${totalPages}`, pageWidth / 2, 290, { align: "center" });
    }

    doc.save(`RDO_PREMIUM_${projectName}_${rdo.data}.pdf`);
  }

  if (!rdo) return <AdminShell><p className="p-10">Carregando...</p></AdminShell>;

  return (
    <AdminShell>
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-[#391e2a] p-8 text-white flex justify-between items-center">
            <div>
              <p className="text-sm opacity-70 uppercase tracking-widest">Visualização do Relatório</p>
              <h1 className="text-3xl font-bold">{projectName}</h1>
              <p className="mt-1 text-[#80b02d] font-medium">{rdo.data}</p>
            </div>
            <Button 
              onClick={gerarPDF} 
              className="bg-[#80b02d] hover:bg-[#6a9425] text-white px-8 py-6 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg"
            >
              BAIXAR RELATÓRIO EXECUTIVO (PDF)
            </Button>
          </div>
          
          <div className="p-10 text-center">
            <div className="inline-block p-4 rounded-full bg-green-50 mb-4">
              <svg className="w-12 h-12 text-[#80b02d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Relatório Pronto para Exportação</h2>
            <p className="text-gray-500 mt-2 max-w-sm mx-auto">
              O layout executivo inclui dashboard de indicadores, análise de clima, status colorido de atividades e galeria de fotos otimizada.
            </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}