"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import {
  TIPO_LABEL,
  type AtividadeFixaCfg,
  type Instrumento,
  type MembroEquipe,
  type TipoInstrumento,
} from "@/lib/rdo/v2";

// Configuração do RDO por projeto: o que se lê (instrumentos), o que se faz
// todo dia (atividades fixas) e quem pode ser responsável (equipe). Cada
// alteração é gravada na hora (campos de texto, ao sair do campo).

const inp = "w-full text-sm border border-gray-200 p-2 rounded outline-none focus:ring-1 focus:ring-[#80b02d] bg-white";

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RdoConfiguracaoPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("");
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
  const [fixas, setFixas] = useState<AtividadeFixaCfg[]>([]);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [loading, setLoading] = useState(true);

  const [novoInst, setNovoInst] = useState({ grupo: "", nome: "", tipo: "instantaneo" as TipoInstrumento, unidade: "", instrucao: "" });
  const [novaFixa, setNovaFixa] = useState("");
  const [novoMembro, setNovoMembro] = useState("");

  useEffect(() => { carregar(); }, [projectId]);

  async function carregar() {
    const [{ data: proj }, { data: insts }, { data: fx }, { data: eq }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      supabase.from("rdo_instrumentos").select("*").eq("project_id", projectId).order("ordem").order("nome"),
      supabase.from("rdo_atividades_fixas").select("*").eq("project_id", projectId).order("ordem").order("nome"),
      supabase.from("rdo_equipe").select("*").eq("project_id", projectId).order("nome"),
    ]);
    setProjectName(proj?.name || "");
    setInstrumentos((insts || []) as Instrumento[]);
    setFixas((fx || []) as AtividadeFixaCfg[]);
    setEquipe((eq || []) as MembroEquipe[]);
    setLoading(false);
  }

  function erro(e: any) { alert("Erro ao salvar: " + (e?.message ?? String(e))); }

  // ── Instrumentos ─────────────────────────────────────────────────────────

  const editarInstLocal = (id: string, patch: Partial<Instrumento>) =>
    setInstrumentos((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function gravarInst(id: string, patch: Partial<Instrumento>) {
    editarInstLocal(id, patch);
    const { error } = await supabase.from("rdo_instrumentos").update(patch).eq("id", id);
    if (error) { erro(error); carregar(); }
  }

  async function adicionarInst() {
    const nome = novoInst.nome.trim();
    if (!nome) { alert("Informe o nome do instrumento."); return; }
    const ordem = (instrumentos.reduce((m, i) => Math.max(m, i.ordem), 0) || 0) + 10;
    const { error } = await supabase.from("rdo_instrumentos").insert({
      project_id: projectId,
      grupo: novoInst.grupo.trim() || "Geral",
      nome,
      tipo: novoInst.tipo,
      unidade: novoInst.unidade.trim(),
      instrucao: novoInst.instrucao.trim() || null,
      ordem,
      vigente_desde: hojeLocal(),
    });
    if (error) { erro(error); return; }
    setNovoInst({ ...novoInst, nome: "", instrucao: "" });
    carregar();
  }

  async function excluirInst(i: Instrumento) {
    if (!confirm(`Excluir "${i.nome}"? Leituras já lançadas em RDOs continuam registradas. Para só parar de pedir, desative em vez de excluir.`)) return;
    const { error } = await supabase.from("rdo_instrumentos").delete().eq("id", i.id);
    if (error) { erro(error); return; }
    carregar();
  }

  async function moverInst(idx: number, dir: -1 | 1) {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= instrumentos.length) return;
    const lista = [...instrumentos];
    [lista[idx], lista[alvo]] = [lista[alvo], lista[idx]];
    const renumerada = lista.map((i, n) => ({ ...i, ordem: (n + 1) * 10 }));
    setInstrumentos(renumerada);
    const { error } = await supabase.from("rdo_instrumentos").upsert(
      renumerada.map((i) => ({ id: i.id, project_id: i.project_id, nome: i.nome, ordem: i.ordem }))
    );
    if (error) { erro(error); carregar(); }
  }

  // ── Atividades fixas ─────────────────────────────────────────────────────

  async function adicionarFixa() {
    const nome = novaFixa.trim();
    if (!nome) return;
    const ordem = (fixas.reduce((m, f) => Math.max(m, f.ordem), 0) || 0) + 10;
    const { error } = await supabase.from("rdo_atividades_fixas").insert({ project_id: projectId, nome, ordem });
    if (error) { erro(error); return; }
    setNovaFixa("");
    carregar();
  }

  async function gravarFixa(id: string, patch: Partial<AtividadeFixaCfg>) {
    setFixas((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    const { error } = await supabase.from("rdo_atividades_fixas").update(patch).eq("id", id);
    if (error) { erro(error); carregar(); }
  }

  async function excluirFixa(f: AtividadeFixaCfg) {
    if (!confirm(`Excluir a atividade fixa "${f.nome}"? RDOs já preenchidos mantêm o registro.`)) return;
    const { error } = await supabase.from("rdo_atividades_fixas").delete().eq("id", f.id);
    if (error) { erro(error); return; }
    carregar();
  }

  // ── Equipe ───────────────────────────────────────────────────────────────

  async function adicionarMembro() {
    const nome = novoMembro.trim();
    if (!nome) return;
    const { error } = await supabase.from("rdo_equipe").insert({ project_id: projectId, nome });
    if (error) { erro(error); return; }
    setNovoMembro("");
    carregar();
  }

  async function gravarMembro(id: string, patch: Partial<MembroEquipe>) {
    setEquipe((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    const { error } = await supabase.from("rdo_equipe").update(patch).eq("id", id);
    if (error) { erro(error); carregar(); }
  }

  async function excluirMembro(m: MembroEquipe) {
    if (!confirm(`Remover "${m.nome}" da equipe do projeto?`)) return;
    const { error } = await supabase.from("rdo_equipe").delete().eq("id", m.id);
    if (error) { erro(error); return; }
    carregar();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return <AdminShell><p className="p-10 text-gray-400 animate-pulse">Carregando...</p></AdminShell>;

  return (
    <AdminShell>
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="bg-[#391e2a] p-8 rounded-xl text-white flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurar RDO</h1>
            <p className="text-[#80b02d] font-semibold mt-1 uppercase tracking-wider text-xs">{projectName}</p>
          </div>
          <button onClick={() => router.push(`/projetos/${projectId}`)} className="border border-white/30 hover:bg-white/10 rounded-lg px-5 h-11 text-sm font-bold">
            Voltar ao projeto
          </button>
        </div>

        {/* Instrumentos */}
        <Bloco
          titulo="Instrumentos de leitura"
          descricao="O que o técnico lê em campo. Acumulado = totalizador (calcula o volume do dia); Instantâneo = valor direto; Estoque = nível de tanque (calcula o consumo). Instrumentos novos só aparecem nos RDOs a partir de hoje."
        >
          <div className="space-y-2">
            {instrumentos.length === 0 && <p className="text-sm text-gray-400">Nenhum instrumento cadastrado.</p>}
            {instrumentos.map((i, idx) => (
              <div key={i.id} className={`grid grid-cols-2 xl:grid-cols-12 gap-2 items-start p-3 rounded-lg border ${i.ativo ? "bg-white border-gray-100" : "bg-gray-50 border-gray-100 opacity-70"}`}>
                <div className="col-span-1 xl:col-span-2">
                  <input className={inp} value={i.grupo} placeholder="Grupo"
                    onChange={(e) => editarInstLocal(i.id, { grupo: e.target.value })}
                    onBlur={(e) => gravarInst(i.id, { grupo: e.target.value.trim() || "Geral" })} />
                </div>
                <div className="col-span-1 xl:col-span-2">
                  <input className={inp} value={i.nome} placeholder="Nome"
                    onChange={(e) => editarInstLocal(i.id, { nome: e.target.value })}
                    onBlur={(e) => e.target.value.trim() ? gravarInst(i.id, { nome: e.target.value.trim() }) : carregar()} />
                </div>
                <div className="col-span-1 xl:col-span-2">
                  <select className={inp} value={i.tipo} onChange={(e) => gravarInst(i.id, { tipo: e.target.value as TipoInstrumento })}>
                    {(Object.keys(TIPO_LABEL) as TipoInstrumento[]).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                  </select>
                </div>
                <div className="col-span-1 xl:col-span-1">
                  <input className={inp} value={i.unidade} placeholder="Un."
                    onChange={(e) => editarInstLocal(i.id, { unidade: e.target.value })}
                    onBlur={(e) => gravarInst(i.id, { unidade: e.target.value.trim() })} />
                </div>
                <div className="col-span-2 xl:col-span-3">
                  <input className={inp} value={i.instrucao || ""} placeholder="Instrução ao técnico (opcional)"
                    onChange={(e) => editarInstLocal(i.id, { instrucao: e.target.value })}
                    onBlur={(e) => gravarInst(i.id, { instrucao: e.target.value.trim() || null })} />
                </div>
                <div className="col-span-2 xl:col-span-2 flex items-center justify-end gap-1">
                  <label className="flex items-center gap-1 text-xs text-gray-600 mr-1 cursor-pointer">
                    <input type="checkbox" checked={i.ativo} onChange={(e) => gravarInst(i.id, { ativo: e.target.checked })} /> Ativo
                  </label>
                  <button onClick={() => moverInst(idx, -1)} disabled={idx === 0} className="px-1.5 py-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30" aria-label="Subir">▲</button>
                  <button onClick={() => moverInst(idx, 1)} disabled={idx === instrumentos.length - 1} className="px-1.5 py-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30" aria-label="Descer">▼</button>
                  <button onClick={() => excluirInst(i)} className="px-1.5 py-1 text-red-500 hover:bg-red-50 rounded" aria-label="Excluir">✕</button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-12 gap-2 items-start mt-4 p-3 rounded-lg bg-[#80b02d]/10 border border-[#80b02d]/30">
            <div className="col-span-1 xl:col-span-2"><input className={inp} placeholder="Grupo (ex.: Pressão)" value={novoInst.grupo} onChange={(e) => setNovoInst({ ...novoInst, grupo: e.target.value })} /></div>
            <div className="col-span-1 xl:col-span-2"><input className={inp} placeholder="Nome (ex.: PT-101)" value={novoInst.nome} onChange={(e) => setNovoInst({ ...novoInst, nome: e.target.value })} /></div>
            <div className="col-span-1 xl:col-span-2">
              <select className={inp} value={novoInst.tipo} onChange={(e) => setNovoInst({ ...novoInst, tipo: e.target.value as TipoInstrumento })}>
                {(Object.keys(TIPO_LABEL) as TipoInstrumento[]).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </div>
            <div className="col-span-1 xl:col-span-1"><input className={inp} placeholder="Un." value={novoInst.unidade} onChange={(e) => setNovoInst({ ...novoInst, unidade: e.target.value })} /></div>
            <div className="col-span-2 xl:col-span-3"><input className={inp} placeholder="Instrução (opcional)" value={novoInst.instrucao} onChange={(e) => setNovoInst({ ...novoInst, instrucao: e.target.value })} /></div>
            <div className="col-span-2 xl:col-span-2 flex justify-end">
              <button onClick={adicionarInst} className="bg-[#80b02d] hover:bg-[#6a9425] text-white text-sm font-bold px-4 h-10 rounded-lg">+ ADICIONAR</button>
            </div>
          </div>
        </Bloco>

        {/* Atividades fixas */}
        <Bloco titulo="Atividades fixas" descricao="Aparecem em todo RDO do projeto com o interruptor Sim/Não (Realizado).">
          <div className="space-y-2">
            {fixas.length === 0 && <p className="text-sm text-gray-400">Nenhuma atividade fixa cadastrada.</p>}
            {fixas.map((f) => (
              <div key={f.id} className={`flex items-center gap-2 p-3 rounded-lg border border-gray-100 ${f.ativo ? "bg-white" : "bg-gray-50 opacity-70"}`}>
                <input className={inp} value={f.nome}
                  onChange={(e) => setFixas((prev) => prev.map((x) => (x.id === f.id ? { ...x, nome: e.target.value } : x)))}
                  onBlur={(e) => e.target.value.trim() ? gravarFixa(f.id, { nome: e.target.value.trim() }) : carregar()} />
                <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer shrink-0">
                  <input type="checkbox" checked={f.ativo} onChange={(e) => gravarFixa(f.id, { ativo: e.target.checked })} /> Ativa
                </label>
                <button onClick={() => excluirFixa(f)} className="px-2 py-1 text-red-500 hover:bg-red-50 rounded" aria-label="Excluir">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <input className={inp} placeholder="Nova atividade fixa" value={novaFixa}
              onChange={(e) => setNovaFixa(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") adicionarFixa(); }} />
            <button onClick={adicionarFixa} className="bg-[#80b02d] hover:bg-[#6a9425] text-white text-sm font-bold px-4 rounded-lg shrink-0">+ ADICIONAR</button>
          </div>
        </Bloco>

        {/* Equipe */}
        <Bloco titulo="Equipe do projeto" descricao="Nomes que podem ser marcados como equipe em campo e como responsáveis pelas atividades.">
          <div className="flex flex-wrap gap-2">
            {equipe.length === 0 && <p className="text-sm text-gray-400">Nenhum nome cadastrado.</p>}
            {equipe.map((m) => (
              <span key={m.id} className={`inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border text-sm ${m.ativo ? "bg-white border-gray-200 text-[#391e2a]" : "bg-gray-50 border-gray-100 text-gray-400 line-through"}`}>
                {m.nome}
                <button onClick={() => gravarMembro(m.id, { ativo: !m.ativo })} className="text-[11px] px-1.5 text-gray-400 hover:text-gray-700" title={m.ativo ? "Desativar" : "Reativar"}>
                  {m.ativo ? "⏸" : "▶"}
                </button>
                <button onClick={() => excluirMembro(m)} className="text-red-500 hover:bg-red-50 rounded-full w-6 h-6" aria-label="Remover">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <input className={inp} placeholder="Novo nome" value={novoMembro}
              onChange={(e) => setNovoMembro(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") adicionarMembro(); }} />
            <button onClick={adicionarMembro} className="bg-[#80b02d] hover:bg-[#6a9425] text-white text-sm font-bold px-4 rounded-lg shrink-0">+ ADICIONAR</button>
          </div>
        </Bloco>
      </div>
    </AdminShell>
  );
}

function Bloco({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider border-b border-[#80b02d] inline-block pb-1">{titulo}</h2>
      <p className="text-xs text-gray-400 mt-2 mb-4 max-w-3xl">{descricao}</p>
      {children}
    </section>
  );
}
