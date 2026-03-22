"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ================= HELPERS (Padrão Pro) =================

// Função auxiliar assíncrona para replicar o efeito CSS 'brightness-0 invert'
// usando manipulação de canvas pura. Isso garante que usemos apenas UM arquivo de logo.png no sistema.
async function generateWhiteLogoBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Previne erros de Cross-Origin se o logo estiver em um CDN
    img.crossOrigin = "Anonymous"; 
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Não foi possível obter o contexto do canvas"));
        return;
      }

      // 1. Desenha a imagem original no canvas
      ctx.drawImage(img, 0, 0);

      // 2. Aplica a manipulação de pixels (Lógica: brightness-0 + invert)
      // brightness(0) => zera r,g,b. invert(1) => r,g,b viram 255 (branco).
      ctx.filter = "brightness(0) invert(1)";
      ctx.drawImage(canvas, 0, 0); // Redesenha com o filtro aplicado

      // 3. Converte para Base64 (formato que o jsPDF entende)
      const base64DataData = canvas.toDataURL("image/png");
      resolve(base64DataData);
    };

    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

// ================= PAGE =================

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

    // --- CARREGAMENTO INICIAL DO LOGO BRANCO ---
    let whiteLogoBase64: string | null = null;
    try {
      // Chamamos nossa função auxiliar para converter o logo original
      whiteLogoBase64 = await generateWhiteLogoBase64("/logo.png");
    } catch (e) {
      console.error("Erro ao processar o logo branco para o PDF:", e);
      // Se der erro, whiteLogoBase64 continua null e o PDF será gerado sem logo no header
    }

    const doc = new jsPDF("p", "mm", "a4");
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginX * 2;
    let currentY = 0;

    // --- PALETA DE CORES GREENSOIL (Padrão Pro) ---
    const brandPurple: [number, number, number] = [57, 30, 42];
    const brandGreen: [number, number, number] = [128, 176, 45];
    const lightGray: [number, number, number] = [248, 248, 250];

    // --- HELPERS DE LAYOUT ---
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

    // --- 1. HEADER EXECUTIVO COM FUNDO ESCURO (CORRIGIDO COM LOGO BRANCO) ---
    doc.setFillColor(...brandPurple);
    doc.rect(0, 0, pageWidth, 35, "F");

    // 🔥 NOVA LÓGICA DO LOGO: Adiciona o logo branco centralizado verticalmente no header roxo
    if (whiteLogoBase64) {
      try {
        // Centralizado verticalmente (altura 35mm, logo 10mm, y=12.5mm)
        doc.addImage(whiteLogoBase64, "PNG", marginX, 12.5, 35, 10); 
      } catch (e) {
        console.error("Erro ao adicionar imagem branca ao PDF:", e);
      }
    }

    // Textos do Header em Branco (Sempre estiveram corretos)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("RELATÓRIO DIÁRIO DE OBRA", pageWidth - marginX, 15, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${projectName} | DATA: ${rdo.data}`, pageWidth - marginX, 22, { align: "right" });
    doc.text(`HORÁRIO: ${rdo.inicio} às ${rdo.fim}`, pageWidth - marginX, 27, { align: "right" });

    currentY = 45;

    // ================= RESTO DO CÓDIGO (INTACTO) =================

    // --- 2. DASHBOARD DE INDICADORES (KPIs) ---
    const colabTotal = rdo.envolvidos?.reduce((a: number, b: any) => a + (Number(b.colaboradores) || 0), 0) || 0;
    const cards = [
      { label: "EFETIVO TOTAL", val: `${colabTotal} PESSOAS` },
      { label: "CLIMA", val: rdo.clima?.[0]?.condicao || "N/A" },
      { label: "STATUS SEGURANÇA", val: rdo.sheq?.incidente === "Não" ? "SEM OCORRÊNCIAS" : "ALERTA" }
    ];

    cards.forEach((card, i) => {
      const x = marginX + (i * (contentWidth / 3 + 2));
      doc.setFillColor(...lightGray);
      doc.roundedRect(x, currentY, contentWidth / 3 - 4, 18, 1, 1, "F");
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(card.label, x + 4, currentY + 6);
      doc.setFontSize(9);
      doc.setTextColor(...brandPurple);
      doc.setFont("helvetica", "bold");
      doc.text(card.val, x + 4, currentY + 13);
    });
    currentY += 28;

    const tableConfig: any = {
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: brandPurple, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [252, 252, 252] }
    };

    // --- 3. TABELA DE CLIMA ---
    sectionHeader("Condições Climáticas");
    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [["Período", "Tempo", "Condição", "Impacto/Razão"]],
      body: rdo.clima?.map((c: any) => [c.periodo, c.tempo, c.condicao, c.razao || "-"]) || []
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;

    // --- 4. TABELA DE ENVOLVIDOS ---
    sectionHeader("Mão de Obra e Efetivo");
    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [["Empresa Parceira", "N° Colaboradores", "Função Principal"]],
      body: rdo.envolvidos?.map((e: any) => [e.empresa, e.colaboradores, e.funcao]) || []
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;

    // --- 5. TABELA DE ATIVIDADES ---
    sectionHeader("Progresso das Atividades");
    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [["Atividade Realizada", "Responsável", "Status", "Observações"]],
      body: rdo.atividades?.map((a: any) => [a.atividade, a.empresa, a.status, a.obs || "-"]) || [],
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const s = String(data.cell.raw).toLowerCase();
          if (s.includes("conclu")) data.cell.styles.textColor = [0, 150, 0];
          if (s.includes("andamento")) data.cell.styles.textColor = [200, 120, 0];
        }
      }
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;

    // --- 6. TABELA DE SHEQ ---
    sectionHeader("Segurança, Saúde e Meio Ambiente (SHEQ)");
    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [["Tipo de Ocorrência", "Houve Registro?", "Descrição/Observação"]],
      body: [
        ["Incidentes de Segurança", rdo.sheq?.incidente || "Não", rdo.sheq?.incidenteObs || "-"],
        ["Vazamentos / Meio Ambiente", rdo.sheq?.vazamento || "Não", rdo.sheq?.vazamentoObs || "-"]
      ]
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;

    // --- 7. COMENTÁRIOS GERAIS ---
    if (rdo.comentarios) {
      sectionHeader("Notas e Comentários Adicionais");
      const textLines = doc.splitTextToSize(rdo.comentarios, contentWidth - 10);
      const boxH = (textLines.length * 5) + 10;
      checkPageBreak(boxH);
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(230, 230, 230);
      doc.rect(marginX, currentY, contentWidth, boxH, "FD");
      doc.setTextColor(60, 60, 60);
      doc.setFont("helvetica", "normal");
      doc.text(textLines, marginX + 5, currentY + 7);
      currentY += boxH + 15;
    }

    // --- 8. GALERIA DE FOTOS ---
    if (rdo.fotos?.length > 0) {
      sectionHeader("Registro Fotográfico");
      
      const boxW = (contentWidth / 2) - 5; 
      const boxH = 55;

      for (let i = 0; i < rdo.fotos.length; i++) {
        const foto = rdo.fotos[i];
        const isPar = i % 2 === 0;
        const xPos = isPar ? marginX : marginX + boxW + 10;
        
        if (isPar) checkPageBreak(boxH + 20);
        
        if (foto.storagePath) {
          try {
            const { data: urlData } = supabase.storage.from('rdo-photos').getPublicUrl(foto.storagePath);
            const response = await fetch(urlData.publicUrl);
            const blob = await response.blob();
            
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            const props = doc.getImageProperties(base64);
            let imgRenderW = boxW;
            let imgRenderH = (props.height * boxW) / props.width;

            if (imgRenderH > boxH) {
                imgRenderH = boxH;
                imgRenderW = (props.width * boxH) / props.height;
            }

            const xOffset = xPos + (boxW - imgRenderW) / 2;
            const yOffset = currentY + (boxH - imgRenderH) / 2;

            doc.setFillColor(248, 248, 248);
            doc.rect(xPos, currentY, boxW, boxH, "F");
            doc.addImage(base64, "JPEG", xOffset, yOffset, imgRenderW, imgRenderH);
            doc.setDrawColor(220);
            doc.rect(xPos, currentY, boxW, boxH, "S");
            
          } catch (e) {
            console.error("Erro ao carregar imagem para o PDF:", e);
            doc.setFillColor(240, 240, 240);
            doc.rect(xPos, currentY, boxW, boxH, "F");
            doc.setFontSize(8);
            doc.setTextColor(200, 0, 0);
            doc.text("Erro na foto", xPos + 5, currentY + (boxH / 2));
          }
        }
        
        doc.setFontSize(7);
        doc.setTextColor(120);
        const legendaText = doc.splitTextToSize(foto.legenda || "Sem legenda", boxW);
        doc.text(legendaText, xPos, currentY + boxH + 4);

        if (!isPar || i === rdo.fotos.length - 1) {
          currentY += boxH + 15;
        }
      }
    }

    // --- 9. ASSINATURAS ---
    if (rdo.assinaturas?.length > 0) {
      checkPageBreak(50);
      sectionHeader("Assinaturas de Responsabilidade");
      currentY += 5;

      rdo.assinaturas.forEach((a: any, i: number) => {
        const xPos = i % 2 === 0 ? marginX : pageWidth / 2 + 5;
        checkPageBreak(35);
        
        if (a.assinatura) {
          try { doc.addImage(a.assinatura, "PNG", xPos + 10, currentY, 40, 15); } catch(e) {}
        }
        
        doc.setDrawColor(180);
        doc.line(xPos, currentY + 16, xPos + 60, currentY + 16);
        doc.setFontSize(8);
        doc.text(a.empresa || "Responsável", xPos, currentY + 21);
        
        if (i % 2 !== 0 || i === rdo.assinaturas.length - 1) currentY += 30;
      });
    }

    // RODAPÉ FINAL
    const totalP = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalP; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(180);
      doc.text(`Documento gerado eletronicamente - Página ${i} de ${totalP}`, pageWidth / 2, 290, { align: "center" });
    }

    doc.save(`RDO_COMPLETO_${projectName}_${rdo.data}.pdf`);
  }

  if (!rdo) return <AdminShell><p className="p-10">Carregando...</p></AdminShell>;

  return (
    <AdminShell>
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100 animate-fade-in duration-300">
          
          {/* Header Visual do Painel (Intacto) */}
          <div className="bg-[#391e2a] p-8 text-white flex justify-between items-center shadow-lg">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Visualização do Diário</h1>
              <p className="text-[#80b02d] font-semibold mt-1 uppercase tracking-wider text-xs">{projectName} • DATA: {rdo.data}</p>
            </div>
            <Button onClick={gerarPDF} className="bg-[#80b02d] hover:bg-[#6a9425] text-white px-8 h-12 rounded-lg font-bold shadow-lg transition-transform active:scale-95">
              BAIXAR RDO COMPLETO
            </Button>
          </div>
          
          {/* Conteúdo Visual do Painel (Intacto) */}
          <div className="p-12 text-center bg-gray-50/50">
             <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 inline-block">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-5">O PDF gerado incluirá:</p>
                <ul className="text-left text-sm space-y-2.5 text-gray-600 mb-6 font-medium">
                  <li className="flex items-center"><span className="w-2.5 h-2.5 bg-[#80b02d] rounded-full mr-3 shadow"></span> Dashboard Executivo de Indicadores</li>
                  <li className="flex items-center"><span className="w-2.5 h-2.5 bg-[#80b02d] rounded-full mr-3 shadow"></span> Tabelas Técnicas (Clima, Efetivo, Atividades, SHEQ)</li>
                  <li className="flex items-center"><span className="w-2.5 h-2.5 bg-[#80b02d] rounded-full mr-3 shadow"></span> Notas de Campo e Comentários Adicionais</li>
                  <li className="flex items-center"><span className="w-2.5 h-2.5 bg-[#80b02d] rounded-full mr-3 shadow"></span> Galeria de Fotos Proporcionais e Assinaturas</li>
                </ul>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">GreenSoil Work Order System</p>
             </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}