import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const workOrderId = params.id;

  /* ================= BUSCAR WORK ORDER ================= */

  const { data: workorder } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", workOrderId)
    .single();

  if (!workorder) {
    return new NextResponse("WorkOrder não encontrada", { status: 404 });
  }

  /* ================= BUSCAR ATIVIDADES ================= */

  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true });

  /* ================= CRIAR PDF ================= */

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;

  function line(text: string, size = 11) {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }

    page.drawText(text, {
      x: 50,
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });

    y -= size + 8;
  }

  /* ================= CABEÇALHO ================= */

  page.drawText("GS WORK ORDER", {
    x: 50,
    y,
    size: 18,
    font: bold,
  });

  y -= 30;

  line(`ID: ${workOrderId}`);
  line(`Data: ${new Date(workorder.created_at).toLocaleString()}`);
  line("");

  /* ================= ATIVIDADES ================= */

  line("ATIVIDADES", 14);
  y -= 10;

  activities?.forEach((act, index) => {
    line(`${index + 1}. ${act.description}`);

    if (act.status === "concluído")
      line("Status: CONCLUÍDO");

    if (act.status === "não concluído")
      line("Status: NÃO CONCLUÍDO");

    if (act.note) line(`Obs: ${act.note}`);

    line("");
  });

  /* ================= ASSINATURA ================= */

  if (workorder.signature_url) {
    try {
      const imgRes = await fetch(workorder.signature_url);
      const imgBytes = await imgRes.arrayBuffer();

      const png = await pdf.embedPng(imgBytes);

      y -= 40;
      line("Assinatura do responsável:");

      page.drawImage(png, {
        x: 50,
        y: y - 80,
        width: 200,
        height: 80,
      });
    } catch {}
  }

  /* ================= GERAR ================= */

  const pdfBytes = await pdf.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=workorder_${workOrderId}.pdf`,
    },
  });
}
