"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../../components/layout/AdminShell";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { isMobileDevice } from "../../../lib/isMobile";

import jsPDF from "jspdf";

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

  /* ================= PDF RELATÓRIO TÉCNICO ================= */

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

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    /* ================= LOGO PROPORCIONAL ================= */

    try {
      const logoBase64 = await urlToBase64("/logo.png");
      const img = new Image();
      img.src = logoBase64;
      await new Promise(res => (img.onload = res));

      const maxWidth = 35;
      const ratio = img.width / img.height;
      const width = maxWidth;
      const height = width / ratio;

      pdf.addImage(logoBase64, "PNG", margin, 15, width, height);
    } catch {}

    /* ================= TÍTULO ================= */

    pdf.setFontSize(16);
    pdf.text("RELATÓRIO TÉCNICO DE WORK ORDER", pageWidth / 2, 25, { align: "center" });

    pdf.setFontSize(11);
    pdf.text(`Work Order: ${workOrder.title}`, margin, 45);
    pdf.text(`Data de emissão: ${new Date().toLocaleDateString()}`, margin, 52);

    let currentY = 65;

    /* ================= ATIVIDADES ================= */

    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];

      pdf.setFontSize(12);
      pdf.text(
        `Atividade ${i + 1} - ${act.status === "concluído" ? "Concluída" : "Não concluída"}`,
        margin,
        currentY
      );

      currentY += 8;

      pdf.setFontSize(11);
      pdf.text(
        `Comentários: ${act.note?.trim() ? act.note : "Sem observações"}`,
        margin,
        currentY,
        { maxWidth: pageWidth - margin * 2 }
      );

      currentY += 15;

      /* FOTO */
      if (act.images && act.images.length > 0) {
        pdf.addPage();
        currentY = 20;

        const imgBase64 = await urlToBase64(act.images[0]);
        const img = new Image();
        img.src = imgBase64;
        await new Promise(res => (img.onload = res));

        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - 40;

        let width = img.width;
        let height = img.height;
        const ratio = width / height;

        if (width > maxWidth) {
          width = maxWidth;
          height = width / ratio;
        }

        if (height > maxHeight) {
          height = maxHeight;
          width = height * ratio;
        }

        const x = (pageWidth - width) / 2;
        pdf.addImage(imgBase64, "JPEG", x, currentY, width, height);
      }

      pdf.addPage();
      currentY = 20;
    }

    /* ================= INFORMAÇÕES ADICIONAIS ================= */

    if (workOrder.additional_info || (workOrder.additional_images?.length ?? 0) > 0) {
      pdf.setFontSize(12);
      pdf.text("Informações adicionais", margin, currentY);
      currentY += 8;

      pdf.setFontSize(11);
      pdf.text(
        workOrder.additional_info?.trim() || "Sem observações adicionais.",
        margin,
        currentY,
        { maxWidth: pageWidth - margin * 2 }
      );

      currentY += 15;

      if (workOrder.additional_images?.length > 0) {
        pdf.addPage();
        currentY = 20;

        const imgBase64 = await urlToBase64(workOrder.additional_images[0]);
        const img = new Image();
        img.src = imgBase64;
        await new Promise(res => (img.onload = res));

        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - 40;

        let width = img.width;
        let height = img.height;
        const ratio = width / height;

        if (width > maxWidth) {
          width = maxWidth;
          height = width / ratio;
        }

        if (height > maxHeight) {
          height = maxHeight;
          width = height * ratio;
        }

        const x = (pageWidth - width) / 2;
        pdf.addImage(imgBase64, "JPEG", x, currentY, width, height);
      }

      pdf.addPage();
      currentY = 40;
    }

    /* ================= ASSINATURA ================= */

    if (workOrder.signature_url) {
      const signBase64 = await urlToBase64(workOrder.signature_url);
      const img = new Image();
      img.src = signBase64;
      await new Promise(res => (img.onload = res));

      const maxWidth = 80;
      const ratio = img.width / img.height;
      const width = maxWidth;
      const height = width / ratio;

      const x = (pageWidth - width) / 2;

      pdf.addImage(signBase64, "PNG", x, currentY, width, height);

      currentY += height + 15;
    }

    /* ================= DATA FORMAL ================= */

    const meses = [
      "janeiro","fevereiro","março","abril","maio","junho",
      "julho","agosto","setembro","outubro","novembro","dezembro"
    ];

    const hoje = new Date();
    const dataExtenso = `São Paulo, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

    pdf.text(dataExtenso, pageWidth / 2, currentY + 10, { align: "center" });

    pdf.save(`workorder_${workOrder.title}.pdf`);
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