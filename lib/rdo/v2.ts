import { supabase } from "@/lib/supabase";

// Tipos e regras de cálculo do RDO simplificado (formato 'v2').
// Ver supabase/migrations/0019_rdo_v2.sql.

export type TipoInstrumento = "acumulado" | "instantaneo" | "estoque";

export const TIPO_LABEL: Record<TipoInstrumento, string> = {
  acumulado: "Acumulado (totalizador)",
  instantaneo: "Instantâneo",
  estoque: "Estoque (nível)",
};

export type Instrumento = {
  id: string;
  project_id: string;
  grupo: string;
  nome: string;
  tipo: TipoInstrumento;
  unidade: string;
  instrucao: string | null;
  ordem: number;
  ativo: boolean;
  vigente_desde: string;
};

export type AtividadeFixaCfg = { id: string; project_id: string; nome: string; ordem: number; ativo: boolean };
export type MembroEquipe = { id: string; project_id: string; nome: string; ativo: boolean };

/** Leitura como fica gravada em rdo_reports.leituras (valor null = não coletado). */
export type LeituraRdo = {
  instrumento_id: string;
  grupo: string;
  nome: string;
  tipo: TipoInstrumento;
  unidade: string;
  instrucao?: string | null;
  valor: number | null;
  nao_coletado: boolean;
};

export type AtividadeFixaRdo = { id: string; nome: string; realizado: boolean; obs: string };

export type AtividadeDia = {
  atividade: string;
  responsaveis: string[];
  /** "Concluído" | "Não concluído" */
  status: string;
  obs: string;
  origem?: string;
};

export const STATUS_CONCLUIDO = "Concluído";
export const STATUS_NAO_CONCLUIDO = "Não concluído";

export type Ocorrencias = { houve: boolean; descricao: string };

export type RdoV2 = {
  data: string;
  preenchido_por?: string | null;
  equipe?: string[];
  atividades_fixas?: AtividadeFixaRdo[];
  leituras?: LeituraRdo[];
  atividades?: AtividadeDia[];
  ocorrencias?: Ocorrencias;
  comentarios?: string;
  fotos?: { storagePath: string; legenda?: string }[];
};

// ── Quem preenche ───────────────────────────────────────────────────────────

// Nome completo de cada colaborador, pela parte do e-mail antes do "@".
// Quem não estiver aqui cai no nome do perfil ou, por último, no próprio login.
const NOMES_POR_LOGIN: Record<string, string> = {
  "v.borman": "Vitor Borman",
  "v.oliveira": "Victor Hugo Oliveira",
  "f.oliveira": "Fábio Oliveira",
  "w.santos": "Wellington Santos",
  "m.santos": "Michael Santos",
  "g.calegari": "Gustavo Calegari",
};

export function nomeDoUsuario(user: { email?: string | null; user_metadata?: any } | null | undefined): string {
  const login = (user?.email || "").split("@")[0].toLowerCase();
  return NOMES_POR_LOGIN[login] || user?.user_metadata?.full_name || user?.user_metadata?.name || login;
}

// ── Números ─────────────────────────────────────────────────────────────────

