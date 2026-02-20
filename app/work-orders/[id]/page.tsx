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
      .select(`*, projects ( name )`)
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

  /* ================= PDF PROFISSIONAL COM CAPA ================= */

  async function gerarPDF() {
    if (!workOrder) return;

    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    const roxo: [number, number, number] = [57, 30, 42];
    const verde: [number, number, number] = [128, 176, 45];

    async function urlToBase64(url: string) {
      const response = await fetch(url);
      const blob = await response.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }

    function addHeaderBase() {
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
    }

    function addFooter(pageNumber: number, total: number) {
      pdf.setFillColor(...roxo);
      pdf.rect(0, pageHeight - 15, pageWidth, 15, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.text(
        `Página ${pageNumber} de ${total}`,
        pageWidth - margin,
        pageHeight - 6,
        { align: "right" }
      );
    }

    /* ================= CAPA ================= */

    addHeaderBase();

    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("GreenSoil Group Ambiental LTDA", pageWidth / 2, 60, {
      align: "center",
    });

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text("CNPJ: 29.088.151/0001-25", pageWidth / 2, 75, {
      align: "center",
    });

    pdf.text(
      "Avenida Brigadeiro Faria Lima, 1572, Conjunto 1601 - Jardim Paulistano, São Paulo/SP - 014151-001",
      pageWidth / 2,
      85,
      { align: "center", maxWidth: 140 }
    );

    pdf.line(margin, 105, pageWidth - margin, 105);

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Projeto: ${workOrder.projects?.name ?? "-"}`, pageWidth / 2, 125, {
      align: "center",
    });

    pdf.text(`Work Order: ${workOrder.title}`, pageWidth / 2, 140, {
      align: "center",
    });

    pdf.setFont("helvetica", "normal");
    pdf.text(
      `Data de emissão: ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      155,
      { align: "center" }
    );

    /* ================= ATIVIDADES ================= */

    pdf.addPage();
    addHeaderBase();

    let currentY = 40;

    for (const act of activities) {
      if (currentY > pageHeight - 40) {
        pdf.addPage();
        addHeaderBase();
        currentY = 40;
      }

      const statusTexto =
        act.status === "concluído" ? "Concluída" : "Não Concluída";

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(`${act.description} - ${statusTexto}`, margin, currentY);
      currentY += 8;

      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Comentário: ${act.note?.trim() ? act.note : "Sem observações"}`,
        margin,
        currentY,
        { maxWidth: pageWidth - margin * 2 }
      );

      currentY += 12;

      if (act.images?.length) {
        const imgBase64 = await urlToBase64(act.images[0]);

        const maxWidth = pageWidth - margin * 2;
        const imgWidth = maxWidth;
        const imgHeight = 60;

        pdf.addImage(imgBase64, "JPEG", margin, currentY, imgWidth, imgHeight);

        currentY += imgHeight + 10;
      }
    }

    /* ================= ASSINATURA ================= */

    if (workOrder.signature_url) {
      pdf.addPage();
      addHeaderBase();

      let signY = 80;

      pdf.setFontSize(12);
      pdf.text("Assinatura do Responsável", pageWidth / 2, signY - 10, {
        align: "center",
      });

      const signBase64 = await urlToBase64(workOrder.signature_url);
      pdf.addImage(signBase64, "PNG", pageWidth / 2 - 40, signY, 80, 40);

      const hoje = new Date();
      const meses = [
        "janeiro","fevereiro","março","abril","maio","junho",
        "julho","agosto","setembro","outubro","novembro","dezembro"
      ];

      const dataExtenso = `São Paulo, ${hoje.getDate()} de ${
        meses[hoje.getMonth()]
      } de ${hoje.getFullYear()}.`;

      pdf.text(dataExtenso, pageWidth / 2, signY + 70, {
        align: "center",
      });
    }

    /* ================= RODAPÉ EM TODAS ================= */

    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      addFooter(i, totalPages);
    }

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