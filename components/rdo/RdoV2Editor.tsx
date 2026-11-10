"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { jsPDF } from "jspdf";
import { supabase } from "@/lib/supabase";
import MobileShell from "@/components/layout/MobileShell";
import AdminShell from "@/components/layout/AdminShell";
import { useToast } from "@/components/Toast";
import { RdoStatusBadge } from "@/components/rdo/RdoStatusBadge";
import { RdoAttachmentsPicker, type PdfAttachment } from "@/components/rdo/RdoAttachmentsPicker";
import { buildRdoPdfAuto } from "@/lib/pdf/rdo-v2";
import { buildSoilProfilePdf, mergeLayersWithVocReadings } from "@/lib/pdf/soil-profile";
import { buildWaterSamplingPdf } from "@/lib/pdf/water-sampling";
import { mergePdfSources } from "@/lib/pdf/merge";
import { downloadPdfBytes } from "@/lib/pdf/download";
import {
  agruparPorGrupo,
  buscarAnteriores,
  calcularDia,
  formatDataBr,
  formatNumero,
  nomeDoUsuario,
  parseNumero,
  sincronizarLeituras,
  STATUS_CONCLUIDO,
  STATUS_NAO_CONCLUIDO,
  type Anterior,
  type AtividadeDia,
  type AtividadeFixaRdo,
  type Instrumento,
  type LeituraRdo,
  type Ocorrencias,
} from "@/lib/rdo/v2";

// Formulário do RDO simplificado (formato 'v2'). O MESMO componente atende o
// celular (preenchimento em campo) e o desktop (correções pontuais, anexos e
// PDF) — só muda o "casco" em volta e a barra de ações.

type LeituraEdit = Omit<LeituraRdo, "valor"> & { valor: string };

type FotoEdit = {
  id: string;
  storagePath: string;
  previewUrl: string;
  legenda: string;
  uploading?: boolean;
};

const MAX_WIDTH = 1200;

async function comprimirImagem(file: File): Promise<Blob> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = bitmapUrl;
    });
    const escala = Math.min(1, MAX_WIDTH / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao comprimir imagem"))), "image/jpeg", 0.7)
    );
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

function leituraParaEdit(l: LeituraRdo): LeituraEdit {
  return { ...l, valor: l.valor === null || l.valor === undefined ? "" : String(l.valor).replace(".", ",") };
}

function leituraParaSalvar(l: LeituraEdit): LeituraRdo {
  const n = l.nao_coletado ? null : parseNumero(l.valor);
  return { ...l, valor: n, nao_coletado: l.nao_coletado };
}

function normalizarAtividade(a: any): AtividadeDia {
  const responsaveis: string[] = Array.isArray(a?.responsaveis)
    ? a.responsaveis
    : a?.empresa
      ? [String(a.empresa)]
      : [];
  const status = String(a?.status || "").toLowerCase();
  return {
    atividade: a?.atividade || "",
    responsaveis,
    status: status.includes("conclu") && !status.includes("não") && !status.includes("nao")
      ? STATUS_CONCLUIDO
      : STATUS_NAO_CONCLUIDO,
    obs: a?.obs || "",
    origem: a?.origem,
  };
}

