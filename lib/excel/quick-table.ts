import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// Módulo genérico de exportação de tabela para Excel, extraído do padrão já
// usado em app/work-orders/[id]/page.tsx (gerarExcel) — mas sem colunas fixas,
// para servir tanto a exportação legada quanto as futuras "tabelas rápidas"
// do RDO (colunas livres, definidas pelo colaborador em campo).

const BRAND_GREEN_ARGB = "FF80B02D";

export type QuickTableColumn = {
  id: string;
  label: string;
};

export type QuickTable = {
  titulo: string;
  colunas: QuickTableColumn[];
  linhas: Record<string, string | number | null | undefined>[];
};

export async function buildQuickTableWorkbook(table: QuickTable): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GreenSoil do Brasil";
  workbook.created = new Date();

  const sheetName = (table.titulo || "Tabela").slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false, state: "frozen", ySplit: 1 }],
  });

  sheet.columns = table.colunas.map((c) => ({ header: c.label, key: c.id, width: 22 }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_GREEN_ARGB } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  if (table.colunas.length > 0) {
    const lastColLetter = sheet.getColumn(table.colunas.length).letter;
    sheet.autoFilter = { from: "A1", to: `${lastColLetter}1` };
  }

  table.linhas.forEach((linha, i) => {
    const row = sheet.addRow(table.colunas.map((c) => linha[c.id] ?? ""));
    row.height = 18;
    const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "hair", color: { argb: "FFDDDDDD" } },
        bottom: { style: "hair", color: { argb: "FFDDDDDD" } },
        left: { style: "hair", color: { argb: "FFDDDDDD" } },
        right: { style: "hair", color: { argb: "FFDDDDDD" } },
      };
    });
  });

  sheet.headerFooter.oddFooter = `&L&8GreenSoil do Brasil LTDA — Documento gerado eletronicamente&R&8Página &P de &N`;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function downloadQuickTableExcel(table: QuickTable, filename: string) {
  const blob = await buildQuickTableWorkbook(table);
  saveAs(blob, filename);
}
