export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const workOrderId = params.id;

  /* ================= WORK ORDER ================= */

  const { data: wo } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", workOrderId)
    .single();

  if (!wo) {
    return new Response("Work order não encontrada", { status: 404 });
  }

  /* ================= ATIVIDADES ================= */

  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("work_order_id", workOrderId)
    .order("created_at");

  /* ================= PDF ================= */

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 800;

  page.drawText("RELATÓRIO DE VISITA TÉCNICA", {
    x: 50,
    y,
    size: 16,
    font,
  });

  y -= 40;

  for (const act of activities ?? []) {
    page.drawText(`• ${act.description}`, { x: 50, y, size: 11, font });
    y -= 16;

    page.drawText(`Status: ${act.status ?? "-"}`, { x: 70, y, size: 10, font });
    y -= 14;

    if (act.note) {
      page.drawText(`Obs: ${act.note}`, { x: 70, y, size: 10, font });
      y -= 14;
    }

    y -= 10;

    if (y < 80) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
  }

  /* ================= ASSINATURA ================= */

  if (wo.signature_url) {
    try {
      const imgBytes = await fetch(wo.signature_url).then(r => r.arrayBuffer());
      const img = await pdf.embedPng(imgBytes);

      page.drawText("Assinatura:", { x: 50, y: 120, size: 11, font });

      page.drawImage(img, {
        x: 50,
        y: 40,
        width: 200,
        height: 80,
      });
    } catch {}
  }

  const pdfBytes = await pdf.save();

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=workorder-${workOrderId}.pdf`,
    },
  });
}
