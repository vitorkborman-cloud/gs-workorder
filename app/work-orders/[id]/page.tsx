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
      .select("*, projects(name)")
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
    setActivities(prev =>
      prev.map(a => (a.id === id ? { ...a, status } : a))
    );
    await supabase.from("activities").update({ status }).eq("id", id);
  }

  async function updateNote(id: string, note: string) {
    if (finalized) return;
    setActivities(prev =>
      prev.map(a => (a.id === id ? { ...a, note } : a))
    );
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

  /* ================= PDF RELATÓRIO OFICIAL ================= */

  async function gerarPDF() {
    if (!workOrder) return;

    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    const roxo = [57, 30, 42];
    const verde = [128, 176, 45];

    async function urlToBase64(url: string) {
      const response = await fetch(url);
      const blob = await response.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }

    function addHeaderCompleto() {
      pdf.setFillColor(...roxo);
      pdf.rect(0, 0, pageWidth, 25, "F");

      pdf.setFillColor(...verde);
      pdf.rect(0, 25, pageWidth, 3, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        "RELATÓRIO TÉCNICO DE WORK ORDER",
        pageWidth / 2,
        15,
        { align: "center" }
      );

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");

      pdf.text("GreenSoil Group Ambiental LTDA", margin, 38);
      pdf.text("CNPJ: 29.088.151/0001-25", margin, 44);
      pdf.text(
        "Avenida Brigadeiro Faria Lima, 1572, Conjunto 1601 - Jardim Paulistano, São Paulo/SP - 014151-001",
        margin,
        50,
        { maxWidth: pageWidth - margin * 2 }
      );

      pdf.line(margin, 55, pageWidth - margin, 55);

      pdf.text(`Projeto: ${workOrder.projects?.name ?? "-"}`, margin, 65);
      pdf.text(`Work Order: ${workOrder.title}`, margin, 72);
      pdf.text(
        `Data de emissão: ${new Date().toLocaleDateString()}`,
        margin,
        79
      );
    }

    function addHeaderSimples() {
      pdf.setFillColor(...roxo);
      pdf.rect(0, 0, pageWidth, 15, "F");

      pdf.setFillColor(...verde);
      pdf.rect(0, 15, pageWidth, 3, "F");
    }

    function addFooter(pageNumber: number) {
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(
        `Página ${pageNumber}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }

    addHeaderCompleto();

    let currentY = 90;
    let pageNumber = 1;

    for (const act of activities) {
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");

      pdf.text(
        `${act.description} - ${
          act.status === "concluído" ? "Concluído" : "Não Concluído"
        }`,
        margin,
        currentY
      );

      currentY += 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);

      pdf.text(
        `Comentários: ${
          act.note?.trim() ? act.note : "Sem observações"
        }`,
        margin,
        currentY,
        { maxWidth: pageWidth - margin * 2 }
      );

      currentY += 10;

      if (act.images?.length) {
        const imgBase64 = await urlToBase64(act.images[0]);
        const img = new Image();
        img.src = imgBase64;
        await new Promise(res => (img.onload = res));

        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - currentY - 30;

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

      addFooter(pageNumber);
      pdf.addPage();
      pageNumber++;
      addHeaderSimples();
      currentY = 30;
    }

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

    const meses = [
      "janeiro","fevereiro","março","abril","maio","junho",
      "julho","agosto","setembro","outubro","novembro","dezembro"
    ];

    const hoje = new Date();
    const dataExtenso = `São Paulo, ${hoje.getDate()} de ${
      meses[hoje.getMonth()]
    } de ${hoje.getFullYear()}.`;

    pdf.text(dataExtenso, pageWidth / 2, currentY + 10, { align: "center" });

    addFooter(pageNumber);

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
                <p className="font-semibold">{act.description}</p>

                {!finalized && (
                  <div className="flex gap-3">
                    <Button
                      className="bg-green-600 text-white"
                      onClick={() => updateStatus(act.id, "concluído")}
                    >
                      Concluído
                    </Button>

                    <Button
                      className="bg-red-600 text-white"
                      onClick={() => updateStatus(act.id, "não concluído")}
                    >
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