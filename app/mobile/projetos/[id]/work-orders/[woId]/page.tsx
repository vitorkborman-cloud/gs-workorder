"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../../lib/supabase";
import MobileShell from "../../../../../../components/layout/MobileShell";
import { Button } from "../../../../../../components/ui/button";

type Activity = {
  id: string;
  description: string;
  status: string | null;
  note: string | null;
  images: string[] | null;
};

export default function MobileWorkOrderPage() {
  const params = useParams();
  const workOrderId = params.woId as string;
  const projectId = params.id as string;

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

    setActivities(prev =>
      prev.map(a => a.id === id ? { ...a, status } : a)
    );

    await supabase
      .from("activities")
      .update({ status })
      .eq("id", id);
  }

  async function updateNote(id: string, note: string) {
    if (finalized) return;

    setActivities(prev =>
      prev.map(a => a.id === id ? { ...a, note } : a)
    );

    await supabase
      .from("activities")
      .update({ note })
      .eq("id", id);
  }

  /* =======================================================
     VALIDAÇÃO PROFISSIONAL DE FINALIZAÇÃO
     ======================================================= */
  async function finalize() {
    if (finalized) return;

    const unanswered = activities.some(a => !a.status);
    if (unanswered) {
      alert("Todas as atividades precisam ser respondidas.");
      return;
    }

    const notOkWithoutNote = activities.filter(
      a =>
        a.status === "não concluído" &&
        (!a.note || a.note.trim().length < 3)
    );

    if (notOkWithoutNote.length > 0) {
      alert(
        `Existem ${notOkWithoutNote.length} atividade(s) NÃO CONCLUÍDA(S) sem observação.\n\nDescreva o motivo antes de finalizar.`
      );
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

  const total = activities.length;
  const answered = activities.filter(a => a.status).length;
  const progress = total === 0 ? 0 : Math.round((answered / total) * 100);

  return (
    <MobileShell
      title="Atividades"
      subtitle={`${answered}/${total} respondidas`}
      backHref={`/mobile/projetos/${projectId}/work-orders`}
    >
      {/* PROGRESS BAR */}
      <div className="mb-4">
        <div className="h-3 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {progress}% concluído
        </p>
      </div>

      <div className="space-y-4">
        {activities.map((act) => (
          <div
            key={act.id}
            className="bg-card rounded-xl p-4 border space-y-3"
          >
            <p className="font-semibold">{act.description}</p>

            {/* STATUS BUTTONS */}
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={finalized}
                onClick={() => updateStatus(act.id, "concluído")}
                className={`py-2 rounded-lg font-semibold transition
                  ${act.status === "concluído"
                    ? "bg-primary text-white"
                    : "bg-neutral-200"
                  }`}
              >
                Concluído
              </button>

              <button
                disabled={finalized}
                onClick={() => updateStatus(act.id, "não concluído")}
                className={`py-2 rounded-lg font-semibold transition
                  ${act.status === "não concluído"
                    ? "bg-yellow-500 text-white"
                    : "bg-neutral-200"
                  }`}
              >
                Não concluído
              </button>
            </div>

            {/* NOTE */}
            <textarea
              disabled={finalized}
              placeholder="Observação obrigatória se não concluído..."
              value={act.note ?? ""}
              onChange={(e) => updateNote(act.id, e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>
        ))}
      </div>

      {!finalized && (
        <div className="sticky bottom-0 pt-6">
          <Button className="w-full text-lg py-6" onClick={finalize}>
            Finalizar Work Order
          </Button>
        </div>
      )}
    </MobileShell>
  );
}
