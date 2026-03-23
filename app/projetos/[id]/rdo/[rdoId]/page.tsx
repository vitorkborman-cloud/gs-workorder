"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ================= HELPERS (Padrão Pro) =================

async function generateWhiteLogoBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
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

      ctx.drawImage(img, 0, 0);
      ctx.filter = "brightness(0) invert(1)";
      ctx.drawImage(canvas, 0, 0); 
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
  
  // --- ESTADOS DE EDIÇÃO ---
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("rdo_reports").select("*").eq("id", rdoId).single();
    if (data) setRdo(data);
    const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single();
    if (proj) setProjectName(proj.name);
  }

  // --- FUNÇÃO PARA SALVAR NO SUPABASE ---
  async function salvarAlteracoes() {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("rdo_reports")
        .update({
          data: rdo.data,
          inicio: rdo.inicio,
          fim: rdo.fim,
          clima: rdo.clima,
          comentarios: rdo.comentarios,
          atividades: rdo.atividades,
          envolvidos: rdo.envolvidos,
          sheq: rdo.sheq,
          fotos: rdo.fotos 
        })
        .eq("id", rdoId);

      if (error) throw error;
      
      setIsEditing(false);
      alert("Alterações salvas com sucesso! O PDF já pode ser gerado com os novos dados.");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar as alterações.");
    } finally {
      setIsSaving(false);
    }
  }

  // --- FUNÇÃO PARA UPLOAD DE FOTO VIA DESKTOP ---
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `desktop_${Date.now()}.${fileExt}`;
      const filePath = `rdo_${rdoId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('rdo-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const newFoto = { storagePath: filePath, legenda: "" };
      setRdo({ ...rdo, fotos: [...(rdo.fotos || []), newFoto] });
      
    } catch (error) {
      console.error("Erro no upload da foto:", error);
      alert("Erro ao fazer upload da foto. Verifique as permissões do Supabase.");
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  }

  // --- HELPERS PARA ATUALIZAR ARRAYS E OBJETOS NO ESTADO ---
  const updateArrayItem = (arrayName: string, index: number, field: string, value: string) => {
    const newArray = [...rdo[arrayName]];
    newArray[index] = { ...newArray[index], [field]: value };
    setRdo({ ...rdo, [arrayName]: newArray });
  };

  const addArrayItem = (arrayName: string, emptyObj: any) => {
    const currentArray = rdo[arrayName] || [];
    setRdo({ ...rdo, [arrayName]: [...currentArray, emptyObj] });
  };

  const removeArrayItem = (arrayName: string, index: number) => {
    const newArray = rdo[arrayName].filter((_: any, i: number) => i !== index);
    setRdo({ ...rdo, [arrayName]: newArray });
  };

  const updateSheq = (field: string, value: string) => {
    setRdo({ ...rdo, sheq: { ...rdo.sheq, [field]: value } });
  };

  // --- GERAÇÃO DE PDF ---
  async function gerarPDF() {
    if (!rdo) return;

    let whiteLogoBase64: string | null = null;
    try {
      whiteLogoBase64 = await generateWhiteLogoBase64("/logo.png");
    } catch (e) {
      console.error("Erro ao processar o logo branco para o PDF:", e);
    }

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
      doc.setFontSize(11);
      doc.setTextColor(...brandPurple);
      doc.text(title.toUpperCase(), marginX, currentY);
      doc.setDrawColor(...brandGreen);
      doc.setLineWidth(0.8);
      doc.line(marginX, currentY + 2, marginX + 15, currentY + 2);
      currentY += 10;
    };

    doc.setFillColor(...brandPurple);
    doc.rect(0, 0, pageWidth, 35, "F");

    if (whiteLogoBase64) {
      try {
        doc.addImage(whiteLogoBase64, "PNG", marginX, 12.5, 35, 10); 
      } catch (e) {
        console.error("Erro ao adicionar imagem branca ao PDF:", e);
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("RELATÓRIO DIÁRIO DE OBRA", pageWidth - marginX, 15, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${projectName} | DATA: ${rdo.data}`, pageWidth - marginX, 22, { align: "right" });
    doc.text(`HORÁRIO: ${rdo.inicio} às ${rdo.fim}`, pageWidth - marginX, 27, { align: "right" });

    currentY = 45;

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

    sectionHeader("Condições Climáticas");
    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [["Período", "Tempo", "Condição", "Impacto/Razão"]],
      body: rdo.clima?.map((c: any) => [c.periodo, c.tempo, c.condicao, c.razao || "-"]) || []
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;

    sectionHeader("Mão de Obra e Efetivo");
    autoTable(doc, {
      ...tableConfig,
      startY: currentY,
      head: [["Empresa Parceira", "N° Colaboradores", "Função Principal"]],
      body: rdo.envolvidos?.map((e: any) => [e.empresa, e.colaboradores, e.funcao]) || []
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;

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
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100 animate-fade-in duration-300">
          
          {/* Header Visual do Painel */}
          <div className="bg-[#391e2a] p-8 text-white flex justify-between items-center shadow-lg">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Visualização do Diário</h1>
              <p className="text-[#80b02d] font-semibold mt-1 uppercase tracking-wider text-xs">{projectName} • DATA: {rdo.data}</p>
            </div>
            <div className="flex gap-3">
              {isEditing ? (
                <Button onClick={salvarAlteracoes} disabled={isSaving} className="bg-white text-[#391e2a] hover:bg-gray-100 h-12 px-6 font-bold shadow-sm">
                  {isSaving ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
                </Button>
              ) : (
                <Button onClick={() => setIsEditing(true)} className="bg-transparent border border-white/30 hover:bg-white/10 text-white h-12 px-6 font-bold shadow-sm">
                  EDITAR DADOS
                </Button>
              )}
              <Button onClick={gerarPDF} className="bg-[#80b02d] hover:bg-[#6a9425] text-white px-8 h-12 rounded-lg font-bold shadow-lg transition-transform active:scale-95">
                BAIXAR RDO COMPLETO
              </Button>
            </div>
          </div>

          {/* ÁREA DE EDIÇÃO INTERATIVA */}
          {isEditing && (
            <div className="p-8 border-b border-gray-100 bg-gray-50/30 space-y-8">
              
              {/* Informações Gerais (Data e Horários) */}
              <div>
                <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Informações Gerais</h3>
                <div className="grid grid-cols-3 gap-4 bg-white p-4 border rounded-md shadow-sm">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Data do RDO</label>
                    <input type="date" value={rdo.data || ""} onChange={(e) => setRdo({...rdo, data: e.target.value})} className="w-full text-sm border p-2 rounded outline-none focus:ring-1 focus:ring-[#80b02d]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Horário Início</label>
                    <input type="time" value={rdo.inicio || ""} onChange={(e) => setRdo({...rdo, inicio: e.target.value})} className="w-full text-sm border p-2 rounded outline-none focus:ring-1 focus:ring-[#80b02d]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Horário Fim</label>
                    <input type="time" value={rdo.fim || ""} onChange={(e) => setRdo({...rdo, fim: e.target.value})} className="w-full text-sm border p-2 rounded outline-none focus:ring-1 focus:ring-[#80b02d]" />
                  </div>
                </div>
              </div>

              {/* Clima */}
              <div>
                <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Condições Climáticas</h3>
                <div className="space-y-3">
                  {rdo.clima?.map((c: any, idx: number) => (
                    <div key={idx} className="flex gap-3 bg-white p-3 border rounded-md shadow-sm items-center">
                      <input type="text" value={c.periodo || ""} onChange={(e) => updateArrayItem('clima', idx, 'periodo', e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Período (Ex: Manhã)" />
                      <input type="text" value={c.tempo || ""} onChange={(e) => updateArrayItem('clima', idx, 'tempo', e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Tempo (Ex: Ensolarado)" />
                      <select value={c.condicao || ""} onChange={(e) => updateArrayItem('clima', idx, 'condicao', e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none">
                        <option value="Trabalhável">Trabalhável</option>
                        <option value="Parcialmente Trabalhável">Parcialmente Trabalhável</option>
                        <option value="Impraticável">Impraticável</option>
                      </select>
                      <input type="text" value={c.razao || ""} onChange={(e) => updateArrayItem('clima', idx, 'razao', e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Impacto/Razão" />
                      <button onClick={() => removeArrayItem('clima', idx)} className="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Remover linha">✕</button>
                    </div>
                  ))}
                  <button 
                    onClick={() => addArrayItem('clima', { periodo: "", tempo: "", condicao: "Trabalhável", razao: "" })}
                    className="text-xs font-bold text-[#80b02d] hover:text-[#6a9425] transition flex items-center gap-1 mt-2"
                  >
                    + ADICIONAR CLIMA
                  </button>
                </div>
              </div>

              {/* Atividades */}
              <div>
                <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Atividades</h3>
                <div className="space-y-3">
                  {rdo.atividades?.map((ativ: any, idx: number) => (
                    <div key={idx} className="flex gap-3 bg-white p-3 border rounded-md shadow-sm items-center">
                      <input type="text" value={ativ.atividade || ""} onChange={(e) => updateArrayItem('atividades', idx, 'atividade', e.target.value)} className="w-1/3 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Atividade" />
                      <input type="text" value={ativ.empresa || ""} onChange={(e) => updateArrayItem('atividades', idx, 'empresa', e.target.value)} className="w-1/4 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Responsável" />
                      <select value={ativ.status || ""} onChange={(e) => updateArrayItem('atividades', idx, 'status', e.target.value)} className="w-1/6 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none">
                        <option value="Concluído">Concluído</option>
                        <option value="Em Andamento">Em Andamento</option>
                        <option value="Pendente">Pendente</option>
                      </select>
                      <input type="text" value={ativ.obs || ""} onChange={(e) => updateArrayItem('atividades', idx, 'obs', e.target.value)} className="w-1/4 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Observações" />
                      <button onClick={() => removeArrayItem('atividades', idx)} className="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Remover linha">✕</button>
                    </div>
                  ))}
                  <button 
                    onClick={() => addArrayItem('atividades', { atividade: "", empresa: "", status: "Pendente", obs: "" })}
                    className="text-xs font-bold text-[#80b02d] hover:text-[#6a9425] transition flex items-center gap-1 mt-2"
                  >
                    + ADICIONAR ATIVIDADE
                  </button>
                </div>
              </div>

              {/* Equipe / Envolvidos */}
              <div>
                <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Mão de Obra</h3>
                <div className="space-y-3">
                  {rdo.envolvidos?.map((env: any, idx: number) => (
                    <div key={idx} className="flex gap-3 bg-white p-3 border rounded-md shadow-sm items-center">
                      <input type="text" value={env.empresa || ""} onChange={(e) => updateArrayItem('envolvidos', idx, 'empresa', e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Empresa" />
                      <input type="number" value={env.colaboradores || ""} onChange={(e) => updateArrayItem('envolvidos', idx, 'colaboradores', e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Qtd. Colaboradores" />
                      <input type="text" value={env.funcao || ""} onChange={(e) => updateArrayItem('envolvidos', idx, 'funcao', e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Função" />
                      <button onClick={() => removeArrayItem('envolvidos', idx)} className="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Remover linha">✕</button>
                    </div>
                  ))}
                  <button 
                    onClick={() => addArrayItem('envolvidos', { empresa: "", colaboradores: "", funcao: "" })}
                    className="text-xs font-bold text-[#80b02d] hover:text-[#6a9425] transition flex items-center gap-1 mt-2"
                  >
                    + ADICIONAR MÃO DE OBRA
                  </button>
                </div>
              </div>

              {/* SHEQ */}
              <div>
                <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">SHEQ (Segurança e Meio Ambiente)</h3>
                <div className="grid grid-cols-2 gap-6 bg-white p-4 border rounded-md shadow-sm">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500">Incidentes de Segurança?</label>
                    <select value={rdo.sheq?.incidente || "Não"} onChange={(e) => updateSheq('incidente', e.target.value)} className="w-full text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none">
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                    <input type="text" value={rdo.sheq?.incidenteObs || ""} onChange={(e) => updateSheq('incidenteObs', e.target.value)} className="w-full text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Observação (se houver)" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500">Vazamentos / Impacto Ambiental?</label>
                    <select value={rdo.sheq?.vazamento || "Não"} onChange={(e) => updateSheq('vazamento', e.target.value)} className="w-full text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none">
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                    <input type="text" value={rdo.sheq?.vazamentoObs || ""} onChange={(e) => updateSheq('vazamentoObs', e.target.value)} className="w-full text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Observação (se houver)" />
                  </div>
                </div>
              </div>

              {/* FOTOS */}
              <div>
                <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Registro Fotográfico</h3>
                <div className="space-y-3">
                  {rdo.fotos?.map((foto: any, idx: number) => (
                    <div key={idx} className="flex gap-3 bg-white p-3 border rounded-md shadow-sm items-center">
                      <div className="text-xs text-gray-400 w-24 truncate" title={foto.storagePath}>
                        Img {idx + 1}
                      </div>
                      <input 
                        type="text" 
                        value={foto.legenda || ""} 
                        onChange={(e) => updateArrayItem('fotos', idx, 'legenda', e.target.value)} 
                        className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" 
                        placeholder="Legenda da foto..." 
                      />
                      <button 
                        onClick={() => removeArrayItem('fotos', idx)}
                        className="bg-red-50 text-red-600 px-3 py-2 rounded text-xs font-bold hover:bg-red-100 transition-colors"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  
                  <div className="pt-2">
                    <label className="cursor-pointer bg-[#80b02d] text-white px-4 py-2.5 rounded-md text-sm font-bold shadow-sm hover:bg-[#6a9425] transition-colors inline-block">
                      {isUploadingPhoto ? "Enviando..." : "+ ADICIONAR NOVA FOTO"}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handlePhotoUpload} 
                        disabled={isUploadingPhoto} 
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Comentários */}
              <div>
                <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Comentários Gerais</h3>
                <textarea 
                  value={rdo.comentarios || ""} 
                  onChange={(e) => setRdo({ ...rdo, comentarios: e.target.value })} 
                  className="w-full text-sm border p-3 rounded-md shadow-sm min-h-[100px] focus:ring-1 focus:ring-[#80b02d] outline-none" 
                  placeholder="Insira as notas de campo..."
                />
              </div>

            </div>
          )}
          
          {/* Conteúdo Visual do Painel (Intacto) */}
          {!isEditing && (
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
          )}
        </div>
      </div>
    </AdminShell>
  );
}