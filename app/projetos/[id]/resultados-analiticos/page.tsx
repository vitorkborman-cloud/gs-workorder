"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Contaminantes mais comuns em projetos de área contaminada — só sugestão
// de autocomplete (datalist), o campo continua livre pra qualquer analito
// do boletim de laboratório.
const CONTAMINANTES_SUGERIDOS = [
  "Benzeno", "Tolueno", "Etilbenzeno", "Xilenos totais", "MTBE", "Naftaleno",
  "TPH (Hidrocarbonetos Totais de Petróleo)", "Chumbo", "Cádmio", "Cromo total",
  "Arsênio", "Benzo(a)pireno", "Fenóis totais",
];

const UNIDADES = ["µg/L", "mg/L", "ng/L", "mg/kg", "µg/kg"];

type Poco = { id: string; nomenclatura: string };

type ResultRow = {
  id: string;
  contaminante: string;
  concentracao: number;
  unidade: string;
  vmp: number | null;
  vmp_fonte: string | null;
  nao_detectado: boolean;
  limite_deteccao: number | null;
};

type Lancamento = {
  key: string;
  soil_description_id: string;
  pocoNome: string;
  matriz: "agua_subterranea" | "solo";
  data_coleta: string;
  campanha: string | null;
  profundidade_m: number | null;
  rows: ResultRow[];
};

type NovaLinha = {
  contaminante: string;
  concentracao: string;
  unidade: string;
  vmp: string;
  vmp_fonte: string;
  naoDetectado: boolean;
  limiteDeteccao: string;
};

function novaLinhaVazia(unidadeDefault: string): NovaLinha {
  return { contaminante: "", concentracao: "", unidade: unidadeDefault, vmp: "", vmp_fonte: "", naoDetectado: false, limiteDeteccao: "" };
}

