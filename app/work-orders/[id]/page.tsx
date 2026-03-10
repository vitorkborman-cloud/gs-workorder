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

  async function gerarPDF() {
    /* TODO: mantém seu código existente sem alteração */
  }

  return (
    <AdminShell>

      <div className="space-y-8">

        {/* HEADER */}
        <div className="flex justify-between items-center">

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Atividades
            </h1>

            <p className="text-sm text-gray-500">
              Checklist da visita técnica
            </p>
          </div>

          {!mobile && !finalized && (
            <Button
              className="bg-gradient-to-r from-[#391e2a] to-[#80b02d] text-white shadow-lg"
              onClick={createActivity}
            >
              + Adicionar atividade
            </Button>
          )}

        </div>


        {/* LISTA DE ATIVIDADES */}
        <div className="bg-secondary rounded-3xl p-8 shadow-inner space-y-5">

          {activities.length === 0 && (
            <p className="text-white/70">
              Nenhuma atividade cadastrada.
            </p>
          )}

          {activities.map(act => (

            <Card
              key={act.id}
              className="border-0 shadow-lg bg-card rounded-2xl"
            >

              <CardContent className="p-6 space-y-5">

                {/* DESCRIÇÃO */}
                <div className="flex justify-between items-center">

                  <p className="font-semibold text-lg">
                    {act.description}
                  </p>

                  {act.status && (
                    <span
                      className={`text-xs px-3 py-1 rounded-full ${
                        act.status === "concluído"
                          ? "bg-green-600 text-white"
                          : "bg-red-600 text-white"
                      }`}
                    >
                      {act.status === "concluído"
                        ? "Concluído"
                        : "Não concluído"}
                    </span>
                  )}

                </div>


                {/* BOTÕES DE STATUS */}
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
                      onClick={() =>
                        updateStatus(act.id, "não concluído")
                      }
                    >
                      Não concluído
                    </Button>

                  </div>
                )}


                {/* OBSERVAÇÃO */}
                <textarea
                  placeholder="Observações..."
                  value={act.note ?? ""}
                  disabled={finalized}
                  onChange={(e) =>
                    updateNote(act.id, e.target.value)
                  }
                  className="
                  w-full
                  border
                  border-gray-300
                  rounded-xl
                  p-3
                  text-sm
                  resize-none
                  focus:ring-2
                  focus:ring-[var(--green)]
                  outline-none
                  "
                  rows={3}
                />

              </CardContent>

            </Card>

          ))}

        </div>


        {/* BOTÕES FINAIS */}
        <div className="flex gap-4">

          {finalized && (
            <Button
              className="bg-gradient-to-r from-[#391e2a] to-[#80b02d] text-white shadow-lg"
              onClick={gerarPDF}
            >
              Gerar Relatório PDF
            </Button>
          )}

          {!finalized && (
            <Button
              className="bg-gradient-to-r from-[#391e2a] to-[#80b02d] text-white shadow-lg"
              onClick={finalizeWorkOrder}
            >
              Finalizar Work Order
            </Button>
          )}

        </div>

      </div>

    </AdminShell>
  );
}