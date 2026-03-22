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

    // --- 1. HEADER EXECUTIVO COM DEGRADÊ ---
    const headerHeight = 38;
    const colorStart = [240, 240, 242];
    const colorEnd = brandPurple;

    doc.setLineWidth(0.1); 
    for (let x = 0; x < pageWidth; x += 0.1) {
      const ratio = x / pageWidth;
      const r = Math.round(colorStart[0] * (1 - ratio) + colorEnd[0] * ratio);
      const g = Math.round(colorStart[1] * (1 - ratio) + colorEnd[1] * ratio);
      const b = Math.round(colorStart[2] * (1 - ratio) + colorEnd[2] * ratio);
      doc.setDrawColor(r, g, b);
      doc.line(x, 0, x, headerHeight);
    }

    doc.setFillColor(...brandGreen);
    doc.rect(0, headerHeight - 1, pageWidth, 1, "F");

    try { 
      doc.addImage("/logo.png", "PNG", marginX, 10, 38, 14); 
    } catch (e) {
      console.warn("Logo não carregado");
    }

    doc.setTextColor(...brandPurple); 
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DIÁRIO DE OBRA", pageWidth - marginX, 16, { align: "right" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`${projectName}`, pageWidth - marginX, 23, { align: "right" });
    doc.text(`DATA: ${rdo.data} | PERÍODO: ${rdo.inicio} às ${rdo.fim}`, pageWidth - marginX, 28, { align: "right" });

    currentY = 50;

    // --- 2. DASHBOARD KPIs ---
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

    // --- 3. TABELAS ---
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

    // --- 4. COMENTÁRIOS ---
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

    // --- 5. FOTOS (COM PROPORÇÃO CORRETA E AWAIT) ---
    if (rdo.fotos?.length > 0) {
      sectionHeader("Evidências Fotográficas");
      
      const boxW = (contentWidth / 2) - 5; // Largura do "container" da foto
      const boxH = 55; // Altura máxima do "container" da foto

      for (let i = 0; i < rdo.fotos.length; i++) {
        const foto = rdo.fotos[i];
        const isPar = i % 2 === 0;
        const xPos = isPar ? marginX : marginX + boxW + 10;
        
        // Verifica quebra de página antes de começar uma nova linha (quando é par)
        if (isPar) {
            checkPageBreak(boxH + 20);
        }
        
        if (foto.storagePath) {
          try {
            // Baixa a imagem do Supabase
            const { data: urlData } = supabase.storage.from('rdo-photos').getPublicUrl(foto.storagePath);
            const response = await fetch(urlData.publicUrl);
            const blob = await response.blob();
            
            // Converte para Base64
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            // 🔥 CÁLCULO DE PROPORÇÃO (ASPECT RATIO)
            const props = doc.getImageProperties(base64);
            let imgRenderW = boxW;
            let imgRenderH = (props.height * boxW) / props.width;

            // Se a imagem calculada for mais alta que nossa caixa, limitamos a altura e recalculamos a largura
            if (imgRenderH > boxH) {
                imgRenderH = boxH;
                imgRenderW = (props.width * boxH) / props.height;
            }

            // Centraliza a imagem dentro da nossa caixa (boxW x boxH)
            const xOffset = xPos + (boxW - imgRenderW) / 2;
            const yOffset = currentY + (boxH - imgRenderH) / 2;

            // Fundo cinza claro para manter a grade alinhada visualmente
            doc.setFillColor(248, 248, 248);
            doc.rect(xPos, currentY, boxW, boxH, "F");

            // Desenha a imagem centralizada e proporcional
            doc.addImage(base64, "JPEG", xOffset, yOffset, imgRenderW, imgRenderH);
            
            // Borda ao redor do container
            doc.setDrawColor(220);
            doc.rect(xPos, currentY, boxW, boxH, "S");
            
          } catch (e) {
            console.error("Erro ao processar foto PDF:", e);
            doc.setFillColor(240, 240, 240);
            doc.rect(xPos, currentY, boxW, boxH, "F");
            doc.setFontSize(8);
            doc.setTextColor(200, 0, 0);
            doc.text("Erro ao carregar imagem", xPos + 5, currentY + (boxH / 2));
          }
        }
        
        // Legenda sempre alinhada com a caixa
        doc.setFontSize(7);
        doc.setTextColor(100);
        const legendaText = doc.splitTextToSize(foto.legenda || "Sem legenda", boxW);
        doc.text(legendaText, xPos, currentY + boxH + 5);

        // Ajusta a altura (Y) apenas quando for o item ímpar (fecha a linha) ou for a última foto
        if (!isPar || i === rdo.fotos.length - 1) {
          currentY += boxH + 15;
        }
      }
    }

    // --- 6. ASSINATURAS (COM PROTEÇÃO DE QUEBRA DE PÁGINA) ---
    if (rdo.assinaturas?.length > 0) {
      // 🔥 Força a checagem de página ANTES de imprimir o título
      // Pede 50 de espaço: 10 pro título + 40 pra pelo menos 1 assinatura
      checkPageBreak(50); 
      
      sectionHeader("Validação e Assinaturas");
      currentY += 5;

      rdo.assinaturas.forEach((a: any, i: number) => {
        const xPos = i % 2 === 0 ? marginX : pageWidth / 2 + 5;
        checkPageBreak(35);
        
        if (a.assinatura) {
          try { doc.addImage(a.assinatura, "PNG", xPos + 10, currentY, 40, 15); } catch(e) {}
        }
        
        doc.setDrawColor(200);
        doc.line(xPos, currentY + 16, xPos + 60, currentY + 16);
        doc.setFontSize(8);
        doc.setTextColor(...textDark);
        doc.text(a.empresa || "Responsável", xPos, currentY + 21);
        
        if (i % 2 !== 0 || i === rdo.assinaturas.length - 1) currentY += 30;
      });
    }

    // --- RODAPÉ ---
    const totalP = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalP; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(180);
      doc.text(`RDO ${projectName} - Página ${i} de ${totalP} - Emitido eletronicamente`, pageWidth / 2, 290, { align: "center" });
    }

    doc.save(`RDO_${projectName}_${rdo.data}.pdf`);
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
             <h2 className="text-lg font-semibold text-gray-800">Pronto para Exportação</h2>
             <p className="text-gray-500 text-sm mt-2 max-w-sm">
                O PDF agora conta com fotos na proporção correta e quebra de página inteligente para as assinaturas!
             </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}