"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { buildRdoPdf } from "@/lib/pdf/rdo";
import RdoQuickTables from "@/components/rdo/RdoQuickTables";

// ================= HELPERS =================

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
    const doc = await buildRdoPdf({ rdo, projectName });
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

          {/* Tabelas Rápidas — independentes do modo de edição do RDO, salvam direto */}
          <div className="p-8 border-t border-gray-100">
            <RdoQuickTables rdoId={rdoId} />
          </div>

        </div>
      </div>
    </AdminShell>
  );
}
