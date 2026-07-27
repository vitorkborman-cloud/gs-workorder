"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export type TableTemplate = { id: string; nome: string; colunas: { id: string; label: string }[] };

export function QuickTableTemplatePicker({
  open,
  onOpenChange,
  templates,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TableTemplate[];
  onSelect: (template: TableTemplate | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Tabela Rápida</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          <button
            onClick={() => onSelect(null)}
            className="w-full text-left border border-dashed border-gray-300 rounded-lg p-3 hover:border-[#80b02d] hover:bg-[#80b02d]/5 transition"
          >
            <p className="font-bold text-sm text-[#391e2a]">Começar do zero</p>
            <p className="text-xs text-gray-400">Cria uma tabela em branco, sem colunas pré-definidas.</p>
          </button>

          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-[#80b02d] hover:bg-[#80b02d]/5 transition"
            >
              <p className="font-bold text-sm text-[#391e2a]">{t.nome}</p>
              <p className="text-xs text-gray-400 mt-1">{t.colunas.map((c) => c.label).join(", ")}</p>
            </button>
          ))}

          {templates.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Nenhum modelo salvo ainda.</p>
          )}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
