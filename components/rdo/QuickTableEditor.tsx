"use client";

export type QuickTableColumn = { id: string; label: string };
export type QuickTableRow = Record<string, string>;

export function QuickTableEditor({
  titulo,
  colunas,
  linhas,
  onTituloChange,
  onColunasChange,
  onLinhasChange,
  onDelete,
  onSaveAsTemplate,
  onExportExcel,
}: {
  titulo: string;
  colunas: QuickTableColumn[];
  linhas: QuickTableRow[];
  onTituloChange: (v: string) => void;
  onColunasChange: (v: QuickTableColumn[]) => void;
  onLinhasChange: (v: QuickTableRow[]) => void;
  onDelete: () => void;
  onSaveAsTemplate: () => void;
  onExportExcel: () => void;
}) {
  function addColumn() {
    const label = prompt("Nome da coluna:")?.trim();
    if (!label) return;
    onColunasChange([...colunas, { id: crypto.randomUUID(), label }]);
  }

  function removeColumn(colId: string) {
    onColunasChange(colunas.filter((c) => c.id !== colId));
    onLinhasChange(linhas.map((row) => {
      const next = { ...row };
      delete next[colId];
      return next;
    }));
  }

  function addRow() {
    const empty: QuickTableRow = {};
    colunas.forEach((c) => { empty[c.id] = ""; });
    onLinhasChange([...linhas, empty]);
  }

  function removeRow(idx: number) {
    onLinhasChange(linhas.filter((_, i) => i !== idx));
  }

  function updateCell(idx: number, colId: string, value: string) {
    const next = [...linhas];
    next[idx] = { ...next[idx], [colId]: value };
    onLinhasChange(next);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3 border-b border-gray-100">
        <input
          value={titulo}
          onChange={(e) => onTituloChange(e.target.value)}
          className="font-bold text-sm text-[#391e2a] bg-transparent outline-none flex-1"
          placeholder="Título da tabela"
        />
        <div className="flex gap-3 shrink-0">
          <button onClick={onSaveAsTemplate} className="text-xs font-bold text-gray-500 hover:text-[#391e2a]">
            Salvar como modelo
          </button>
          <button onClick={onExportExcel} className="text-xs font-bold text-[#80b02d] hover:text-[#6a9425]">
            Exportar Excel
          </button>
          <button onClick={onDelete} className="text-xs font-bold text-red-500 hover:text-red-700">
            Remover
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#391e2a] text-white text-xs">
              {colunas.map((c) => (
                <th key={c.id} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span>{c.label}</span>
                    <button onClick={() => removeColumn(c.id)} className="text-white/60 hover:text-white" title="Remover coluna">✕</button>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 w-10">
                <button onClick={addColumn} className="text-white/80 hover:text-white font-bold" title="Adicionar coluna">+</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={colunas.length + 1} className="px-3 py-6 text-center text-gray-400 text-xs">
                  Nenhuma linha ainda.
                </td>
              </tr>
            )}
            {linhas.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {colunas.map((c) => (
                  <td key={c.id} className="px-1 py-1 border-b border-gray-100">
                    <input
                      value={row[c.id] ?? ""}
                      onChange={(e) => updateCell(idx, c.id, e.target.value)}
                      className="w-full text-sm px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-[#80b02d] bg-transparent"
                    />
                  </td>
                ))}
                <td className="px-2 py-1 border-b border-gray-100 text-center">
                  <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 text-xs" title="Remover linha">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t border-gray-100">
        <button onClick={addRow} className="text-xs font-bold text-[#80b02d] hover:text-[#6a9425]">
          + ADICIONAR LINHA
        </button>
      </div>
    </div>
  );
}
