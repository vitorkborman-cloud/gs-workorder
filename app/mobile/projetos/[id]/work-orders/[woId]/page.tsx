"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../../lib/supabase";
import AppShell from "../../../../../../components/AppShell";
import Card from "../../../../../../components/Card";
import Button from "../../../../../../components/Button";

type Activity = {
  id: string;
  description: string;
  status: string | null;
  note: string | null;
};

export default function MobileWorkOrderPage() {
  const params = useParams();
  const workOrderId = params.woId as string;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [finalized, setFinalized] = useState(false);

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

  async function updateStatus(id: string, status: string) {
    if (finalized) return;

    await supabase
      .from("activities")
      .update({ status })
      .eq("id", id);

    load();
  }

  async function updateNote(id: string, note: string) {
    if (finalized) return;

    await supabase
      .from("activities")
      .update({ note })
      .eq("id", id);
  }

  async function finalize() {
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
    load();
  }, []);

  return (
    <AppShell>
      <Card title="Atividades">
        <div className="space-y-4">
          {activities.map((act) => (
            <div
              key={act.id}
              className="border rounded-xl p-3 space-y-2"
            >
              <p className="font-bold">{act.description}</p>

              <div className="flex gap-2">
                <button
                  disabled={finalized}
                  onClick={() =>
                    updateStatus(act.id, "concluído")
                  }
                  className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg"
                >
                  Concluído
                </button>

                <button
                  disabled={finalized}
                  onClick={() =>
                    updateStatus(act.id, "não concluído")
                  }
                  className="flex-1 bg-yellow-500 text-white font-bold py-2 rounded-lg"
                >
                  Não concluído
                </button>
              </div>

              <textarea
                disabled={finalized}
                placeholder="Observação"
                defaultValue={act.note ?? ""}
                onBlur={(e) =>
                  updateNote(act.id, e.target.value)
                }
                className="w-full border rounded-lg p-2"
              />
            </div>
          ))}
        </div>

        {!finalized && (
          <div className="mt-6">
            <Button text="Finalizar" onClick={finalize} />
          </div>
        )}
      </Card>
    </AppShell>
  );
}
