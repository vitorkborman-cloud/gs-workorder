"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ================= HELPERS =================

async function generateWhiteLogoBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context error")); return; }
      ctx.drawImage(img, 0, 0);
      ctx.filter = "brightness(0) invert(1)";
      ctx.drawImage(canvas, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

const STATUS_ATIVIDADE = ["Concluído", "Em andamento", "Não iniciado", "Impedido", "Em Andamento", "Pendente"];
const STATUS_COLORS: Record<string, string> = {
  "Concluído":    "bg-green-100 text-green-700",
  "Em andamento": "bg-amber-100 text-amber-700",
  "Em Andamento": "bg-amber-100 text-amber-700",
  "Não iniciado": "bg-gray-100 text-gray-500",
  "Impedido":     "bg-red-100 text-red-600",
  "Pendente":     "bg-amber-100 text-amber-700",
};

// ================= PAGE =================

export default function RdoViewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const rdoId     = params.rdoId as string;

  const [rdo, setRdo]                   = useState<any>(null);
  const [projectName, setProjectName]   = useState("");
  const [isEditing, setIsEditing]       = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [saveMsg, setSaveMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("rdo_reports").select("*").eq("id", rdoId).single();
    if (data) setRdo(data);
    const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single();
    if (proj) setProjectName(proj.name);
  }

  async function salvarAlteracoes() {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const { error } = await supabase
        .from("rdo_reports")
        .update({
          data:        rdo.data,
          inicio:      rdo.inicio,
          fim:         rdo.fim,
          clima:       rdo.clima,
          comentarios: rdo.comentarios,
          atividades:  rdo.atividades,
          envolvidos:  rdo.envolvidos,
          sheq:        rdo.sheq,
          fotos:       rdo.fotos,
        })
        .eq("id", rdoId);

      if (error) throw error;
      setIsEditing(false);
      setSaveMsg({ ok: true, text: "Alterações salvas com sucesso." });
      await load();
    } catch (err: any) {
      setSaveMsg({ ok: false, text: `Erro ao salvar: ${err?.message ?? String(err)}` });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const ext      = file.name.split(".").pop();
      const filePath = `rdo_${rdoId}/desktop_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("rdo-photos").upload(filePath, file);
      if (upErr) throw upErr;
      setRdo({ ...rdo, fotos: [...(rdo.fotos || []), { storagePath: filePath, legenda: "" }] });
    } catch (err) {
      alert("Erro ao fazer upload da foto.");
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  }

  const updateArrayItem = (arr: string, idx: number, field: string, val: string) => {
    const next = [...rdo[arr]];
    next[idx] = { ...next[idx], [field]: val };
    setRdo({ ...rdo, [arr]: next });
  };

  const addArrayItem = (arr: string, empty: any) =>
    setRdo({ ...rdo, [arr]: [...(rdo[arr] || []), empty] });

  const removeArrayItem = (arr: string, idx: number) =>
    setRdo({ ...rdo, [arr]: rdo[arr].filter((_: any, i: number) => i !== idx) });

  const updateSheq = (field: string, val: string) =>
    setRdo({ ...rdo, sheq: { ...rdo.sheq, [field]: val } });

  // --- PDF ---
  async function gerarPDF() {
    if (!rdo) return;
    let whiteLogo: string | null = null;
    try { whiteLogo = await generateWhiteLogoBase64("/logo.png"); } catch {}

    const doc        = new jsPDF("p", "mm", "a4");
    const marginX    = 15;
    const pageWidth  = doc.internal.pageSize.getWidth();
    const cW         = pageWidth - marginX * 2;
    let   y          = 0;

    const purple: [number, number, number] = [57, 30, 42];
    const green:  [number, number, number] = [128, 176, 45];
    const lgray:  [number, number, number] = [248, 248, 250];

    const logoSize = (b64: string, h: number): Promise<[number, number]> =>
      new Promise((res) => {
        const img = new Image();
        img.onload  = () => res([(img.width / img.height) * h, h]);
        img.onerror = () => res([h * 3.3, h]);
        img.src = b64;
      });
    const [lW, lH] = whiteLogo ? await logoSize(whiteLogo, 10) : [33, 10];

    const header = () => {
      doc.setFillColor(...purple); doc.rect(0, 0, pageWidth, 34, "F");
      doc.setFillColor(...green);  doc.rect(0, 34, pageWidth, 2, "F");
      if (whiteLogo) { try { doc.addImage(whiteLogo, "PNG", marginX, (34 - lH) / 2, lW, lH); } catch {} }
      doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DIÁRIO DE OBRA", pageWidth - marginX, 15, { align: "right" });
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(`Projeto: ${projectName}   |   Data: ${rdo.data}`, pageWidth - marginX, 22, { align: "right" });
      doc.setFontSize(7.5); doc.setTextColor(180, 210, 120);
      doc.text("SHEQ n° 004   |   Versão V 00", pageWidth - marginX, 29, { align: "right" });
      doc.setTextColor(0, 0, 0);
    };

    const chk = (n: number) => {
      if (y + n > 275) { doc.addPage(); header(); y = 50; }
    };

    const sec = (title: string) => {
      chk(20);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...purple);
      doc.text(title.toUpperCase(), marginX, y);
      doc.setDrawColor(...green); doc.setLineWidth(0.8);
      doc.line(marginX, y + 2, marginX + 15, y + 2);
      y += 10;
    };

    const tbl: any = {
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: purple, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [252, 252, 252] },
    };

    header(); y = 50;

    const total = rdo.envolvidos?.reduce((a: number, b: any) => a + (Number(b.colaboradores) || 0), 0) || 0;
    [
      { label: "EFETIVO TOTAL",     val: `${total} PESSOAS` },
      { label: "CLIMA",             val: rdo.clima?.[0]?.condicao || "N/A" },
      { label: "STATUS SEGURANÇA",  val: rdo.sheq?.incidente === "Não" ? "SEM OCORRÊNCIAS" : "ALERTA" },
    ].forEach((c, i) => {
      const x = marginX + i * (cW / 3 + 2);
      doc.setFillColor(...lgray); doc.roundedRect(x, y, cW / 3 - 4, 18, 1, 1, "F");
      doc.setFontSize(7); doc.setTextColor(100); doc.text(c.label, x + 4, y + 6);
      doc.setFontSize(9); doc.setTextColor(...purple); doc.setFont("helvetica", "bold");
      doc.text(c.val, x + 4, y + 13);
    });
    y += 28;

    sec("Condições Climáticas");
    autoTable(doc, { ...tbl, startY: y, head: [["Período","Tempo","Condição","Impacto/Razão"]], body: rdo.clima?.map((c: any) => [c.periodo, c.tempo, c.condicao, c.razao || "-"]) || [] });
    y = (doc as any).lastAutoTable.finalY + 12;

    sec("Mão de Obra e Efetivo");
    autoTable(doc, { ...tbl, startY: y, head: [["Empresa Parceira","N° Colaboradores","Função Principal"]], body: rdo.envolvidos?.map((e: any) => [e.empresa, e.colaboradores, e.funcao]) || [] });
    y = (doc as any).lastAutoTable.finalY + 12;

    sec("Progresso das Atividades");
    autoTable(doc, {
      ...tbl, startY: y,
      head: [["Atividade Realizada","Responsável","Status","Observações"]],
      body: rdo.atividades?.map((a: any) => [a.atividade, a.empresa, a.status, a.obs || "-"]) || [],
      didParseCell: (d: any) => {
        if (d.section === "body" && d.column.index === 2) {
          const s = String(d.cell.raw).toLowerCase();
          if (s.includes("conclu"))   d.cell.styles.textColor = [0, 150, 0];
          if (s.includes("andamento")) d.cell.styles.textColor = [200, 120, 0];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    sec("Segurança, Saúde e Meio Ambiente (SHEQ)");
    autoTable(doc, { ...tbl, startY: y, head: [["Tipo","Houve Registro?","Descrição"]], body: [
      ["Incidentes de Segurança", rdo.sheq?.incidente || "Não", rdo.sheq?.incidenteObs || "-"],
      ["Vazamentos / Meio Ambiente", rdo.sheq?.vazamento || "Não", rdo.sheq?.vazamentoObs || "-"],
    ]});
    y = (doc as any).lastAutoTable.finalY + 12;

    if (rdo.comentarios) {
      sec("Notas e Comentários");
      const lines = doc.splitTextToSize(rdo.comentarios, cW - 10);
      const bH = lines.length * 5 + 10; chk(bH);
      doc.setFillColor(250, 250, 250); doc.setDrawColor(230, 230, 230);
      doc.rect(marginX, y, cW, bH, "FD");
      doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "normal");
      doc.text(lines, marginX + 5, y + 7);
      y += bH + 15;
    }

    if (rdo.fotos?.length > 0) {
      sec("Registro Fotográfico");
      const bW = (cW / 2) - 5; const bH = 55;
      for (let i = 0; i < rdo.fotos.length; i++) {
        const foto = rdo.fotos[i];
        const isPar = i % 2 === 0;
        const xPos  = isPar ? marginX : marginX + bW + 10;
        if (isPar) chk(bH + 20);
        if (foto.storagePath) {
          try {
            const { data: ud } = supabase.storage.from("rdo-photos").getPublicUrl(foto.storagePath);
            const blob = await (await fetch(ud.publicUrl)).blob();
            const b64  = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob); });
            const p = doc.getImageProperties(b64);
            let iW = bW, iH = (p.height * bW) / p.width;
            if (iH > bH) { iH = bH; iW = (p.width * bH) / p.height; }
            doc.setFillColor(248, 248, 248); doc.rect(xPos, y, bW, bH, "F");
            doc.addImage(b64, "JPEG", xPos + (bW - iW) / 2, y + (bH - iH) / 2, iW, iH);
            doc.setDrawColor(220); doc.rect(xPos, y, bW, bH, "S");
          } catch { doc.setFillColor(240, 240, 240); doc.rect(xPos, y, bW, bH, "F"); }
        }
        doc.setFontSize(7); doc.setTextColor(120);
        doc.text(doc.splitTextToSize(foto.legenda || "Sem legenda", bW), xPos, y + bH + 4);
        if (!isPar || i === rdo.fotos.length - 1) y += bH + 15;
      }
    }

    if (rdo.assinaturas?.length > 0) {
      chk(50); sec("Assinaturas");
      y += 5;
      rdo.assinaturas.forEach((a: any, i: number) => {
        const xPos = i % 2 === 0 ? marginX : pageWidth / 2 + 5;
        chk(35);
        if (a.assinatura) { try { doc.addImage(a.assinatura, "PNG", xPos + 10, y, 40, 15); } catch {} }
        doc.setDrawColor(180); doc.line(xPos, y + 16, xPos + 60, y + 16);
        doc.setFontSize(8); doc.text(a.empresa || "Responsável", xPos, y + 21);
        if (i % 2 !== 0 || i === rdo.assinaturas.length - 1) y += 30;
      });
    }

    const total_p = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= total_p; i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(180);
      doc.text(`Documento gerado eletronicamente - Página ${i} de ${total_p}`, pageWidth / 2, 290, { align: "center" });
    }
    doc.save(`RDO_${projectName}_${rdo.data}.pdf`);
  }

  if (!rdo) return <AdminShell><p className="p-10">Carregando...</p></AdminShell>;

  // ── MODO VISUALIZAÇÃO (dados reais do RDO) ──────────────────────────────────

  const ViewSection = ({ title }: { title: string }) => (
    <h3 className="text-xs font-bold text-[#391e2a] uppercase tracking-widest mb-3 pb-1 border-b border-[#80b02d]/40">
      {title}
    </h3>
  );

  const dataView = (
    <div className="p-8 space-y-8">

      {/* Informações gerais */}
      <div>
        <ViewSection title="Informações Gerais" />
        <div className="grid grid-cols-3 gap-4">
          {[["Data", rdo.data], ["Início", rdo.inicio], ["Término", rdo.fim]].map(([l, v]) => (
            <div key={l} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{l}</p>
              <p className="text-sm font-semibold text-[#391e2a]">{v || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Clima */}
      {rdo.clima?.length > 0 && (
        <div>
          <ViewSection title="Condições Climáticas" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#391e2a] text-white text-xs">
                  {["Período","Tempo","Condição","Razão"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rdo.clima.map((c: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 border-b border-gray-100">{c.periodo || "—"}</td>
                    <td className="px-3 py-2 border-b border-gray-100">{c.tempo || "—"}</td>
                    <td className="px-3 py-2 border-b border-gray-100">{c.condicao || "—"}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-500">{c.razao || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Atividades */}
      {rdo.atividades?.length > 0 && (
        <div>
          <ViewSection title={`Atividades (${rdo.atividades.length})`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#391e2a] text-white text-xs">
                  {["Atividade","Responsável","Status","Observações"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rdo.atividades.map((a: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 border-b border-gray-100 font-medium">{a.atividade || "—"}</td>
                    <td className="px-3 py-2 border-b border-gray-100">{a.empresa || "—"}</td>
                    <td className="px-3 py-2 border-b border-gray-100">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] || "bg-gray-100 text-gray-500"}`}>
                        {a.status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-500">{a.obs || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mão de obra */}
      {rdo.envolvidos?.length > 0 && (
        <div>
          <ViewSection title={`Mão de Obra — ${rdo.envolvidos.reduce((s: number, e: any) => s + (Number(e.colaboradores) || 0), 0)} pessoas`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#391e2a] text-white text-xs">
                  {["Empresa","Colaboradores","Função"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rdo.envolvidos.map((e: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 border-b border-gray-100">{e.empresa || "—"}</td>
                    <td className="px-3 py-2 border-b border-gray-100">{e.colaboradores || "—"}</td>
                    <td className="px-3 py-2 border-b border-gray-100">{e.funcao || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SHEQ */}
      <div>
        <ViewSection title="SHEQ" />
        <div className="grid grid-cols-2 gap-4">
          {[
            ["Incidentes de Segurança", rdo.sheq?.incidente, rdo.sheq?.incidenteObs],
            ["Vazamentos / Meio Ambiente", rdo.sheq?.vazamento, rdo.sheq?.vazamentoObs],
          ].map(([label, val, obs]) => (
            <div key={label as string} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${val === "Sim" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                {val || "Não"}
              </span>
              {obs && <p className="text-xs text-gray-500 mt-1">{obs}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Comentários */}
      {rdo.comentarios && (
        <div>
          <ViewSection title="Comentários" />
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4 border border-gray-100 whitespace-pre-wrap">{rdo.comentarios}</p>
        </div>
      )}

      {/* Fotos */}
      {rdo.fotos?.length > 0 && (
        <div>
          <ViewSection title={`Fotos (${rdo.fotos.length})`} />
          <div className="grid grid-cols-3 gap-3">
            {rdo.fotos.map((f: any, i: number) => {
              const { data: ud } = supabase.storage.from("rdo-photos").getPublicUrl(f.storagePath);
              return (
                <div key={i} className="rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                  <img src={ud.publicUrl} alt={f.legenda || `Foto ${i+1}`} className="w-full h-36 object-cover" />
                  {f.legenda && <p className="text-xs text-gray-500 p-2">{f.legenda}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assinaturas */}
      {rdo.assinaturas?.length > 0 && (
        <div>
          <ViewSection title="Assinaturas" />
          <div className="grid grid-cols-2 gap-4">
            {rdo.assinaturas.map((a: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-center">
                {a.assinatura && <img src={a.assinatura} alt="Assinatura" className="h-12 mx-auto mb-2 object-contain" />}
                <p className="text-xs font-semibold text-gray-600">{a.empresa}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );

  // ── MODO EDIÇÃO ─────────────────────────────────────────────────────────────

  const editForm = (
    <div className="p-8 border-b border-gray-100 bg-gray-50/30 space-y-8">

      {/* Informações Gerais */}
      <div>
        <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Informações Gerais</h3>
        <div className="grid grid-cols-3 gap-4 bg-white p-4 border rounded-md shadow-sm">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Data</label>
            <input type="date" value={rdo.data || ""} onChange={(e) => setRdo({...rdo, data: e.target.value})} className="w-full text-sm border p-2 rounded outline-none focus:ring-1 focus:ring-[#80b02d]" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Início</label>
            <input type="time" value={rdo.inicio || ""} onChange={(e) => setRdo({...rdo, inicio: e.target.value})} className="w-full text-sm border p-2 rounded outline-none focus:ring-1 focus:ring-[#80b02d]" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Término</label>
            <input type="time" value={rdo.fim || ""} onChange={(e) => setRdo({...rdo, fim: e.target.value})} className="w-full text-sm border p-2 rounded outline-none focus:ring-1 focus:ring-[#80b02d]" />
          </div>
        </div>
      </div>

      {/* Clima */}
      <div>
        <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Condições Climáticas</h3>
        <div className="space-y-3">
          {(rdo.clima || []).map((c: any, idx: number) => (
            <div key={idx} className="flex gap-3 bg-white p-3 border rounded-md shadow-sm items-center">
              <input type="text" value={c.periodo || ""} onChange={(e) => updateArrayItem("clima", idx, "periodo", e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Período" />
              <input type="text" value={c.tempo || ""} onChange={(e) => updateArrayItem("clima", idx, "tempo", e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Tempo" />
              <select value={c.condicao || ""} onChange={(e) => updateArrayItem("clima", idx, "condicao", e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none">
                {["Trabalhável","Parcialmente Trabalhável","Impraticável"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <input type="text" value={c.razao || ""} onChange={(e) => updateArrayItem("clima", idx, "razao", e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Razão/Impacto" />
              <button onClick={() => removeArrayItem("clima", idx)} className="text-red-500 hover:bg-red-50 p-2 rounded">✕</button>
            </div>
          ))}
          <button onClick={() => addArrayItem("clima", { periodo: "", tempo: "", condicao: "Trabalhável", razao: "" })} className="text-xs font-bold text-[#80b02d] hover:text-[#6a9425] flex items-center gap-1 mt-2">
            + ADICIONAR CLIMA
          </button>
        </div>
      </div>

      {/* Atividades */}
      <div>
        <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Atividades</h3>
        <div className="space-y-3">
          {(rdo.atividades || []).map((ativ: any, idx: number) => (
            <div key={idx} className="flex gap-3 bg-white p-3 border rounded-md shadow-sm items-center">
              <input type="text" value={ativ.atividade || ""} onChange={(e) => updateArrayItem("atividades", idx, "atividade", e.target.value)} className="w-1/3 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Atividade" />
              <input type="text" value={ativ.empresa || ""} onChange={(e) => updateArrayItem("atividades", idx, "empresa", e.target.value)} className="w-1/5 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Responsável" />
              <select value={ativ.status || ""} onChange={(e) => updateArrayItem("atividades", idx, "status", e.target.value)} className="w-1/6 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none">
                {["Concluído","Em andamento","Não iniciado","Impedido"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <input type="text" value={ativ.obs || ""} onChange={(e) => updateArrayItem("atividades", idx, "obs", e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Observações" />
              <button onClick={() => removeArrayItem("atividades", idx)} className="text-red-500 hover:bg-red-50 p-2 rounded">✕</button>
            </div>
          ))}
          <button onClick={() => addArrayItem("atividades", { atividade: "", empresa: "", status: "Não iniciado", obs: "" })} className="text-xs font-bold text-[#80b02d] hover:text-[#6a9425] flex items-center gap-1 mt-2">
            + ADICIONAR ATIVIDADE
          </button>
        </div>
      </div>

      {/* Mão de Obra */}
      <div>
        <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Mão de Obra</h3>
        <div className="space-y-3">
          {(rdo.envolvidos || []).map((env: any, idx: number) => (
            <div key={idx} className="flex gap-3 bg-white p-3 border rounded-md shadow-sm items-center">
              <input type="text" value={env.empresa || ""} onChange={(e) => updateArrayItem("envolvidos", idx, "empresa", e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Empresa" />
              <input type="number" value={env.colaboradores || ""} onChange={(e) => updateArrayItem("envolvidos", idx, "colaboradores", e.target.value)} className="w-32 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Qtd." />
              <input type="text" value={env.funcao || ""} onChange={(e) => updateArrayItem("envolvidos", idx, "funcao", e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Função" />
              <button onClick={() => removeArrayItem("envolvidos", idx)} className="text-red-500 hover:bg-red-50 p-2 rounded">✕</button>
            </div>
          ))}
          <button onClick={() => addArrayItem("envolvidos", { empresa: "", colaboradores: "", funcao: "" })} className="text-xs font-bold text-[#80b02d] hover:text-[#6a9425] flex items-center gap-1 mt-2">
            + ADICIONAR MÃO DE OBRA
          </button>
        </div>
      </div>

      {/* SHEQ */}
      <div>
        <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">SHEQ</h3>
        <div className="grid grid-cols-2 gap-6 bg-white p-4 border rounded-md shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500">Incidentes de Segurança?</label>
            <select value={rdo.sheq?.incidente || "Não"} onChange={(e) => updateSheq("incidente", e.target.value)} className="w-full text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none">
              <option value="Não">Não</option>
              <option value="Sim">Sim</option>
            </select>
            <input type="text" value={rdo.sheq?.incidenteObs || ""} onChange={(e) => updateSheq("incidenteObs", e.target.value)} className="w-full text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Observação" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500">Vazamentos / Impacto Ambiental?</label>
            <select value={rdo.sheq?.vazamento || "Não"} onChange={(e) => updateSheq("vazamento", e.target.value)} className="w-full text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none">
              <option value="Não">Não</option>
              <option value="Sim">Sim</option>
            </select>
            <input type="text" value={rdo.sheq?.vazamentoObs || ""} onChange={(e) => updateSheq("vazamentoObs", e.target.value)} className="w-full text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Observação" />
          </div>
        </div>
      </div>

      {/* Fotos */}
      <div>
        <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Registro Fotográfico</h3>
        <div className="space-y-3">
          {(rdo.fotos || []).map((foto: any, idx: number) => (
            <div key={idx} className="flex gap-3 bg-white p-3 border rounded-md shadow-sm items-center">
              <span className="text-xs text-gray-400 w-16 shrink-0">Img {idx + 1}</span>
              <input type="text" value={foto.legenda || ""} onChange={(e) => updateArrayItem("fotos", idx, "legenda", e.target.value)} className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Legenda" />
              <button onClick={() => removeArrayItem("fotos", idx)} className="bg-red-50 text-red-600 px-3 py-2 rounded text-xs font-bold hover:bg-red-100">Remover</button>
            </div>
          ))}
          <label className="cursor-pointer bg-[#80b02d] text-white px-4 py-2.5 rounded-md text-sm font-bold hover:bg-[#6a9425] inline-block">
            {isUploadingPhoto ? "Enviando..." : "+ NOVA FOTO"}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
          </label>
        </div>
      </div>

      {/* Comentários */}
      <div>
        <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">Comentários Gerais</h3>
        <textarea value={rdo.comentarios || ""} onChange={(e) => setRdo({ ...rdo, comentarios: e.target.value })} className="w-full text-sm border p-3 rounded-md shadow-sm min-h-[100px] focus:ring-1 focus:ring-[#80b02d] outline-none" placeholder="Notas de campo..." />
      </div>

    </div>
  );

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <AdminShell>
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100">

          {/* Header */}
          <div className="bg-[#391e2a] p-8 text-white flex justify-between items-center gap-4 shadow-lg">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isEditing ? "Editando RDO" : "Relatório Diário de Obra"}
              </h1>
              <p className="text-[#80b02d] font-semibold mt-1 uppercase tracking-wider text-xs">
                {projectName} • {rdo.data}
                {!rdo.draft && !isEditing && (
                  <span className="ml-3 text-green-400">✓ Finalizado</span>
                )}
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              {isEditing ? (
                <>
                  <Button
                    onClick={() => { load(); setIsEditing(false); setSaveMsg(null); }}
                    className="bg-transparent border border-white/30 hover:bg-white/10 text-white h-11 px-5 font-bold"
                  >
                    CANCELAR
                  </Button>
                  <Button
                    onClick={salvarAlteracoes}
                    disabled={isSaving}
                    className="bg-[#80b02d] hover:bg-[#6a9425] text-white h-11 px-6 font-bold shadow-lg"
                  >
                    {isSaving ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => { setIsEditing(true); setSaveMsg(null); }}
                    className="bg-transparent border border-white/30 hover:bg-white/10 text-white h-11 px-5 font-bold"
                  >
                    EDITAR
                  </Button>
                  <Button
                    onClick={gerarPDF}
                    className="bg-[#80b02d] hover:bg-[#6a9425] text-white px-8 h-11 rounded-lg font-bold shadow-lg"
                  >
                    BAIXAR PDF
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Mensagem de feedback */}
          {saveMsg && (
            <div className={`px-8 py-3 text-sm font-medium ${saveMsg.ok ? "bg-green-50 text-green-700 border-b border-green-100" : "bg-red-50 text-red-700 border-b border-red-100"}`}>
              {saveMsg.text}
            </div>
          )}

          {isEditing ? editForm : dataView}

        </div>
      </div>
    </AdminShell>
  );
}