export default function RdoV2Editor({
  projectId,
  rdoId,
  variant,
}: {
  projectId: string;
  rdoId: string;
  variant: "mobile" | "desktop";
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const mobile = variant === "mobile";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [projectName, setProjectName] = useState("");

  const [status, setStatus] = useState<string>("rascunho");
  const [data, setData] = useState("");
  const [preenchidoPor, setPreenchidoPor] = useState("");
  const [equipe, setEquipe] = useState<string[]>([]);
  const [fixas, setFixas] = useState<AtividadeFixaRdo[]>([]);
  const [leituras, setLeituras] = useState<LeituraEdit[]>([]);
  const [atividades, setAtividades] = useState<AtividadeDia[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencias>({ houve: false, descricao: "" });
  const [comentarios, setComentarios] = useState("");
  const [fotos, setFotos] = useState<FotoEdit[]>([]);
  const [fotosRemovidas, setFotosRemovidas] = useState<string[]>([]);
  const [pdfAttachments, setPdfAttachments] = useState<PdfAttachment[]>([]);

  const [equipeCadastrada, setEquipeCadastrada] = useState<string[]>([]);
  const [anteriores, setAnteriores] = useState<Record<string, Anterior>>({});

  const [saving, setSaving] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [outroNome, setOutroNome] = useState("");

  const finalizado = status === "finalizado";

  // ── Carga ────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: rdo } = await supabase.from("rdo_reports").select("*").eq("id", rdoId).single();
      if (!rdo) { setNotFound(true); setLoading(false); return; }

      const [{ data: proj }, { data: insts }, { data: fixasCfg }, { data: equipeCfg }, { data: userData }] = await Promise.all([
        supabase.from("projects").select("name").eq("id", projectId).single(),
        supabase.from("rdo_instrumentos").select("*").eq("project_id", projectId),
        supabase.from("rdo_atividades_fixas").select("*").eq("project_id", projectId).eq("ativo", true).order("ordem"),
        supabase.from("rdo_equipe").select("nome").eq("project_id", projectId).eq("ativo", true).order("nome"),
        supabase.auth.getUser(),
      ]);

      const st = rdo.status || (rdo.draft ? "rascunho" : "finalizado");
      setProjectName(proj?.name || "");
      setStatus(st);
      setData(rdo.data || "");
      setComentarios(rdo.comentarios || "");
      setEquipe(Array.isArray(rdo.equipe) ? rdo.equipe : []);
      setOcorrencias(rdo.ocorrencias || { houve: false, descricao: "" });
      setPdfAttachments(rdo.pdf_attachments || []);
      setEquipeCadastrada((equipeCfg || []).map((e: any) => e.nome));

      setPreenchidoPor(rdo.preenchido_por || nomeDoUsuario(userData?.user));

      // Leituras: RDO finalizado fica como foi lançado; os demais acompanham o cadastro.
      const existentes: LeituraRdo[] = Array.isArray(rdo.leituras) ? rdo.leituras : [];
      const lista = st === "finalizado"
        ? existentes
        : sincronizarLeituras((insts || []) as Instrumento[], existentes, rdo.data || "");
      setLeituras(lista.map(leituraParaEdit));

      // Atividades fixas: mantém as já registradas, acrescenta as novas do cadastro.
      const fixasExistentes: AtividadeFixaRdo[] = Array.isArray(rdo.atividades_fixas) ? rdo.atividades_fixas : [];
      const ids = new Set(fixasExistentes.map((f) => f.id));
      const novas: AtividadeFixaRdo[] = st === "finalizado"
        ? []
        : (fixasCfg || []).filter((f: any) => !ids.has(f.id)).map((f: any) => ({ id: f.id, nome: f.nome, realizado: false, obs: "" }));
      setFixas([...fixasExistentes, ...novas]);

      setAtividades((Array.isArray(rdo.atividades) ? rdo.atividades : []).map(normalizarAtividade));

      setFotos(
        (Array.isArray(rdo.fotos) ? rdo.fotos : []).map((f: any, i: number) => ({
          id: `${f.storagePath}_${i}`,
          storagePath: f.storagePath,
          previewUrl: supabase.storage.from("rdo-photos").getPublicUrl(f.storagePath).data.publicUrl,
          legenda: f.legenda || "",
        }))
      );

      setLoading(false);
    })();
  }, [projectId, rdoId]);

  // Leituras anteriores (referência de cada instrumento) — recalcula se a data mudar.
  useEffect(() => {
    if (!data || loading) return;
    let cancel = false;
    buscarAnteriores(projectId, data, rdoId).then((a) => { if (!cancel) setAnteriores(a); });
    return () => { cancel = true; };
  }, [projectId, rdoId, data, loading]);

  // ── Derivados ────────────────────────────────────────────────────────────

  const opcoesEquipe = useMemo(() => {
    const set = new Set<string>(equipeCadastrada);
    equipe.forEach((n) => set.add(n));
    return Array.from(set);
  }, [equipeCadastrada, equipe]);

  const resultados = useMemo(() => {
    const m: Record<string, ReturnType<typeof calcularDia>> = {};
    for (const l of leituras) {
      m[l.instrumento_id] = l.nao_coletado ? null : calcularDia(l.tipo, parseNumero(l.valor), anteriores[l.instrumento_id]?.valor);
    }
    return m;
  }, [leituras, anteriores]);

  // ── Mutadores ────────────────────────────────────────────────────────────

  const updLeitura = (id: string, patch: Partial<LeituraEdit>) =>
    setLeituras((prev) => prev.map((l) => (l.instrumento_id === id ? { ...l, ...patch } : l)));

  const updFixa = (id: string, patch: Partial<AtividadeFixaRdo>) =>
    setFixas((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const updAtividade = (idx: number, patch: Partial<AtividadeDia>) =>
    setAtividades((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));

  const toggleLista = (lista: string[], nome: string) =>
    lista.includes(nome) ? lista.filter((n) => n !== nome) : [...lista, nome];

  function adicionarOutro() {
    const n = outroNome.trim();
    if (!n) return;
    if (!equipe.includes(n)) setEquipe([...equipe, n]);
    setOutroNome("");
  }

  // ── Fotos ────────────────────────────────────────────────────────────────

  async function adicionarFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = "";
    for (const file of arquivos) {
      const id = `novo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const preview = URL.createObjectURL(file);
      setFotos((prev) => [...prev, { id, storagePath: "", previewUrl: preview, legenda: "", uploading: true }]);
      try {
        const blob = await comprimirImagem(file);
        const path = `${projectId}/${data || "rascunho"}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
        const { error } = await supabase.storage.from("rdo-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        setFotos((prev) => prev.map((f) => (f.id === id ? { ...f, storagePath: path, uploading: false } : f)));
      } catch (err: any) {
        setFotos((prev) => prev.filter((f) => f.id !== id));
        showToast("Erro ao enviar a foto: " + (err?.message ?? err), "error");
      }
    }
  }

  function removerFoto(f: FotoEdit) {
    if (f.storagePath) setFotosRemovidas((prev) => [...prev, f.storagePath]);
    setFotos((prev) => prev.filter((x) => x.id !== f.id));
  }

  // ── Persistência ─────────────────────────────────────────────────────────

  const persistir = useCallback(async (finalizar: boolean): Promise<boolean> => {
    if (fotos.some((f) => f.uploading)) {
      showToast("Aguarde o envio das fotos terminar.", "error");
      return false;
    }
    setSaving(true);
    try {
      const novoStatus = finalizar || status === "finalizado" ? "finalizado" : "rascunho";
      const payload = {
        data,
        inicio: "",
        fim: "",
        clima: [],
        envolvidos: [],
        assinaturas: [],
        // Mantém o campo legado preenchido (consultas antigas e dashboard).
        sheq: { incidente: ocorrencias.houve ? "Sim" : "Não", incidenteObs: ocorrencias.descricao, vazamento: "Não", vazamentoObs: "" },
        formato: "v2",
        preenchido_por: preenchidoPor,
        equipe,
        atividades_fixas: fixas,
        leituras: leituras.map(leituraParaSalvar),
        atividades: atividades.filter((a) => a.atividade.trim()),
        ocorrencias,
        comentarios,
        fotos: fotos.filter((f) => f.storagePath).map((f) => ({ storagePath: f.storagePath, legenda: f.legenda })),
        draft: novoStatus !== "finalizado",
        status: novoStatus,
      };
      const { error } = await supabase.from("rdo_reports").update(payload).eq("id", rdoId);
      if (error) throw error;

      if (fotosRemovidas.length > 0) {
        await supabase.storage.from("rdo-photos").remove(fotosRemovidas).catch(() => {});
        setFotosRemovidas([]);
      }
      setStatus(novoStatus);
      return true;
    } catch (err: any) {
      showToast("Erro ao salvar: " + (err?.message ?? String(err)), "error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [fotos, status, data, ocorrencias, preenchidoPor, equipe, fixas, leituras, atividades, comentarios, fotosRemovidas, rdoId, showToast]);

  async function salvarRascunho() {
    if (await persistir(false)) showToast(finalizado ? "Alterações salvas." : "Rascunho salvo.", "success");
  }

  async function finalizar() {
    const avisos: string[] = [];
    const semValor = leituras.filter((l) => !l.nao_coletado && parseNumero(l.valor) === null);
    if (semValor.length > 0) avisos.push(`${semValor.length} leitura(s) sem valor (nem "não coletado").`);
    const menores = leituras.filter((l) => resultados[l.instrumento_id]?.alerta);
    if (menores.length > 0) avisos.push(`Totalizador menor que o anterior em: ${menores.map((l) => l.nome).join(", ")}.`);
    if (avisos.length > 0 && !confirm(`${avisos.join("\n")}\n\nFinalizar mesmo assim?`)) return;
    if (avisos.length === 0 && !confirm("Finalizar o RDO?")) return;

    if (await persistir(true)) {
      showToast("RDO finalizado.", "success");
      if (mobile) router.push(`/mobile/projetos/${projectId}/rdo`);
    }
  }

  // ── Desktop: anexos e PDF ────────────────────────────────────────────────

  async function atualizarAnexos(next: PdfAttachment[]) {
    setPdfAttachments(next);
    await supabase.from("rdo_reports").update({ pdf_attachments: next }).eq("id", rdoId);
  }

  async function gerarPDF() {
    setGerandoPdf(true);
    try {
      if (!(await persistir(false))) return;
      const { data: rdo } = await supabase.from("rdo_reports").select("*").eq("id", rdoId).single();
      if (!rdo) return;
      const sources: (jsPDF | Uint8Array)[] = [await buildRdoPdfAuto({ rdo, projectName, projectId })];

      for (const att of (rdo.pdf_attachments || []) as PdfAttachment[]) {
        if (att.tipo === "soil_description") {
          const { data: solo } = await supabase.from("soil_descriptions").select("*").eq("id", att.id).single();
          if (solo) {
            const camadas = mergeLayersWithVocReadings(solo.layers || [], solo.voc_readings || [], solo.profundidade_total);
            sources.push(await buildSoilProfilePdf({ data: solo, layers: camadas, vocReadings: solo.voc_readings || [] }));
          }
        } else if (att.tipo === "water_sampling") {
          const { data: amostra } = await supabase.from("water_samplings").select("*").eq("id", att.id).single();
          if (amostra) sources.push(await buildWaterSamplingPdf({ amostra, projectName }));
        }
      }
      downloadPdfBytes(await mergePdfSources(sources), `RDO_${projectName}_${rdo.data}.pdf`);
    } catch (err) {
      console.error(err);
      showToast("Erro ao gerar o PDF. Verifique o console.", "error");
    } finally {
      setGerandoPdf(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const shell = (title: string, children: React.ReactNode, subtitle?: string) =>
    mobile ? (
      <MobileShell title={title} subtitle={subtitle} backHref={`/mobile/projetos/${projectId}/rdo`}>
        {children}
      </MobileShell>
    ) : (
      <AdminShell>{children}</AdminShell>
    );

  if (loading) return shell("Carregando", <div className="p-10 text-center text-gray-500 animate-pulse">Carregando RDO...</div>);
  if (notFound) return shell("Não encontrado", <div className="p-10 text-center text-gray-500">RDO não encontrado.</div>);

  const grupos = agruparPorGrupo(leituras);

  const conteudo = (
    <div className={mobile ? "space-y-4 pb-24" : "space-y-5"}>
      {/* Cabeçalho */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#80b02d]">{projectName}</p>
            <p className="text-lg font-bold text-[#391e2a]">Relatório Diário de Obra</p>
          </div>
          <RdoStatusBadge status={status} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Campo label="Data">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
          </Campo>
          <Campo label="Preenchido por">
            <input type="text" value={preenchidoPor} onChange={(e) => setPreenchidoPor(e.target.value)} className={inputCls} />
          </Campo>
        </div>
      </Card>

      {/* Equipe */}
      <Secao titulo="Equipe em campo">
        <div className="flex flex-wrap gap-2">
          {opcoesEquipe.length === 0 && (
            <p className="text-xs text-gray-400">Nenhum nome cadastrado. Cadastre na configuração do projeto ou adicione abaixo.</p>
          )}
          {opcoesEquipe.map((n) => (
            <Chip key={n} ativo={equipe.includes(n)} onClick={() => setEquipe(toggleLista(equipe, n))}>{n}</Chip>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={outroNome}
            onChange={(e) => setOutroNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarOutro(); } }}
            placeholder="Outro nome (não cadastrado)"
            className={inputCls}
          />
          <button type="button" onClick={adicionarOutro} className="shrink-0 px-4 rounded-lg bg-gray-100 text-sm font-bold text-gray-600 active:scale-95">+</button>
        </div>
      </Secao>

      {/* Atividades fixas */}
      {fixas.length > 0 && (
        <Secao titulo="Atividades fixas">
          <div className="space-y-2">
            {fixas.map((f) => (
              <div key={f.id} className="rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[#391e2a]">{f.nome}</p>
                  <Interruptor ligado={f.realizado} onChange={(v) => updFixa(f.id, { realizado: v })} />
                </div>
                {!f.realizado && (
                  <input
                    type="text"
                    value={f.obs}
                    onChange={(e) => updFixa(f.id, { obs: e.target.value })}
                    placeholder="Motivo (opcional)"
                    className={`${inputCls} mt-2`}
                  />
                )}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {/* Leituras */}
      <Secao titulo="Leituras">
        {leituras.length === 0 && (
          <p className="text-xs text-gray-400">
            Nenhum instrumento cadastrado neste projeto. Cadastre em “Configurar RDO” (no desktop).
          </p>
        )}
        <div className="space-y-4">
          {grupos.map((g) => (
            <div key={g.grupo}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">{g.grupo}</p>
              <div className="space-y-2">
                {g.itens.map((l) => {
                  const ant = anteriores[l.instrumento_id];
                  const res = resultados[l.instrumento_id];
                  return (
                    <div key={l.instrumento_id} className="rounded-xl border border-gray-100 bg-white p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-[#391e2a]">{l.nome}</p>
                        <p className="text-[11px] text-gray-400 text-right">
                          {ant ? `ant.: ${formatNumero(ant.valor)} ${l.unidade} (${formatDataBr(ant.data).slice(0, 5)})` : "sem leitura anterior"}
                        </p>
                      </div>
                      {l.instrucao && <p className="text-[11px] text-amber-700 mt-0.5">{l.instrucao}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          enterKeyHint="next"
                          value={l.nao_coletado ? "" : l.valor}
                          disabled={l.nao_coletado}
                          onChange={(e) => updLeitura(l.instrumento_id, { valor: e.target.value })}
                          placeholder={l.nao_coletado ? "não coletado" : "0"}
                          className={`${inputCls} text-right font-semibold disabled:bg-gray-50 disabled:text-gray-400`}
                        />
                        <span className="text-xs text-gray-500 w-10 shrink-0">{l.unidade}</span>
                        <button
                          type="button"
                          onClick={() => updLeitura(l.instrumento_id, { nao_coletado: !l.nao_coletado, valor: "" })}
                          className={`shrink-0 text-[11px] font-bold px-2.5 py-2 rounded-lg border active:scale-95 ${
                            l.nao_coletado ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-500 border-gray-200"
                          }`}
                        >
                          Não coletado
                        </button>
                      </div>
                      {res && (
                        <p className={`text-xs mt-1.5 font-medium ${res.alerta ? "text-amber-700" : "text-[#4b7a1c]"}`}>
                          {res.rotulo}: {formatNumero(res.valor)} {l.unidade}
                          {res.alerta && <span className="block font-normal">⚠ {res.alerta}</span>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Secao>

      {/* Atividades do dia */}
      <Secao titulo="Atividades do dia">
        <div className="space-y-3">
          {atividades.map((a, idx) => (
            <div key={idx} className="rounded-xl border border-gray-100 bg-white p-3 space-y-2">
              <div className="flex gap-2">
                <textarea
                  value={a.atividade}
                  onChange={(e) => updAtividade(idx, { atividade: e.target.value })}
                  rows={2}
                  placeholder="O que foi feito"
                  className={`${inputCls} resize-none`}
                />
                <button type="button" onClick={() => setAtividades(atividades.filter((_, i) => i !== idx))} className="text-red-500 px-2" aria-label="Remover atividade">✕</button>
              </div>
              {opcoesEquipe.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {opcoesEquipe.map((n) => (
                    <Chip key={n} pequeno ativo={a.responsaveis.includes(n)} onClick={() => updAtividade(idx, { responsaveis: toggleLista(a.responsaveis, n) })}>{n}</Chip>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {[STATUS_CONCLUIDO, STATUS_NAO_CONCLUIDO].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updAtividade(idx, { status: s })}
                    className={`py-2 rounded-lg text-xs font-bold border active:scale-95 ${
                      a.status === s
                        ? s === STATUS_CONCLUIDO ? "bg-[#80b02d] text-white border-[#80b02d]" : "bg-amber-500 text-white border-amber-500"
                        : "bg-white text-gray-500 border-gray-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={a.obs}
                onChange={(e) => updAtividade(idx, { obs: e.target.value })}
                placeholder="Observação (ex.: motivo de não concluído)"
                className={inputCls}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAtividades([...atividades, { atividade: "", responsaveis: [], status: STATUS_CONCLUIDO, obs: "" }])}
            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-bold text-gray-500 active:scale-[0.98]"
          >
            + Adicionar atividade
          </button>
        </div>
      </Secao>

      {/* Ocorrências */}
      <Secao titulo="Ocorrências">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600">Houve incidente, vazamento ou outra ocorrência?</p>
          <Interruptor ligado={ocorrencias.houve} onChange={(v) => setOcorrencias({ ...ocorrencias, houve: v })} rotulos={["Sim", "Não"]} perigo />
        </div>
        {ocorrencias.houve && (
          <textarea
            value={ocorrencias.descricao}
            onChange={(e) => setOcorrencias({ ...ocorrencias, descricao: e.target.value })}
            rows={3}
            placeholder="Descreva a ocorrência"
            className={`${inputCls} mt-3`}
          />
        )}
      </Secao>

      {/* Fotos */}
      <Secao titulo="Fotos">
        <div className="grid grid-cols-2 gap-3">
          {fotos.map((f) => (
            <div key={f.id} className="rounded-xl border border-gray-100 bg-white overflow-hidden">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.previewUrl} alt={f.legenda || "Foto"} className="w-full h-28 object-cover" />
                {f.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold">Enviando...</div>
                )}
                <button type="button" onClick={() => removerFoto(f)} className="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 rounded-full text-xs" aria-label="Remover foto">✕</button>
              </div>
              <input
                type="text"
                value={f.legenda}
                onChange={(e) => setFotos((prev) => prev.map((x) => (x.id === f.id ? { ...x, legenda: e.target.value } : x)))}
                placeholder="Legenda"
                className="w-full text-xs p-2 outline-none"
              />
            </div>
          ))}
        </div>
        <label className="mt-3 block w-full text-center py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-bold text-gray-500 cursor-pointer active:scale-[0.98]">
          + Adicionar fotos
          <input type="file" accept="image/*" multiple className="hidden" onChange={adicionarFotos} />
        </label>
      </Secao>

      {/* Observações */}
      <Secao titulo="Observações">
        <textarea
          value={comentarios}
          onChange={(e) => setComentarios(e.target.value)}
          rows={4}
          placeholder="Notas gerais do dia"
          className={inputCls}
        />
      </Secao>

      {/* Anexos ao PDF — só desktop */}
      {!mobile && (
        <Secao titulo="Anexar relatórios ao PDF">
          <RdoAttachmentsPicker projectId={projectId} attachments={pdfAttachments} onChange={atualizarAnexos} />
        </Secao>
      )}

      {/* Ações */}
      {mobile ? (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 border-t shadow-lg flex gap-3 z-40 max-w-md mx-auto">
          <button
            type="button"
            onClick={salvarRascunho}
            disabled={saving}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 active:scale-95 disabled:opacity-50"
          >
            {saving ? "Salvando..." : finalizado ? "Salvar alterações" : "Salvar rascunho"}
          </button>
          {!finalizado && (
            <button
              type="button"
              onClick={finalizar}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#80b02d] text-sm font-bold text-white active:scale-95 disabled:opacity-50"
            >
              Finalizar RDO
            </button>
          )}
        </div>
      ) : (
        <div className="sticky bottom-0 -mx-1 bg-white/95 backdrop-blur-sm border-t p-4 flex gap-3 justify-end rounded-b-xl">
          <button type="button" onClick={() => router.push(`/projetos/${projectId}`)} className="px-5 h-11 rounded-lg border border-gray-300 text-sm font-bold text-gray-600 hover:bg-gray-50">
            Voltar
          </button>
          <button type="button" onClick={salvarRascunho} disabled={saving} className="px-5 h-11 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {saving ? "Salvando..." : finalizado ? "Salvar alterações" : "Salvar rascunho"}
          </button>
          {!finalizado && (
            <button type="button" onClick={finalizar} disabled={saving} className="px-5 h-11 rounded-lg bg-[#391e2a] text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
              Finalizar
            </button>
          )}
          <button type="button" onClick={gerarPDF} disabled={gerandoPdf || saving} className="px-6 h-11 rounded-lg bg-[#80b02d] text-sm font-bold text-white shadow hover:bg-[#6a9425] disabled:opacity-50">
            {gerandoPdf ? "Gerando..." : "Baixar PDF"}
          </button>
        </div>
      )}
    </div>
  );

  return mobile
    ? shell("Relatório Diário", <div className="bg-gray-50 -m-4 p-4 min-h-screen">{conteudo}</div>, formatDataBr(data))
    : shell("", <div className="max-w-3xl mx-auto p-6">{conteudo}</div>);
}

// ── Peças visuais ──────────────────────────────────────────────────────────

const inputCls =
  "w-full text-sm border border-gray-200 bg-white p-2.5 rounded-lg outline-none focus:ring-1 focus:ring-[#80b02d]";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">{children}</div>;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#391e2a] mb-3 pb-1 border-b border-[#80b02d]/40">{titulo}</h3>
      {children}
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Chip({ ativo, onClick, children, pequeno }: { ativo: boolean; onClick: () => void; children: React.ReactNode; pequeno?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border font-semibold active:scale-95 transition ${pequeno ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs"} ${
        ativo ? "bg-[#391e2a] text-white border-[#391e2a]" : "bg-white text-gray-500 border-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function Interruptor({
  ligado,
  onChange,
  rotulos = ["Sim", "Não"],
  perigo,
}: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  rotulos?: [string, string] | string[];
  perigo?: boolean;
}) {
  const cor = ligado ? (perigo ? "bg-red-500" : "bg-[#80b02d]") : "bg-gray-300";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onChange(!ligado)}
      className="flex items-center gap-2 shrink-0 active:scale-95"
    >
      <span className={`text-xs font-bold w-8 text-right ${ligado ? (perigo ? "text-red-600" : "text-[#4b7a1c]") : "text-gray-400"}`}>
        {ligado ? rotulos[0] : rotulos[1]}
      </span>
      <span className={`relative inline-block w-12 h-7 rounded-full transition-colors ${cor}`}>
        <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${ligado ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
