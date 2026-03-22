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

    const brandPurple: [number, number, number] = [57, 30, 42];
    const brandGreen: [number, number, number] = [128, 176, 45];
    const lightGray: [number, number, number] = [248, 248, 250];

    const checkPageBreak = (needed: number) => {
      if (currentY + needed > 275) {
        doc.addPage();
        currentY = 20;
        return true;
      }
      return false;
    };

    const sectionHeader = (title: string) => {
      checkPageBreak(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...brandPurple);
      doc.text(title.toUpperCase(), marginX, currentY);
      // Linha fina de separação
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(marginX, currentY + 2, pageWidth - marginX, currentY + 2);
      currentY += 10;
    };

    // --- 1. CABEÇALHO CLEAN (LOGO NO BRANCO) ---
    // Espaço para o Logo
    try { 
      doc.addImage("/logo.png", "PNG", marginX, 12, 35, 12); 
    } catch (e) {}

    // Informações à Direita
    doc.setTextColor(...brandPurple);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DIÁRIO DE OBRA", pageWidth - marginX, 18, { align: "right" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`${projectName}`, pageWidth - marginX, 24, { align: "right" });
    doc.text(`Data: ${rdo.data} | Período: ${rdo.inicio} - ${rdo.fim}`, pageWidth - marginX, 29, { align: "right" });

    // Barra de cores decorativa (Muito comum em papelaria corporativa)
    doc.setFillColor(...brandPurple);
    doc.rect(0, 38, pageWidth, 1.5, "F");
    doc.setFillColor(...brandGreen);
    doc.rect(0, 39.5, pageWidth, 0.5, "F");

    currentY = 55;

    // --- 2. DASHBOARD (KPIs) ---
    const colabTotal = rdo.envolvidos?.reduce((a: number, b: any) => a + (Number(b.colaboradores) || 0), 0) || 0;
    const cards = [
      { label: "EFETIVO EM CAMPO", val: `${colabTotal} COLABORADORES` },
      { label: "CONDIÇÃO CLIMÁTICA", val: rdo.clima?.[0]?.condicao || "N/A" },
      { label: "SEGURANÇA DO TRABALHO", val: rdo.sheq?.incidente === "Não" ? "OPERAÇÃO SEGURA" : "ALERTA" }
    ];

    cards.forEach((card, i) => {
      const x = marginX + (i * (contentWidth / 3 + 2));
      doc.setFillColor(...lightGray);
      doc.roundedRect(x, currentY, contentWidth / 3 - 4, 20, 1, 1, "F");
      
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.setFont("helvetica", "normal");
      doc.text(card.label, x + 4, currentY + 7);
      
      doc.setFontSize(9);
      doc.setTextColor(...brandPurple);
      doc.setFont("helvetica", "bold");
      doc.text(card.val, x + 4, currentY + 14);
    });
    currentY += 32;

    const tableConfig: any = {
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8, cellPadding: 3, textColor: [60, 60, 60] },
      headStyles: { fillColor: brandPurple, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      columnStyles: { 2: { fontStyle: 'bold' } }
    };

    // --- 3. TABELAS ---
    sectionHeader("Mão de Obra e Clima");
    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [["Empresa", "Colaboradores", "Função", "Clima (Manhã)"]],
      body: rdo.envolvidos?.map((e: any, i: number) => [
        e.empresa, 
        e.colaboradores, 
        e.funcao,
        rdo.clima?.[i]?.condicao || "-"
      ]) || []
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;

    sectionHeader("Atividades e Progresso");
    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [["Atividade", "Empresa", "Status", "Observação"]],
      body: rdo.atividades?.map((a: any) => [a.atividade, a.empresa, a.status, a.obs || "-"] ) || [],
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const s = String(data.cell.raw).toLowerCase();
          if (s.includes("conclu")) data.cell.styles.textColor = [0, 150, 0];
        }
      }
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;

    // --- 4. COMENTÁRIOS ---
    if (rdo.comentarios) {
      sectionHeader("Comentários da Engenharia");
      const textLines = doc.splitTextToSize(rdo.comentarios, contentWidth - 10);
      const boxH = (textLines.length * 5) + 12;
      checkPageBreak(boxH);
      
      doc.setFillColor(252, 252, 252);
      doc.setDrawColor(220, 220, 220);
      doc.roundedRect(marginX, currentY, contentWidth, boxH, 1, 1, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text(textLines, marginX + 5, currentY + 8);
      currentY += boxH + 15;
    }

    // --- 5. FOTOS ---
    if (rdo.fotos?.length > 0) {
      sectionHeader("Registro Fotográfico");
      const imgW = (contentWidth / 2) - 5;
      const imgH = 45;

      rdo.fotos.forEach((foto: any, i: number) => {
        const xPos = i % 2 === 0 ? marginX : marginX + imgW + 10;
        checkPageBreak(imgH + 20);
        if (foto.preview) {
          try {
            doc.addImage(foto.preview, "JPEG", xPos, currentY, imgW, imgH);
            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.text(foto.legenda || "", xPos, currentY + imgH + 4);
          } catch (e) {}
        }
        if (i % 2 !== 0 || i === rdo.fotos.length - 1) currentY += imgH + 15;
      });
    }

    // --- 6. ASSINATURAS ---
    if (rdo.assinaturas?.length > 0) {
      sectionHeader("Validação");
      currentY += 5;
      rdo.assinaturas.forEach((a: any, i: number) => {
        const xPos = i % 2 === 0 ? marginX : pageWidth / 2 + 5;
        checkPageBreak(40);
        if (a.assinatura) {
          try { doc.addImage(a.assinatura, "PNG", xPos + 10, currentY, 40, 15); } catch(e) {}
        }
        doc.setDrawColor(200);
        doc.line(xPos, currentY + 17, xPos + 60, currentY + 17);
        doc.setFontSize(8);
        doc.text(a.empresa || "", xPos, currentY + 22);
        if (i % 2 !== 0 || i === rdo.assinaturas.length - 1) currentY += 30;
      });
    }

    const totalP = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalP; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(180);
      doc.text(`RDO ${projectName} - Página ${i} de ${totalP}`, pageWidth / 2, 290, { align: "center" });
    }

    doc.save(`RDO_${projectName}_${rdo.data}.pdf`);
  }

  if (!rdo) return <AdminShell><p className="p-10">Carregando...</p></AdminShell>;

  return (
    <AdminShell>
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h1 className="text-xl font-bold text-[#391e2a]">Visualizar Relatório</h1>
              <p className="text-gray-500 text-sm">{projectName} • {rdo.data}</p>
            </div>
            <Button onClick={gerarPDF} className="bg-[#391e2a] hover:bg-[#2a161f] text-white px-6">
              Gerar PDF Profissional
            </Button>
          </div>
          
          <div className="p-12 flex flex-col items-center justify-center text-center">
             <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-[#80b02d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
             </div>
             <h2 className="text-lg font-semibold">Layout Clean Ajustado</h2>
             <p className="text-sm text-gray-500 max-w-xs mt-2">
                O cabeçalho agora é branco para preservar o seu logo original, com detalhes elegantes nas suas cores institucionais.
             </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}