/** "12,5" / "12.5" / " 7 " -> número; vazio/ inválido -> null. */
export function parseNumero(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function formatNumero(n: number | null | undefined, casas = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

export function formatDataBr(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ── Leituras anteriores e cálculo do dia ────────────────────────────────────

export type Anterior = { valor: number; data: string };

/**
 * Última leitura numérica de cada instrumento em RDOs v2 de datas ANTERIORES
 * à informada (não conta programados nem o próprio RDO). "Não coletado" é
 * ignorado: a referência continua sendo a última leitura de verdade.
 */
export async function buscarAnteriores(
  projectId: string,
  data: string,
  excluirRdoId?: string
): Promise<Record<string, Anterior>> {
  const { data: rows } = await supabase
    .from("rdo_reports")
    .select("id, data, leituras, status")
    .eq("project_id", projectId)
    .eq("formato", "v2")
    .neq("status", "programado")
    .lt("data", data)
    .order("data", { ascending: false })
    .limit(80);

  const out: Record<string, Anterior> = {};
  for (const r of rows || []) {
    if (excluirRdoId && r.id === excluirRdoId) continue;
    for (const l of (r.leituras || []) as LeituraRdo[]) {
      if (l.valor === null || l.valor === undefined) continue;
      if (!(l.instrumento_id in out)) out[l.instrumento_id] = { valor: l.valor, data: r.data };
    }
  }
  return out;
}

export type ResultadoDia = {
  /** Rótulo da grandeza calculada ("Volume do dia", "Consumo", "Reabastecimento"). */
  rotulo: string;
  valor: number;
  /** Algo suspeito que precisa de confirmação (ex.: totalizador menor que o anterior). */
  alerta?: string;
};

export function calcularDia(
  tipo: TipoInstrumento,
  atual: number | null,
  anterior: number | null | undefined
): ResultadoDia | null {
  if (atual === null || anterior === null || anterior === undefined) return null;
  if (tipo === "acumulado") {
    const v = atual - anterior;
    return v < 0
      ? { rotulo: "Volume do dia", valor: v, alerta: "Menor que a leitura anterior (mostrador virou ou foi trocado?)" }
      : { rotulo: "Volume do dia", valor: v };
  }
  if (tipo === "estoque") {
    const v = anterior - atual;
    return v >= 0
      ? { rotulo: "Consumo", valor: v }
      : { rotulo: "Reabastecimento", valor: -v };
  }
  return null;
}

// ── Sincronização da lista de leituras do RDO com o cadastro do projeto ────

/**
 * Junta o cadastro atual de instrumentos do projeto com as leituras já
 * existentes no RDO: mantém o que já foi lançado (mesmo que o instrumento
 * tenha sido desativado depois), acrescenta instrumentos ativos e vigentes na
 * data do RDO que ainda não estão na lista, e atualiza nome/unidade/grupo de
 * leituras ainda sem valor.
 */
export function sincronizarLeituras(
  instrumentos: Instrumento[],
  existentes: LeituraRdo[],
  dataRdo: string
): LeituraRdo[] {
  const porId = new Map(existentes.map((l) => [l.instrumento_id, l]));
  const resultado: LeituraRdo[] = [];

  const ordenados = [...instrumentos].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  for (const inst of ordenados) {
    const atual = porId.get(inst.id);
    const preenchida = !!atual && (atual.valor !== null || atual.nao_coletado);
    const deveAparecer = inst.ativo && (!dataRdo || inst.vigente_desde <= dataRdo);
    if (!deveAparecer && !preenchida) continue;
    resultado.push({
      instrumento_id: inst.id,
      grupo: inst.grupo,
      nome: inst.nome,
      tipo: inst.tipo,
      unidade: inst.unidade,
      instrucao: inst.instrucao,
      valor: atual?.valor ?? null,
      nao_coletado: atual?.nao_coletado ?? false,
    });
    porId.delete(inst.id);
  }
  // Leituras de instrumentos que foram apagados do cadastro: preserva o que foi lançado.
  for (const l of porId.values()) {
    if (l.valor !== null || l.nao_coletado) resultado.push(l);
  }
  return resultado;
}

/** Agrupa preservando a ordem de aparição dos grupos. */
export function agruparPorGrupo<T extends { grupo: string }>(itens: T[]): { grupo: string; itens: T[] }[] {
  const mapa = new Map<string, T[]>();
  for (const it of itens) {
    const g = it.grupo || "Geral";
    if (!mapa.has(g)) mapa.set(g, []);
    mapa.get(g)!.push(it);
  }
  return Array.from(mapa.entries()).map(([grupo, lista]) => ({ grupo, itens: lista }));
}

/** Contagem usada pelo dashboard: "Não concluído" NÃO conta como concluído. */
export function statusEhConcluido(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s.includes("conclu") && !s.includes("não") && !s.includes("nao");
}

export const RDO_V2_NOVO = {
  equipe: [] as string[],
  atividades_fixas: [] as AtividadeFixaRdo[],
  leituras: [] as LeituraRdo[],
  ocorrencias: { houve: false, descricao: "" } as Ocorrencias,
};
