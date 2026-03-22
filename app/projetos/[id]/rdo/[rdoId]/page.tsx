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

    // --- PALETA DE CORES ---
    const brandPurple: [number, number, number] = [57, 30, 42];
    const brandGreen: [number, number, number] = [128, 176, 45];
    const textDark: [number, number, number] = [40, 40, 40];

    // --- HELPERS ---
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
      doc.setFontSize(11);
      doc.setTextColor(...brandPurple);
      doc.text(title.toUpperCase(), marginX, currentY);
      doc.setDrawColor(...brandGreen);
      doc.setLineWidth(0.8);
      doc.line(marginX, currentY + 2, marginX + 15, currentY + 2);
      currentY += 10;
    };

    // =========================================================
    // --- 1. HEADER EXECUTIVO COM DEGRADÊ (GRADIENT) ---
    // =========================================================
    const headerHeight = 38;
    
    // Cores do Degradê (RGB)
    const colorStart = [240, 240, 242]; // Cinza Claro (Esquerda)
    const colorEnd = brandPurple;        // Roxo da Paleta (Direita)

    // Lógica para desenhar o degradê (centenas de linhas finas)
    doc.setLineWidth(0.1); 
    for (let x = 0; x < pageWidth; x += 0.1) {
      // Calcula a proporção atual (de 0 a 1)
      const ratio = x / pageWidth;
      
      // Interpolação das cores RGB
      const r = Math.round(colorStart[0] * (1 - ratio) + colorEnd[0] * ratio);
      const g = Math.round(colorStart[1] * (1 - ratio) + colorEnd[1] * ratio);
      const b = Math.round(colorStart[2] * (1 - ratio) + colorEnd[2] * ratio);
      
      // Define a cor e desenha uma linha vertical fina
      doc.setDrawColor(r, g, b);
      doc.line(x, 0, x, headerHeight);
    }

    // Linha de detalhe verde no final do header
    doc.setFillColor(...brandGreen);
    doc.rect(0, headerHeight - 1, pageWidth, 1, "F");

    // -- CONTEÚDO DO HEADER --
    try { 
      // O logo agora aparece perfeitamente sobre o início do degradê (cinza claro)
      doc.addImage("/logo.png", "PNG", marginX, 10, 38, 14); 
    } catch (e) {
      console.warn("Logo não carregado para o PDF");
    }

    // Título e Informações (Texto em Roxo para contraste)
    doc.setTextColor(...brandPurple); 
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DIÁRIO DE OBRA", pageWidth - marginX, 16, { align: "right" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80); // Um cinza escuro para os detalhes
    doc.text(`${projectName}`, pageWidth - marginX, 23, { align: "right" });
    doc.text(`DATA: ${rdo.data} | PERÍODO: ${rdo.inicio} às ${rdo.fim}`, pageWidth - marginX, 28, { align: "right" });

    currentY = 50;

    // =========================================================
    // --- 2. RESTANTE DO DOCUMENTO (KPIs E TABELAS) ---
    // =========================================================
    
    // Dashboard KPIs
    const colabTotal = rdo.envolvidos?.reduce((a: number, b: any) => a + (Number(b.colaboradores) || 0), 0) || 0;
    const cards = [
      { label: "EFETIVO TOTAL", val: `${colabTotal} PESSOAS` },
      { label: "CLIMA", val: rdo.clima?.[0]?.condicao || "N/A" },
      { label: "SEGURANÇA (SHEQ)", val: rdo.sheq?.incidente === "Não" ? "OPER. SEGURA" : "ALERTA" }
    ];

    cards.forEach((card, i) => {
      const x = marginX + (i * (contentWidth / 3 + 2));
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(220, 220, 220);
      doc.roundedRect(x, currentY, contentWidth / 3 - 4, 18, 1, 1, "FD");
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(card.label, x + 4, currentY + 6);
      doc.setFontSize(9);
      doc.setTextColor(...brandPurple);
      doc.setFont("helvetica", "bold");
      doc.text(card.val, x + 4, currentY + 13);
    });
    currentY += 30;

    const tableConfig: any = {
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8, cellPadding: 3, textColor: textDark },
      headStyles: { fillColor: brandPurple, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [252, 252, 252] }
    };

    // Tabelas Técnicas
    if (rdo.clima?.length > 0) {
      sectionHeader("Condições Climáticas");
      autoTable(doc, {
        ...tableConfig,
        startY: currentY,
        head: [["Período", "Tempo", "Condição", "Impacto/Razão"]],
        body: rdo.clima?.map((c: any) => [c.periodo, c.tempo, c.condicao, c.razao || "-"])
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    if (rdo.envolvidos?.length > 0) {
      sectionHeader("Mão de Obra e Efetivo");
      autoTable(doc, {
        ...tableConfig,
        startY: currentY,
        head: [["Empresa Parceira", "N° Colaboradores", "Função Principal"]],
        body: rdo.envolvidos?.map((e: any) => [e.empresa, e.colaboradores, e.funcao])
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    if (rdo.atividades?.length > 0) {
      sectionHeader("Cronograma de Atividades");
      autoTable(doc, {
        ...tableConfig,
        startY: currentY,
        head: [["Atividade", "Responsável", "Status", "Observações"]],
        body: rdo.atividades?.map((a: any) => [a.atividade, a.empresa, a.status, a.obs || "-"]),
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 2) {
            const s = String(data.cell.raw).toLowerCase();
            if (s.includes("conclu")) data.cell.styles.textColor = [0, 150, 0];
            if (s.includes("andamento")) data.cell.styles.textColor = [180, 100, 0];
          }
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    if (rdo.sheq) {
      sectionHeader("Segurança e Meio Ambiente (SHEQ)");
      autoTable(doc, {
        ...tableConfig,
        startY: currentY,
        head: [["Ocorrência", "Registro", "Observação"]],
        body: [
          ["Incidentes de Segurança", rdo.sheq?.incidente || "Não", rdo.sheq?.incidenteObs || "-"],
          ["Vazamentos / Meio Ambiente", rdo.sheq?.vazamento || "Não", rdo.sheq?.vazamentoObs || "-"]
        ]
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // Comentários
    if (rdo.comentarios) {
      sectionHeader("Notas e Observações de Campo");
      const textLines = doc.splitTextToSize(rdo.comentarios, contentWidth - 10);
      const boxH = (textLines.length * 5) + 10;
      checkPageBreak(boxH);
      doc.setFillColor(252, 252, 252);
      doc.setDrawColor(230, 230, 230);
      doc.rect(marginX, currentY, contentWidth, boxH, "FD");
      doc.setTextColor(...textDark);
      doc.setFont("helvetica", "normal");
      doc.text(textLines, marginX + 5, currentY + 7);
      currentY += boxH + 15;
    }

    // Fotos
    if (rdo.fotos?.length > 0) {
      sectionHeader("Evidências Fotográficas");
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
            doc.text(foto.legenda || "Sem legenda", xPos, currentY + imgH + 4);
          } catch (e) {}
        }
        if (i % 2 !== 0 || i === rdo.fotos.length - 1) currentY += imgH + 15;
      });
    }

    // Assinaturas
    if (rdo.assinaturas?.length > 0) {
      sectionHeader("Validação e Assinaturas");
      currentY += 5;
      rdo.assinaturas.forEach((a: any, i: number) => {
        const xPos = i % 2 === 0 ? marginX : pageWidth / 2 + 5;
        checkPageBreak(35);
        if (a.assinatura) {
          try { doc.addImage(a.assinatura, "PNG", xPos + 10, currentY, 40, 12); } catch(e) {}
        }
        doc.setDrawColor(200);
        doc.line(xPos, currentY + 14, xPos + 60, currentY + 14);
        doc.setFontSize(8);
        doc.text(a.empresa || "Responsável", xPos, currentY + 19);
        if (i % 2 !== 0 || i === rdo.assinaturas.length - 1) currentY += 25;
      });
    }

    // Rodapé
    const totalP = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalP; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(180);
      doc.text(`RDO ${projectName} - Página ${i} de ${totalP} - Emitido eletronicamente`, pageWidth / 2, 290, { align: "center" });
    }

    doc.save(`RDO_GRADIENT_${projectName}_${rdo.data}.pdf`);
  }

  if (!rdo) return <AdminShell><p className="p-10">Carregando...</p></AdminShell>;

  return (
    <AdminShell>
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="p-8 border-b-4 border-[#80b02d] flex justify-between items-center bg-gray-50">
            <div>
              <h1 className="text-2xl font-bold text-[#391e2a]">Relatório Executivo</h1>
              <p className="text-gray-600 font-medium mt-1">{projectName} • {rdo.data}</p>
            </div>
            <Button onClick={gerarPDF} className="bg-[#391e2a] hover:bg-[#2a161f] text-white px-10 h-12 rounded-lg font-bold shadow-lg transition-all active:scale-95">
              BAIXAR RDO PREMIUM
            </Button>
          </div>
          
          <div className="p-10 text-center flex flex-col items-center">
             <div className="inline-block p-4 rounded-full bg-purple-50 mb-4 border border-purple-100">
                <svg className="w-10 h-10 text-[#391e2a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
             </div>
             <h2 className="text-lg font-semibold text-gray-800">Design de Alta Costura</h2>
             <p className="text-gray-500 text-sm mt-2 max-w-sm">
                O PDF agora conta com um cabeçalho em degradê que preserva o seu logo e traz a sofisticação da paleta roxa, mantendo todas as tabelas técnicas completas.
             </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}