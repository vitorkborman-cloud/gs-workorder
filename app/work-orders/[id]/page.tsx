"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AppShell from "../../../components/AppShell";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import { isMobileDevice } from "../../../lib/isMobile";

type Activity = {
  id: string;
  description: string;
  status: string | null;
  note: string | null;
};

export default function WorkOrderPage() {
  const params = useParams();
  const workOrderId = params.id as string;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [finalized, setFinalized] = useState(false);
  const [mobile, setMobile] = useState(false);

  async function load() {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("finalized")
      .eq("id", workOrderId)
      .single();

    setFinalized(!!wo?.finalized);

    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true });

    if (data) setActivities(data);
  }

  async function createActivity() {
    if (finalized || mobile) return;

    const description = prompt("Descrição da atividade:");
    if (!description) return;

    await supabase.from("activities").insert({
      description,
      work_order_id: workOrderId,
    });

    load();
  }

  async function deleteActivity(id: string, description: string) {
    if (finalized || mobile) return;

    const ok = confirm(
      `Excluir a atividade:\n"${description}"?`
    );
    if (!ok) return;

    await supabase.from("activities").delete().eq("id", id);
    load();
  }

  async function updateStatus(id: string, status: string) {
    if (finalized) return;

    await supabase
      .from("activities")
      .update({ status })
      .eq("id", id);

    load();
  }

  async function finalizeWorkOrder() {
    if (finalized) return;

    const incomplete = activities.some((a) => !a.status);
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

  useEffect(() => {
    setMobile(isMobileDevice());
    load();
  }, []);

  return (
    <AppShell>
      <Card title="Atividades">
        {!finalized && !mobile && (
          <div className="mb-4">
            <Button text="Criar Atividade" onClick={createActivity} />
          </div>
        )}

        <div className="space-y-3">
          {activities.map((act) => (
            <div
              key={act.id}
              className="border rounded-xl p-3"
            >
              <div className="flex justify-between items-center">
                <p className="font-bold">{act.description}</p>

                {!finalized && !mobile && (
                  <button
                    onClick={() =>
                      deleteActivity(act.id, act.description)
                    }
                    className="text-xs font-bold underline"
                  >
                    Excluir
                  </button>
                )}
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  disabled={finalized}
                  onClick={() =>
                    updateStatus(act.id, "concluído")
                  }
                >
                  Concluído
                </button>
                <button
                  disabled={finalized}
                  onClick={() =>
                    updateStatus(act.id, "não concluído")
                  }
                >
                  Não concluído
                </button>
              </div>
            </div>
          ))}
        </div>

        {!finalized && (
          <div className="mt-6">
            <Button
              text="Finalizar Work Order"
              onClick={finalizeWorkOrder}
            />
          </div>
        )}
      </Card>
    </AppShell>
  );
}
