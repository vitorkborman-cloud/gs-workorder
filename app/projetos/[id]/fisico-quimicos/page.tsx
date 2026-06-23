"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// ================= HELPERS (Logo Branco) =================
async function generateWhiteLogoBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Erro no canvas")); return; }
      ctx.drawImage(img, 0, 0);
      ctx.filter = "brightness(0) invert(1)";
      ctx.drawImage(canvas, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

// ================= ÍCONES =================
const Icons = {
  Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Droplet: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  DownloadPDF: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11v6m0 0l-2-2m2 2l2-2" /></svg>,
  DownloadExcel: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  Eye: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
};

type Sampling = {
  id: string;
  poco: string;
  nomenclatura: string;
  identificacao_codigo: string;
  data: string;
  hora_inicio: string;
  na_inicial?: string; 
  na_final?: string;
  fase_livre: boolean;
  espessura_fl?: string;
  leituras: any[];
};

export default function FisicoQuimicosDesktopPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("Carregando...");
  const [groupedData, setGroupedData] = useState<{ [key: string]: Sampling[] }>({});
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [generatingExcel, setGeneratingExcel] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single();
    if (proj) setProjectName(proj.name);

    const { data: samplings } = await supabase
      .from("water_samplings")
      .select("*")
      .eq("project_id", projectId)
      .eq("finalized", true)
      .order("data", { ascending: false });

    if (samplings) {
      const grouped = samplings.reduce((acc: any, curr: Sampling) => {
        const dateKey = curr.data;
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(curr);
        return acc;
      }, {});
      setGroupedData(grouped);
    }
    setLoading(false);
  }

  function formatDateBr(dateString: string) {
    if (!dateString) return "Sem Data";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }

  // ================= GERAR PDF =================
  async function gerarPDFGeral(dataCampanha: string, amostras: Sampling[]) {
    setGeneratingPdf(dataCampanha);
    try {
      let whiteLogoBase64: string | null = null;
      try { whiteLogoBase64 = await generateWhiteLogoBase64("/logo.png"); } catch (e) {}

      const doc = new jsPDF("p", "mm", "a4");
      const marginX   = 15;
      const pageWidth  = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let currentY = 0;

      const brandPurple: [number, number, number] = [57, 30, 42];
      const brandGreen:  [number, number, number] = [128, 176, 45];
      const brandBlue:   [number, number, number] = [47, 126, 161];

      const drawPageHeader = (subtitle = "FÍSICO-QUÍMICOS — LEITURAS DETALHADAS") => {
        doc.setFillColor(...brandPurple);
        doc.rect(0, 0, pageWidth, 30, "F");
        doc.setFillColor(...brandGreen);
        doc.rect(0, 30, pageWidth, 1.5, "F");

        if (whiteLogoBase64) {
          try { doc.addImage(whiteLogoBase64, "PNG", marginX, 8, 32, 10); } catch (e) {}
        }

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(subtitle, pageWidth - marginX, 14, { align: "right" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Projeto: ${projectName}   |   Campanha: ${formatDateBr(dataCampanha)}`, pageWidth - marginX, 21, { align: "right" });
        doc.setTextColor(0, 0, 0);
        currentY = 42;
      };

      const drawPageFooter = (pageNum: number, totalPages: number) => {
        doc.setFillColor(245, 245, 245);
        doc.rect(0, pageHeight - 12, pageWidth, 12, "F");
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text("GreenSoil do Brasil LTDA   |   Documento gerado eletronicamente", marginX, pageHeight - 5);
        doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - marginX, pageHeight - 5, { align: "right" });
        doc.text(new Date().toLocaleString("pt-BR"), pageWidth / 2, pageHeight - 5, { align: "center" });
      };

      const checkPageBreak = (needed: number) => {
        if (currentY + needed > pageHeight - 20) {
          doc.addPage();
          drawPageHeader();
          return true;
        }
        return false;
      };

      // ── Capa ──
      doc.setFillColor(...brandPurple);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      doc.setFillColor(...brandGreen);
      doc.rect(0, pageHeight - 40, pageWidth, 40, "F");

      if (whiteLogoBase64) {
        try { doc.addImage(whiteLogoBase64, "PNG", pageWidth / 2 - 35, 55, 70, 22); } catch (e) {}
      }

      doc.setTextColor(...brandGreen);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO FÍSICO-QUÍMICOS", pageWidth / 2, 108, { align: "center" });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.text(`Campanha de ${formatDateBr(dataCampanha)}`, pageWidth / 2, 120, { align: "center" });

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.4);
      doc.line(pageWidth / 2 - 45, 128, pageWidth / 2 + 45, 128);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Projeto: ${projectName}`, pageWidth / 2, 138, { align: "center" });
      doc.text(`${amostras.length} poços amostrados`, pageWidth / 2, 148, { align: "center" });

      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("GreenSoil do Brasil LTDA   |   CNPJ: 29.088.151/0001-25", pageWidth / 2, pageHeight - 18, { align: "center" });

      // ── Página de resumo ──
      doc.addPage();
      drawPageHeader("FÍSICO-QUÍMICOS — RESUMO DA CAMPANHA");

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...brandPurple);
      doc.text("Resumo dos Poços Amostrados", marginX, currentY);
      currentY += 6;

      autoTable(doc, {
        startY: currentY,
        margin: { left: marginX, right: marginX },
        head: [["Poço", "Nomenclatura", "Cód.", "Hora", "NA Ini.", "NA Fin.", "Fase Livre", "Leituras"]],
        body: amostras.map(a => [
          a.poco || "—",
          a.nomenclatura || "—",
          a.identificacao_codigo || "—",
          a.hora_inicio || "—",
          a.na_inicial ? `${a.na_inicial} m` : "—",
          a.na_final   ? `${a.na_final} m`   : "—",
          a.fase_livre ? "DETECTADA" : "Não",
          String(a.leituras?.length || 0),
        ]),
        theme: "grid",
        headStyles: { fillColor: brandPurple, textColor: 255, fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3, halign: "center" },
        columnStyles: { 0: { halign: "left" }, 1: { halign: "left" } },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 6) {
            if (String(data.cell.raw) === "DETECTADA")
              data.cell.styles.textColor = [200, 0, 0];
          }
        },
      });
      currentY = (doc as any).lastAutoTable.finalY + 16;

      // ── Leituras por poço ──
      for (const amostra of amostras) {
        checkPageBreak(50);

        // Badge do poço
        doc.setFillColor(...brandBlue);
        doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 10, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`POÇO: ${amostra.poco}   |   ${amostra.nomenclatura || "Sem nomenclatura"}   |   Cód: ${amostra.identificacao_codigo || "—"}`, marginX + 3, currentY + 7);
        currentY += 13;

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(
          `Hora Início: ${amostra.hora_inicio || "—"}   |   NA Inicial: ${amostra.na_inicial || "—"} m   |   NA Final: ${amostra.na_final || "—"} m`,
          marginX, currentY
        );
        currentY += 5;

        if (amostra.fase_livre) {
          doc.setTextColor(200, 0, 0);
          doc.setFont("helvetica", "bold");
          doc.text(`⚠ Fase Livre DETECTADA — Espessura: ${amostra.espessura_fl || "—"} m`, marginX, currentY);
        } else {
          doc.setTextColor(100);
          doc.text("Fase Livre: Não detectada", marginX, currentY);
        }
        currentY += 7;

        autoTable(doc, {
          startY: currentY,
          margin: { left: marginX, right: marginX },
          head: [["Horário", "NA (m)", "pH", "ORP (mV)", "OD (mg/L)", "Cond. (µS/cm)"]],
          body: amostra.leituras?.length
            ? amostra.leituras.map((l: any) => [l.horario || "—", l.na || "—", l.ph || "—", l.orp || "—", l.od || "—", l.condutividade || "—"])
            : [["Nenhuma leitura registrada", "", "", "", "", ""]],
          theme: "striped",
          headStyles: { fillColor: brandBlue, textColor: 255, fontStyle: "bold", fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 3, halign: "center", textColor: 50 },
          alternateRowStyles: { fillColor: [240, 249, 255] },
        });
        currentY = (doc as any).lastAutoTable.finalY + 14;
      }

      // ── Rodapés ──
      const totalP = (doc as any).internal.getNumberOfPages();
      for (let i = 2; i <= totalP; i++) {
        doc.setPage(i);
        drawPageFooter(i - 1, totalP - 1);
      }

      doc.save(`FQ_${projectName}_${dataCampanha}.pdf`);
    } catch (error) {
      alert("Erro ao gerar o PDF.");
      console.error(error);
    } finally {
      setGeneratingPdf(null);
    }
  }

  // ================= GERAR EXCEL =================
  async function gerarExcelGeral(dataCampanha: string, amostras: Sampling[]) {
    setGeneratingExcel(dataCampanha);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "GreenSoil do Brasil";
      workbook.created = new Date();

      // ── Aba 1: Resumo ──
      const resumo = workbook.addWorksheet("Resumo da Campanha", { views: [{ showGridLines: false }] });
      resumo.columns = [{ width: 22 }, { width: 20 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 }];

      try {
        const resp = await fetch("/logo.png");
        const buf = await resp.arrayBuffer();
        const logoId = workbook.addImage({ buffer: buf, extension: "png" });
        resumo.addImage(logoId, { tl: { col: 0, row: 0 }, br: { col: 1, row: 3 }, editAs: "oneCell" } as any);
      } catch (_) {}

      ["A1:G1","A2:G2","A3:G3"].forEach(r => resumo.mergeCells(r));
      [1,2,3].forEach(r => {
        const row = resumo.getRow(r);
        row.height = 22;
        row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF391E2A" } };
      });
      const rr1 = resumo.getRow(1);
      rr1.getCell(1).value = "RELATÓRIO DE PARÂMETROS FÍSICO-QUÍMICOS";
      rr1.getCell(1).font = { name: "Calibri", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
      rr1.getCell(1).alignment = { vertical: "middle", horizontal: "right" };

      const rr2 = resumo.getRow(2);
      rr2.getCell(1).value = `Projeto: ${projectName}   |   Campanha: ${formatDateBr(dataCampanha)}`;
      rr2.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF80B02D" } };
      rr2.getCell(1).alignment = { vertical: "middle", horizontal: "right" };

      const rr3 = resumo.getRow(3);
      rr3.getCell(1).value = `Gerado em: ${new Date().toLocaleString("pt-BR")}   |   GreenSoil do Brasil LTDA`;
      rr3.getCell(1).font = { name: "Calibri", size: 9, color: { argb: "FFAAAAAA" } };
      rr3.getCell(1).alignment = { vertical: "middle", horizontal: "right" };

      resumo.addRow([]);

      const rH = resumo.addRow(["Poço", "Nomenclatura / Cód.", "Hora Início", "NA Inicial (m)", "NA Final (m)", "Fase Livre", "Qtd. Leituras"]);
      rH.height = 20;
      rH.eachCell(c => {
        c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF80B02D" } };
        c.alignment = { vertical: "middle", horizontal: "center" };
        c.border = { bottom: { style: "medium", color: { argb: "FF5a7e20" } } };
      });

      amostras.forEach((a, i) => {
        const row = resumo.addRow([
          a.poco || "—",
          `${a.nomenclatura || "—"} / ${a.identificacao_codigo || "—"}`,
          a.hora_inicio || "—",
          a.na_inicial || "—",
          a.na_final || "—",
          a.fase_livre ? `✓ Sim (${a.espessura_fl || "?"}m)` : "Não",
          a.leituras?.length || 0,
        ]);
        row.height = 18;
        const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";
        row.eachCell((c, col) => {
          c.font = { name: "Calibri", size: 10 };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          c.alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "center" };
          c.border = { top: { style: "hair", color: { argb: "FFDDDDDD" } }, bottom: { style: "hair", color: { argb: "FFDDDDDD" } } };
        });
        if (a.fase_livre) {
          row.getCell(6).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFDC2626" } };
        }
      });

      resumo.headerFooter.oddFooter = `&L&8GreenSoil do Brasil LTDA&R&8Página &P de &N`;

      // ── Aba 2: Leituras detalhadas ──
      const sheet = workbook.addWorksheet("Leituras Detalhadas", { views: [{ showGridLines: false, state: "frozen", ySplit: 5 }] });
      sheet.columns = [{ width: 24 }, { width: 20 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 20 }];

      ["A1:G1","A2:G2","A3:G3"].forEach(r => sheet.mergeCells(r));
      [1,2,3].forEach(r => {
        const row = sheet.getRow(r);
        row.height = 22;
        row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF391E2A" } };
      });

      sheet.getRow(1).getCell(1).value = "LEITURAS FÍSICO-QUÍMICAS — DETALHADAS";
      sheet.getRow(1).getCell(1).font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).getCell(1).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getRow(2).getCell(1).value = `Projeto: ${projectName}   |   Campanha: ${formatDateBr(dataCampanha)}`;
      sheet.getRow(2).getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF80B02D" } };
      sheet.getRow(2).getCell(1).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getRow(3).getCell(1).value = "";
      sheet.addRow([]);

      const dH = sheet.addRow(["Poço / Nomenclatura", "Código", "Horário", "NA (m)", "pH", "ORP (mV)", "OD (mg/L)"]);
      dH.height = 20;
      dH.eachCell(c => {
        c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2f7ea1" } };
        c.alignment = { vertical: "middle", horizontal: "center" };
        c.border = { bottom: { style: "medium", color: { argb: "FF1f5c78" } } };
      });
      sheet.autoFilter = { from: "A5", to: "G5" };

      let rowIdx = 0;
      amostras.forEach((a) => {
        (a.leituras?.length ? a.leituras : [null]).forEach((l: any, li: number) => {
          const row = sheet.addRow([
            li === 0 ? `${a.poco} / ${a.nomenclatura || "—"}` : "",
            li === 0 ? a.identificacao_codigo || "—" : "",
            l?.horario || "—",
            l?.na || "—",
            l?.ph || "—",
            l?.orp || "—",
            l?.od || "—",
          ]);
          row.height = 17;
          const bg = rowIdx % 2 === 0 ? "FFFFFFFF" : "FFF0F9FF";
          row.eachCell(c => {
            c.font = { name: "Calibri", size: 10 };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
            c.alignment = { vertical: "middle", horizontal: "center" };
            c.border = { top: { style: "hair", color: { argb: "FFDDDDDD" } }, bottom: { style: "hair", color: { argb: "FFDDDDDD" } } };
          });
          row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
          rowIdx++;
        });
      });

      sheet.headerFooter.oddFooter = `&L&8GreenSoil do Brasil LTDA&R&8Página &P de &N`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `FQ_${projectName}_${dataCampanha}.xlsx`);

    } catch (error) {
      console.error(error);
      alert("Erro ao gerar o arquivo Excel.");
    } finally {
      setGeneratingExcel(null);
    }
  }

  if (loading) return <AdminShell><p className="p-10 text-gray-500 font-bold">Carregando compilados...</p></AdminShell>;

  const datasAgrupadas = Object.keys(groupedData).sort((a, b) => b.localeCompare(a)); 

  return (
    <AdminShell>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* ================= HEADER DA PÁGINA ================= */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-[#391e2a] px-10 py-8 text-white flex justify-between items-center shadow-inner">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Compilado de Físico-Químicos</h1>
              <p className="text-[#80b02d] font-bold mt-2 tracking-widest uppercase text-xs">
                Projeto: {projectName}
              </p>
            </div>
            <div className="bg-white/10 px-5 py-3 rounded-2xl border border-white/20 backdrop-blur-sm text-center">
              <p className="text-3xl font-black">{datasAgrupadas.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mt-1">Dias de Campanha</p>
            </div>
          </div>
        </div>

        {/* ================= LISTA DE CARDS COMPILADOS POR DATA ================= */}
        {datasAgrupadas.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Icons.Droplet />
            </div>
            <h3 className="text-lg font-bold text-gray-700">Nenhuma amostragem recebida</h3>
            <p className="text-gray-500 mt-2">As fichas preenchidas no aplicativo aparecerão compiladas aqui.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {datasAgrupadas.map((dataCampanha) => {
              const amostrasDoDia = groupedData[dataCampanha];

              return (
                <div key={dataCampanha} className="bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden group hover:shadow-lg transition-all duration-300">
                  
                  {/* CABEÇALHO DO CARD (DATA) */}
                  <div className="bg-gray-50 border-b border-gray-200 px-8 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#80b02d]/10 text-[#80b02d] rounded-2xl flex items-center justify-center">
                        <Icons.Calendar />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-[#391e2a]">Campanha do dia {formatDateBr(dataCampanha)}</h2>
                        <p className="text-sm font-semibold text-gray-500 mt-0.5">
                          {amostrasDoDia.length} {amostrasDoDia.length === 1 ? "poço amostrado" : "poços amostrados"}
                        </p>
                      </div>
                    </div>

                    {/* BOTÕES DE EXPORTAÇÃO */}
                    <div className="hidden md:flex items-center gap-3">
                      <Button 
                        onClick={() => gerarExcelGeral(dataCampanha, amostrasDoDia)}
                        disabled={generatingExcel === dataCampanha || generatingPdf === dataCampanha}
                        className="bg-white border-2 border-[#80b02d] text-[#80b02d] hover:bg-[#80b02d] hover:text-white font-bold rounded-xl h-11 px-5 shadow-sm transition-colors flex items-center gap-2"
                      >
                        <Icons.DownloadExcel /> {generatingExcel === dataCampanha ? "Gerando..." : "Excel"}
                      </Button>

                      <Button 
                        onClick={() => gerarPDFGeral(dataCampanha, amostrasDoDia)}
                        disabled={generatingPdf === dataCampanha || generatingExcel === dataCampanha}
                        className="bg-[#391e2a] hover:bg-[#2a161f] text-white font-bold rounded-xl h-11 px-5 shadow-sm transition-colors flex items-center gap-2"
                      >
                        <Icons.DownloadPDF /> {generatingPdf === dataCampanha ? "Gerando..." : "PDF"}
                      </Button>
                    </div>
                  </div>

                  {/* TABELA COMPILADA DO DIA */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                        <tr>
                          <th className="px-8 py-4">Poço</th>
                          <th className="px-6 py-4">Amostra (Código)</th>
                          <th className="px-6 py-4">Início</th>
                          <th className="px-6 py-4">Fase Livre</th>
                          <th className="px-6 py-4">Qtd. Leituras</th>
                          <th className="px-8 py-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {amostrasDoDia.map((amostra) => (
                          <tr key={amostra.id} className="hover:bg-gray-50/50 transition-colors group/row">
                            <td className="px-8 py-4 font-bold text-[#391e2a]">
                              {amostra.poco}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-800">{amostra.nomenclatura || "-"}</span>
                                <span className="text-xs text-gray-400">{amostra.identificacao_codigo || "-"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-600">
                              {amostra.hora_inicio || "-"}
                            </td>
                            <td className="px-6 py-4">
                              {amostra.fase_livre ? (
                                <span className="bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-md text-xs">Sim</span>
                              ) : (
                                <span className="bg-gray-100 text-gray-600 font-bold px-2.5 py-1 rounded-md text-xs">Não</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-[#80b02d]/10 text-[#80b02d] font-bold px-3 py-1 rounded-full text-xs">
                                {amostra.leituras?.length || 0} leituras
                              </span>
                            </td>
                            <td className="px-8 py-4 text-right">
                              <button 
                                onClick={() => router.push(`/projetos/${projectId}/fisico-quimicos/${amostra.id}`)}
                                className="text-[#80b02d] hover:text-white hover:bg-[#80b02d] font-bold px-4 py-2 rounded-lg transition-all text-xs flex items-center gap-2 ml-auto opacity-0 group-hover/row:opacity-100"
                              >
                                <Icons.Eye /> Ver Ficha
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </AdminShell>
  );
}