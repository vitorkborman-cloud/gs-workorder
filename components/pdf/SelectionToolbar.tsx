"use client";

// Barra de "modo de seleção" reutilizada nas listas de RDO, Perfis Descritivos
// e Físico-Químicos, pra baixar vários PDFs de uma vez em um único arquivo
// mesclado (ver lib/pdf/merge.ts), sem precisar abrir cada registro.
export function SelectionToolbar({
  active,
  count,
  downloading,
  onToggle,
  onDownload,
  onCancel,
  label = "Selecionar",
}: {
  active: boolean;
  count: number;
  downloading: boolean;
  onToggle: () => void;
  onDownload: () => void;
  onCancel: () => void;
  label?: string;
}) {
  if (!active) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:border-[#391e2a] hover:text-[#391e2a] transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDownload}
        disabled={count === 0 || downloading}
        className="flex items-center gap-2 bg-[#391e2a] hover:bg-[#2a161f] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-8-4V4m0 8l-3-3m3 3l3-3" />
        </svg>
        {downloading ? "Gerando..." : `Baixar (${count})`}
      </button>
      <button
        onClick={onCancel}
        className="text-sm font-bold px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
      >
        Cancelar
      </button>
    </div>
  );
}