function formatDateBr(d: string) {
  if (!d) return "Sem data";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function ResultadosAnaliticosPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [pocos, setPocos] = useState<Poco[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPocoId, setSelectedPocoId] = useState("");
  const [matriz, setMatriz] = useState<"agua_subterranea" | "solo">("agua_subterranea");
  const [dataColeta, setDataColeta] = useState("");
  const [campanha, setCampanha] = useState("");
  const [profundidade, setProfundidade] = useState("");
  const [linhas, setLinhas] = useState<NovaLinha[]>([novaLinhaVazia("µg/L")]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: proj }, { data: solos }, { data: resultados }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      supabase.from("soil_descriptions").select("id, nomenclatura_poco, nome_sondagem").eq("project_id", projectId),
      supabase
        .from("analytical_results")
        .select("id, soil_description_id, matriz, data_coleta, campanha, profundidade_m, contaminante, concentracao, unidade, vmp, vmp_fonte, nao_detectado, limite_deteccao")
        .eq("project_id", projectId)
        .order("data_coleta", { ascending: false }),
    ]);

    if (proj) setProjectName(proj.name);

    const nomePorPoco = new Map<string, string>();
    (solos || []).forEach((s: any) => {
      nomePorPoco.set(s.id, (s.nomenclatura_poco || s.nome_sondagem || "Sem identificação").trim() || "Sem identificação");
    });
    setPocos((solos || []).map((s: any) => ({ id: s.id, nomenclatura: nomePorPoco.get(s.id)! })).sort((a, b) => a.nomenclatura.localeCompare(b.nomenclatura)));

    const grupos = new Map<string, Lancamento>();
    (resultados || []).forEach((r: any) => {
      const key = `${r.soil_description_id}__${r.data_coleta}__${r.matriz}`;
      if (!grupos.has(key)) {
        grupos.set(key, {
          key,
          soil_description_id: r.soil_description_id,
          pocoNome: nomePorPoco.get(r.soil_description_id) || "Poço removido",
          matriz: r.matriz,
          data_coleta: r.data_coleta,
          campanha: r.campanha,
          profundidade_m: r.profundidade_m,
          rows: [],
        });
      }
      grupos.get(key)!.rows.push({
        id: r.id,
        contaminante: r.contaminante,
        concentracao: r.concentracao,
        unidade: r.unidade,
        vmp: r.vmp,
        vmp_fonte: r.vmp_fonte,
        nao_detectado: r.nao_detectado,
        limite_deteccao: r.limite_deteccao,
      });
    });
    setLancamentos(Array.from(grupos.values()).sort((a, b) => b.data_coleta.localeCompare(a.data_coleta)));
    setLoading(false);
  }

  function abrirNovoLancamento() {
    setSelectedPocoId(pocos[0]?.id || "");
    setMatriz("agua_subterranea");
    setDataColeta("");
    setCampanha("");
    setProfundidade("");
    setLinhas([novaLinhaVazia("µg/L")]);
    setDialogOpen(true);
  }

  function atualizarLinha(idx: number, patch: Partial<NovaLinha>) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, novaLinhaVazia(prev[prev.length - 1]?.unidade || "µg/L")]);
  }

  function removerLinha(idx: number) {
    setLinhas((prev) => prev.filter((_, i) => i !== idx));
  }

  async function salvarLancamento() {
    if (!selectedPocoId || !dataColeta) {
      alert("Selecione o poço e a data da coleta.");
      return;
    }
    const linhasValidas = linhas.filter((l) => l.contaminante.trim() && (l.naoDetectado ? l.limiteDeteccao.trim() : l.concentracao.trim()));
    if (linhasValidas.length === 0) {
      alert("Adicione ao menos um contaminante com concentração (ou limite de detecção, se não detectado).");
      return;
    }

    setSaving(true);
    try {
      const rows = linhasValidas.map((l) => {
        const limite = l.naoDetectado ? parseFloat(l.limiteDeteccao) : null;
        return {
          project_id: projectId,
          soil_description_id: selectedPocoId,
          matriz,
          data_coleta: dataColeta,
          campanha: campanha.trim() || null,
          profundidade_m: matriz === "solo" && profundidade.trim() ? parseFloat(profundidade) : null,
          contaminante: l.contaminante.trim(),
          // Convenção usual quando o boletim só informa "< limite de detecção":
          // metade do limite. nao_detectado registra a natureza censurada do
          // dado pra quem for reprocessar com krigagem indicadora depois.
          concentracao: l.naoDetectado ? limite! / 2 : parseFloat(l.concentracao),
          unidade: l.unidade,
          vmp: l.vmp.trim() ? parseFloat(l.vmp) : null,
          vmp_fonte: l.vmp.trim() && l.vmp_fonte.trim() ? l.vmp_fonte.trim() : null,
          nao_detectado: l.naoDetectado,
          limite_deteccao: limite,
        };
      });
      const { error } = await supabase.from("analytical_results").insert(rows);
      if (error) throw error;
      setDialogOpen(false);
      await load();
    } catch (err) {
      alert("Erro ao salvar. Verifique o console.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function excluirLinha(rowId: string) {
    if (!confirm("Excluir este resultado?")) return;
    await supabase.from("analytical_results").delete().eq("id", rowId);
    load();
  }

  async function excluirLancamento(l: Lancamento) {
    if (!confirm(`Excluir todo o lançamento de ${l.pocoNome} (${formatDateBr(l.data_coleta)}), com ${l.rows.length} contaminante${l.rows.length === 1 ? "" : "s"}?`)) return;
    await supabase.from("analytical_results").delete().eq("soil_description_id", l.soil_description_id).eq("data_coleta", l.data_coleta).eq("matriz", l.matriz);
    load();
  }

  const unidadesDisponiveis = useMemo(() => UNIDADES, []);
  const campanhasSugeridas = useMemo(
    () => Array.from(new Set(lancamentos.map((l) => l.campanha).filter((c): c is string => !!c))).sort(),
    [lancamentos]
  );

  if (loading) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse">Carregando...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="max-w-5xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#391e2a] tracking-tight">Resultados Analíticos</h1>
            <p className="text-sm text-gray-400 mt-1">{projectName} · Concentração de contaminantes por ponto de amostragem</p>
          </div>
          <Button
            onClick={abrirNovoLancamento}
            disabled={pocos.length === 0}
            className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold px-6 h-11 shadow-sm shrink-0"
          >
            + Novo Lançamento
          </Button>
        </div>

        {pocos.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800 mb-6">
            Nenhum poço/sondagem cadastrado neste projeto ainda. Crie um Perfil Descritivo primeiro para poder lançar resultados analíticos.
          </div>
        )}

        {lancamentos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
            Nenhum resultado analítico lançado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {lancamentos.map((l) => {
              const excedencias = l.rows.filter((r) => !r.nao_detectado && r.vmp != null && r.concentracao > r.vmp).length;
              const expanded = expandedKey === l.key;
              return (
                <div key={l.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedKey(expanded ? null : l.key)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#2f7ea1]/10 flex items-center justify-center text-[#2f7ea1] shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M5 8h14M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M5 8l1.5-3.5A2 2 0 018.34 3h7.32a2 2 0 011.84 1.5L19 8" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#391e2a] text-sm truncate">{l.pocoNome}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDateBr(l.data_coleta)} · {l.matriz === "agua_subterranea" ? "Água subterrânea" : "Solo"}
                          {l.profundidade_m != null && ` · ${l.profundidade_m} m`}
                          {l.campanha && ` · ${l.campanha}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {excedencias > 0 && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-full">
                          {excedencias} acima do VMP
                        </span>
                      )}
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                        {l.rows.length} contaminante{l.rows.length === 1 ? "" : "s"}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                              <th className="pb-2 pr-3 font-bold">Contaminante</th>
                              <th className="pb-2 pr-3 font-bold">Concentração</th>
                              <th className="pb-2 pr-3 font-bold">VMP</th>
                              <th className="pb-2 pr-3 font-bold"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {l.rows.map((r) => {
                              const acima = !r.nao_detectado && r.vmp != null && r.concentracao > r.vmp;
                              return (
                                <tr key={r.id}>
                                  <td className="py-2 pr-3 font-medium text-[#391e2a]">{r.contaminante}</td>
                                  <td className={`py-2 pr-3 font-bold ${acima ? "text-red-600" : "text-gray-700"}`}>
                                    {r.nao_detectado ? (
                                      <span className="inline-flex items-center gap-1.5">
                                        <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">ND</span>
                                        {"<"} {r.limite_deteccao} {r.unidade}
                                      </span>
                                    ) : (
                                      `${r.concentracao} ${r.unidade}`
                                    )}
                                  </td>
                                  <td className="py-2 pr-3 text-gray-400">
                                    {r.vmp != null ? `${r.vmp} ${r.unidade}${r.vmp_fonte ? ` (${r.vmp_fonte})` : ""}` : "—"}
                                  </td>
                                  <td className="py-2 text-right">
                                    <button onClick={() => excluirLinha(r.id)} className="text-xs text-gray-300 hover:text-red-500 transition">
                                      Excluir
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button onClick={() => excluirLancamento(l)} className="text-xs font-bold text-red-400 hover:text-red-600 transition">
                          Excluir lançamento inteiro
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <datalist id="contaminantes-sugeridos">
        {CONTAMINANTES_SUGERIDOS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="campanhas-sugeridas">
        {campanhasSugeridas.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo lançamento de resultado analítico</DialogTitle>
            <DialogDescription>
              Transcreva os contaminantes e concentrações de um boletim de laboratório para um poço e data de coleta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Poço / Sondagem</label>
                <select
                  value={selectedPocoId}
                  onChange={(e) => setSelectedPocoId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
                >
                  {pocos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nomenclatura}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Data da coleta</label>
                <input
                  type="date"
                  value={dataColeta}
                  onChange={(e) => setDataColeta(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Campanha (opcional)</label>
              <input
                type="text"
                list="campanhas-sugeridas"
                placeholder="Ex.: 1ª Campanha 2026"
                value={campanha}
                onChange={(e) => setCampanha(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Use o mesmo rótulo em todos os poços amostrados na mesma rodada de campo — é o que agrupa os poços pra desenhar a pluma de um único momento no mapa, mesmo que a coleta de cada um tenha sido em dias diferentes.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Matriz</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMatriz("agua_subterranea")}
                    className={`flex-1 text-sm font-bold px-3 py-2 rounded-lg border transition ${matriz === "agua_subterranea" ? "bg-[#2f7ea1] text-white border-[#2f7ea1]" : "bg-white text-gray-500 border-gray-200"}`}
                  >
                    Água subterrânea
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatriz("solo")}
                    className={`flex-1 text-sm font-bold px-3 py-2 rounded-lg border transition ${matriz === "solo" ? "bg-[#2f7ea1] text-white border-[#2f7ea1]" : "bg-white text-gray-500 border-gray-200"}`}
                  >
                    Solo
                  </button>
                </div>
              </div>
              {matriz === "solo" && (
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Profundidade (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={profundidade}
                    onChange={(e) => setProfundidade(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 block mb-2">Contaminantes</label>
              <div className="space-y-2">
                {linhas.map((linha, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2 items-start bg-gray-50 rounded-lg p-2">
                    <input
                      type="text"
                      list="contaminantes-sugeridos"
                      placeholder="Contaminante"
                      value={linha.contaminante}
                      onChange={(e) => atualizarLinha(idx, { contaminante: e.target.value })}
                      className="flex-[2] min-w-[140px] border rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
                    />
                    {linha.naoDetectado ? (
                      <input
                        type="number"
                        step="any"
                        placeholder="Limite de detecção"
                        value={linha.limiteDeteccao}
                        onChange={(e) => atualizarLinha(idx, { limiteDeteccao: e.target.value })}
                        className="flex-1 min-w-[130px] border border-amber-300 bg-amber-50 rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
                      />
                    ) : (
                      <input
                        type="number"
                        step="any"
                        placeholder="Concentração"
                        value={linha.concentracao}
                        onChange={(e) => atualizarLinha(idx, { concentracao: e.target.value })}
                        className="flex-1 min-w-[100px] border rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
                      />
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 font-medium px-1 py-2 shrink-0" title="Contaminante não detectado — abaixo do limite de quantificação do laboratório">
                      <input
                        type="checkbox"
                        checked={linha.naoDetectado}
                        onChange={(e) => atualizarLinha(idx, { naoDetectado: e.target.checked })}
                        className="accent-[#80b02d]"
                      />
                      ND
                    </label>
                    <select
                      value={linha.unidade}
                      onChange={(e) => atualizarLinha(idx, { unidade: e.target.value })}
                      className="min-w-[80px] border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
                    >
                      {unidadesDisponiveis.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input
                      type="number"
                      step="any"
                      placeholder="VMP (opcional)"
                      value={linha.vmp}
                      onChange={(e) => atualizarLinha(idx, { vmp: e.target.value })}
                      className="flex-1 min-w-[110px] border rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Fonte do VMP"
                      value={linha.vmp_fonte}
                      onChange={(e) => atualizarLinha(idx, { vmp_fonte: e.target.value })}
                      className="flex-1 min-w-[110px] border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removerLinha(idx)}
                      disabled={linhas.length === 1}
                      className="shrink-0 self-center flex items-center justify-center text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-300 transition p-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={adicionarLinha}
                className="mt-2 text-xs font-bold text-[#80b02d] hover:text-[#6c9526] transition"
              >
                + Adicionar contaminante
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={salvarLancamento} disabled={saving} className="bg-[#80b02d] hover:bg-[#6c9526] text-white">
              {saving ? "Salvando..." : "Salvar lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
