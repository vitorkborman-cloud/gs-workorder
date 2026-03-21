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
    const { data } = await supabase
      .from("rdo_reports")
      .select("*")
      .eq("id", rdoId)
      .single();

    if (data) setRdo(data);

    const { data: proj } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    if (proj) setProjectName(proj.name);
  }

  async function gerarPDF() {
    if (!rdo) return;

    const doc = new jsPDF("p", "mm", "a4");
    
    // Configurações de Layout
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginX * 2;
    let currentY = 20;

    // Identidade Visual
    const brandPurple: [number, number, number] = [57, 30, 42];
    const brandGreen: [number, number, number] = [128, 176, 45];
    const textColor: [number, number, number] = [60, 60, 60];

    // Funções Auxiliares internas para evitar erros de escopo
    const checkPageBreak = (neededSpace: number) => {
      if (currentY + neededSpace > 275) {
        doc.addPage();
        currentY = 20;
        return true;
      }
      return false;
    };

    const addSectionTitle = (title: string) => {
      checkPageBreak(15);
      doc.setFillColor(...brandGreen);
      doc.rect(marginX, currentY, 3, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...brandPurple);
      doc.text(title, marginX + 5, currentY + 5);
      currentY += 12;
    };

    // --- CABEÇALHO ---
    try {
      doc.addImage("/logo.png", "PNG", marginX, currentY, 40, 12);
    } catch (e) {
      console.warn("Logo não carregado");
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...brandPurple);
    doc.text("RELATÓRIO DIÁRIO DE OBRA", marginX + 45, currentY + 7);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Data: ${rdo.data || "-"}`, pageWidth - marginX, currentY + 2, { align: "right" });
    doc.text(`Projeto: ${projectName}`, pageWidth - marginX, currentY + 8, { align: "right" });

    currentY += 20;
    doc.setDrawColor(...brandGreen);
    doc.setLineWidth(0.5);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    currentY += 10;

    // --- TABELAS ---
    const tableStyles: any = {
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: brandPurple, textColor: 255 },
      margin: { left: marginX, right: marginX },
    };

    // 1. Clima
    if (rdo.clima?.length > 0) {
      addSectionTitle("Condições Climáticas");
      autoTable(doc, {
        ...tableStyles,
        startY: currentY,
        head: [["Período", "Tempo", "Condição", "Razão"]],
        body: rdo.clima.map((c: any) => [c.periodo, c.tempo, c.condicao, c.razao || "-"]),
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // 2. Envolvidos
    if (rdo.envolvidos?.length > 0) {
      addSectionTitle("Efetivo no Local");
      autoTable(doc, {
        ...tableStyles,
        startY: currentY,
        head: [["Empresa", "N° Colab.", "Função"]],
        body: rdo.envolvidos.map((e: any) => [e.empresa, e.colaboradores, e.funcao]),
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // 3. Atividades
    if (rdo.atividades?.length > 0) {
      addSectionTitle("Atividades Realizadas");
      autoTable(doc, {
        ...tableStyles,
        startY: currentY,
        head: [["Atividade", "Empresa", "Status", "Obs"]],
        body: rdo.atividades.map((a: any) => [a.atividade, a.empresa, a.status, a.obs || "-"]),
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // 4. Comentários
    if (rdo.comentarios) {
      addSectionTitle("Comentários Gerais");
      const lines = doc.splitTextToSize(rdo.comentarios, contentWidth - 6);
      const h = (lines.length * 5) + 8;
      checkPageBreak(h);
      doc.setFillColor(248, 248, 248);
      doc.rect(marginX, currentY, contentWidth, h, "F");
      doc.setFontSize(10);
      doc.setTextColor(...textColor);
      doc.text(lines, marginX + 3, currentY + 6);
      currentY += h + 10;
    }

    // --- FOTOS ---
    if (rdo.fotos?.length > 0) {
      addSectionTitle("Registro Fotográfico");
      const imgW = (contentWidth / 2) - 4;
      const imgH = 50;
      
      rdo.fotos.forEach((foto: any, i: number) => {
        const isEven = i % 2 === 0;
        const xPos = isEven ? marginX : marginX + imgW + 8;
        
        checkPageBreak(imgH + 15);
        
        if (foto.preview) {
          try {
            doc.addImage(foto.preview, "JPEG", xPos, currentY, imgW, imgH);
          } catch (e) {}
        }
        doc.setFontSize(8);
        doc.text(foto.legenda || "", xPos, currentY + imgH + 4);
        
        if (!isEven || i === rdo.fotos.length - 1) {
          currentY += imgH + 15;
        }
      });
    }

    // --- ASSINATURAS ---
    if (rdo.assinaturas?.length > 0) {
      addSectionTitle("Assinaturas");
      currentY += 5;
      rdo.assinaturas.forEach((a: any, i: number) => {
        checkPageBreak(30);
        const xPos = i % 2 === 0 ? marginX : pageWidth / 2 + 5;
        
        if (a.assinatura) {
          try { doc.addImage(a.assinatura, "PNG", xPos + 10, currentY, 35, 12); } catch(e) {}
        }
        doc.setDrawColor(150);
        doc.line(xPos, currentY + 13, xPos + 60, currentY + 13);
        doc.setFontSize(9);
        doc.text(a.empresa || "", xPos, currentY + 18);
        
        if (i % 2 !== 0 || i === rdo.assinaturas.length - 1) currentY += 25;
      });
    }

    // Rodapé com paginação
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, 290, { align: "center" });
    }

    doc.save(`RDO_${projectName}_${rdo.data}.pdf`);
  }

  if (!rdo) {
    return (
      <AdminShell>
        <p className="p-10">Carregando...</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border-l-4 border-[#80b02d]">
          <div>
            <h1 className="text-2xl font-bold text-[#391e2a]">Relatório Diário de Obra</h1>
            <p className="text-gray-500">{projectName} | {rdo.data}</p>
          </div>
          <Button onClick={gerarPDF} className="bg-[#391e2a] hover:bg-[#4d2a39]">
            Exportar PDF Premium
          </Button>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md border border-gray-100">
          {/* O conteúdo visual da tela permanece aqui se você quiser visualizar antes de baixar */}
          <p className="text-sm text-gray-400 mb-4">Pré-visualização do Relatório</p>
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <p><b>Início:</b> {rdo.inicio}</p>
                <p><b>Fim:</b> {rdo.fim}</p>
             </div>
             {/* ... você pode adicionar outros campos aqui se quiser ver na tela também ... */}
             <p className="italic text-gray-600">O PDF exportado conterá todos os detalhes, fotos e assinaturas formatados.</p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}