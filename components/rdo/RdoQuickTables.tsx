"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadQuickTableExcel, type QuickTable as QuickTableExcelShape } from "@/lib/excel/quick-table";
import { QuickTableEditor, type QuickTableColumn, type QuickTableRow } from "./QuickTableEditor";
import { QuickTableTemplatePicker, type TableTemplate } from "./QuickTableTemplatePicker";

type QuickTableRecord = {
  id: string;
  titulo: string;
  colunas: QuickTableColumn[];
  linhas: QuickTableRow[];
  ordem: number;
};

const SAVE_DEBOUNCE_MS = 800;

export default function RdoQuickTables({ rdoId }: { rdoId: string }) {
  const [tables, setTables] = useState<QuickTableRecord[]>([]);
  const [templates, setTemplates] = useState<TableTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => { load(); }, [rdoId]);

  async function load() {
    setLoading(true);
    const [{ data: t }, { data: tpl }] = await Promise.all([
      supabase.from("rdo_quick_tables").select("*").eq("rdo_id", rdoId).order("ordem", { ascending: true }),
      supabase.from("rdo_table_templates").select("id, nome, colunas").order("created_at", { ascending: false }),
    ]);
    if (t) setTables(t as QuickTableRecord[]);
    if (tpl) setTemplates(tpl as TableTemplate[]);
    setLoading(false);
  }

  async function createTable(template: TableTemplate | null) {
    const colunas: QuickTableColumn[] = template ? template.colunas : [{ id: crypto.randomUUID(), label: "Coluna 1" }];
    const { data, error } = await supabase
      .from("rdo_quick_tables")
      .insert({
        rdo_id: rdoId,
        template_id: template?.id ?? null,
        titulo: template ? template.nome : "Nova Tabela",
        colunas,
        linhas: [],
        ordem: tables.length,
      })
      .select("*")
      .single();
    if (!error && data) setTables((prev) => [...prev, data as QuickTableRecord]);
    setPickerOpen(false);
  }

  function scheduleSave(id: string, patch: Partial<Pick<QuickTableRecord, "titulo" | "colunas" | "linhas">>) {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      supabase.from("rdo_quick_tables").update(patch).eq("id", id);
    }, SAVE_DEBOUNCE_MS);
  }

  async function deleteTable(id: string) {
    if (!confirm("Remover esta tabela do RDO?")) return;
    await supabase.from("rdo_quick_tables").delete().eq("id", id);
    setTables((prev) => prev.filter((t) => t.id !== id));
  }

  async function saveAsTemplate(table: QuickTableRecord) {
    const nome = prompt("Nome do modelo:", table.titulo)?.trim();
    if (!nome) return;
    const { data, error } = await supabase
      .from("rdo_table_templates")
      .insert({ nome, colunas: table.colunas })
      .select("id, nome, colunas")
      .single();
    if (!error && data) setTemplates((prev) => [data as TableTemplate, ...prev]);
  }

  function exportExcel(table: QuickTableRecord) {
    const shape: QuickTableExcelShape = { titulo: table.titulo, colunas: table.colunas, linhas: table.linhas };
    downloadQuickTableExcel(shape, `${(table.titulo || "Tabela").replace(/\s+/g, "_")}.xlsx`);
  }

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-[#391e2a] uppercase tracking-widest pb-1 border-b border-[#80b02d]/40 flex-1">
          Tabelas Rápidas
        </h3>
        <button
          onClick={() => setPickerOpen(true)}
          className="ml-4 text-xs font-bold text-[#80b02d] hover:text-[#6a9425] whitespace-nowrap"
        >
          + NOVA TABELA
        </button>
      </div>

      {tables.length === 0 && (
        <p className="text-sm text-gray-400">Nenhuma tabela criada neste RDO ainda.</p>
      )}

      <div className="space-y-4">
        {tables.map((table) => (
          <QuickTableEditor
            key={table.id}
            titulo={table.titulo}
            colunas={table.colunas}
            linhas={table.linhas}
            onTituloChange={(v) => scheduleSave(table.id, { titulo: v })}
            onColunasChange={(v) => scheduleSave(table.id, { colunas: v })}
            onLinhasChange={(v) => scheduleSave(table.id, { linhas: v })}
            onDelete={() => deleteTable(table.id)}
            onSaveAsTemplate={() => saveAsTemplate(table)}
            onExportExcel={() => exportExcel(table)}
          />
        ))}
      </div>

      <QuickTableTemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        templates={templates}
        onSelect={createTable}
      />
    </div>
  );
}
