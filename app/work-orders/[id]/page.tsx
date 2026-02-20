"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../../components/layout/AdminShell";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { isMobileDevice } from "../../../lib/isMobile";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Activity = {
  id: string;
  description: string;
  status: string | null;
  note: string | null;
  images: string[] | null;
};

export default function WorkOrderPage() {
  const params = useParams();
  const workOrderId = params.id as string;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [finalized, setFinalized] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [workOrder, setWorkOrder] = useState<any>(null);

  useEffect(() => {
    setMobile(isMobileDevice());
    load();
  }, []);

  async function load() {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("*")
      .eq("id", workOrderId)
      .single();

    setFinalized(!!wo?.finalized);
    setWorkOrder(wo);

    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true });

    if (data) setActivities(data);
  }

  async function createActivity() {
    const description = prompt("Descrição da atividade:");
    if (!description) return;

    await supabase.from("activities").insert({
      description,
      work_order_id: workOrderId,
    });

    load();
  }

  async function updateStatus(id: string, status: string) {
    if (finalized) return;
    setActivities(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    await supabase.from("activities").update({ status }).eq("id", id);
  }

  async function updateNote(id: string, note: string) {
    if (finalized) return;
    setActivities(prev => prev.map(a => a.id === id ? { ...a, note } : a));
    await supabase.from("activities").update({ note }).eq("id", id);
  }

  async function finalizeWorkOrder() {
    if (finalized) return;

    const incomplete = activities.some(a => !a.status);
    if (incomplete) {
      alert("Todas as atividades precisam ser respondidas.");
      return;
    }

    const ok = confirm("Finalizar Work Order?");
    if (!ok) return;

    await supabase
      .from("work_orders")
      .update({ finalized: true })
      .eq("id", workOrderId);

    load();
  }

  /* ================= PDF DEFINITIVO ================= */

  async function gerarPDF() {
    if (!workOrder) return;

    const pdf = new jsPDF("p", "mm", "a4");

    async function urlToBase64(url: string) {
      const response = await fetch(url);
      const blob = await response.blob();

      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }

    /* LOGO */
    try {
      const logoBase64 = await urlToBase64("/logo.png");
      pdf.addImage(logoBase64, "PNG", 14, 10, 35, 15);
    } catch {}

    /* TÍTULO */
    pdf.setFontSize(18);
    pdf.text("RELATÓRIO DE WORK ORDER", 105, 25, { align: "center" });

    pdf.setFontSize(11);
    pdf.text(`Work Order: ${workOrder.title}`, 14, 40);
    pdf.text(`Data: ${new Date().toLocaleDateString()}`, 14, 46);

    /* TABELA */
    const rows = activities.map(a => [
      a.description,
      a.status === "concluído" ? "CONCLUÍDO" : "NÃO CONCLUÍDO",
      a.note || "-"
    ]);

    autoTable(pdf, {
      startY: 55,
      head: [["Atividade", "Status", "Observação"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [57, 30, 42] },
      styles: { fontSize: 10 },
    });

    /* ================= FOTOS COM ESCALA SEGURA ================= */

    for (const act of activities) {
      if (!act.images || act.images.length === 0) continue;

      for (const imgUrl of act.images) {
        pdf.addPage();

        const imgBase64 = await urlToBase64(imgUrl);

        const img = new Image();
        img.src = imgBase64;

        await new Promise(res => (img.onload = res));

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const margin = 14;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - 40;

        let width = img.width;
        let height = img.height;

        const ratio = width / height;

        // Reduz largura se necessário
        if (width > maxWidth) {
          width = maxWidth;
          height = width / ratio;
        }

        // Reduz altura se necessário
        if (height > maxHeight) {
          height = maxHeight;
          width = height * ratio;
        }

        pdf.text(`Evidência - ${act.description}`, margin, 20);
        pdf.addImage(imgBase64, "JPEG", margin, 30, width, height);
      }
    }

    /* ASSINATURA */
    if (workOrder.signature_url) {
      pdf.addPage();
      pdf.setFontSize(14);
      pdf.text("Assinatura do Responsável", 14, 20);

      const signBase64 = await urlToBase64(workOrder.signature_url);

      const img = new Image();
      img.src = signBase64;

      await new Promise(res => (img.onload = res));

      const maxWidth = 80;
      const ratio = img.width / img.height;

      const width = maxWidth;
      const height = width / ratio;

      pdf.addImage(signBase64, "PNG", 14, 30, width, height);
    }

    pdf.save(`workorder_${workOrder.title}.pdf`);
  }

  function statusBadge(status: string | null) {
    if (!status) return null;
    return status === "concluído"
      ? <span className="text-green-600 font-bold text-sm">✔ Concluído</span>
      : <span className="text-red-600 font-bold text-sm">✖ Não concluído</span>;
  }

  return (
    <AdminShell>
      <div className="space-y-6">

        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Atividades</h1>

          {!mobile && !finalized && (
            <Button className="bg-primary text-white" onClick={createActivity}>
              + Adicionar atividade
            </Button>
          )}
        </div>

        <div className="bg-secondary rounded-2xl p-6 shadow-inner space-y-4">
          {activities.map(act => (
            <Card key={act.id} className="border-0 shadow bg-card">
              <CardContent className="p-5 space-y-4">

                <div className="flex justify-between items-center">
                  <p className="font-semibold">{act.description}</p>
                  {finalized && statusBadge(act.status)}
                </div>

                {!finalized && (
                  <div className="flex gap-3">
                    <Button className="bg-green-600 text-white"
                      onClick={() => updateStatus(act.id, "concluído")}>
                      Concluído
                    </Button>

                    <Button className="bg-red-600 text-white"
                      onClick={() => updateStatus(act.id, "não concluído")}>
                      Não concluído
                    </Button>
                  </div>
                )}

                <textarea
                  placeholder="Observações..."
                  value={act.note ?? ""}
                  disabled={finalized}
                  onChange={(e) => updateNote(act.id, e.target.value)}
                  className="w-full border rounded-lg p-3 text-sm"
                />

              </CardContent>
            </Card>
          ))}
        </div>

        {finalized && (
          <Button className="bg-primary text-white" onClick={gerarPDF}>
            Gerar Relatório PDF
          </Button>
        )}

        {!finalized && (
          <Button className="bg-primary text-white" onClick={finalizeWorkOrder}>
            Finalizar Work Order
          </Button>
        )}

      </div>
    </AdminShell>
  );
}