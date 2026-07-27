"use client";

export type Atividade = { atividade: string; empresa: string; status: string; obs: string; origem?: string };

const DEFAULT_STATUS_OPTIONS = ["Concluído", "Em andamento", "Não iniciado", "Impedido"];

// Editor de linhas de atividade compartilhado entre a edição normal do RDO
// (desktop) e a tela de programação de RDO com antecedência.
export function AtividadeEditor({
  atividades,
  onChange,
  statusOptions = DEFAULT_STATUS_OPTIONS,
  empresaOptions,
}: {
  atividades: Atividade[];
  onChange: (next: Atividade[]) => void;
  statusOptions?: string[];
  empresaOptions?: string[];
}) {
  function update(idx: number, field: keyof Atividade, value: string) {
    const next = [...atividades];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  }

  function add() {
    onChange([...atividades, { atividade: "", empresa: "", status: statusOptions[2] ?? "", obs: "" }]);
  }

  function remove(idx: number) {
    onChange(atividades.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {atividades.map((ativ, idx) => (
        <div key={idx} className="flex gap-3 bg-white p-3 border rounded-md shadow-sm items-center">
          <input
            type="text"
            value={ativ.atividade || ""}
            onChange={(e) => update(idx, "atividade", e.target.value)}
            className="w-1/3 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none"
            placeholder="Atividade"
          />
          {empresaOptions ? (
            <select
              value={ativ.empresa || ""}
              onChange={(e) => update(idx, "empresa", e.target.value)}
              className="w-1/5 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none"
            >
              <option value="">Selecionar...</option>
              {empresaOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={ativ.empresa || ""}
              onChange={(e) => update(idx, "empresa", e.target.value)}
              className="w-1/5 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none"
              placeholder="Responsável"
            />
          )}
          <select
            value={ativ.status || ""}
            onChange={(e) => update(idx, "status", e.target.value)}
            className="w-1/6 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none"
          >
            {statusOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <input
            type="text"
            value={ativ.obs || ""}
            onChange={(e) => update(idx, "obs", e.target.value)}
            className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none"
            placeholder="Observações"
          />
          <button onClick={() => remove(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded">✕</button>
        </div>
      ))}
      <button onClick={add} className="text-xs font-bold text-[#80b02d] hover:text-[#6a9425] flex items-center gap-1 mt-2">
        + ADICIONAR ATIVIDADE
      </button>
    </div>
  );
}
