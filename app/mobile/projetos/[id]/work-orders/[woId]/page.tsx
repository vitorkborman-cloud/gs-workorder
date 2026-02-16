"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../../lib/supabase";
import MobileShell from "../../../../../../components/layout/MobileShell";

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

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: string) {
    if (finalized) return;

    setActivities(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    await supabase.from("activities").update({ status }).eq("id", id);
  }

  async function updateNote(id: string, note: string) {
    if (finalized) return;
    await supabase.from("activities").update({ note }).eq("id", id);
  }

  async function finalize() {
    const incomplete = activities.some(a => !a.status);
    if (incomplete) {
      alert("Todas as atividades precisam ser respondidas.");
      return;
    }

    await supabase.from("work_orders").update({ finalized: true }).eq("id", workOrderId);
    load();
  }

  /* ========= SWIPE TOUCH REAL ========= */

  function SwipeCard({ act }: { act: Activity }) {
    const startX = useRef<number | null>(null);
    const startY = useRef<number | null>(null);

    function onTouchStart(e: React.TouchEvent) {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    }

    function onTouchEnd(e: React.TouchEvent) {
      if (startX.current === null || startY.current === null) return;

      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;

      // só aceita swipe horizontal real
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 70) {
        if (dx > 0) updateStatus(act.id, "concluído");
        else updateStatus(act.id, "não concluído");
      }

      startX.current = null;
      startY.current = null;
    }

    return (
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`
          rounded-2xl p-4 border transition
          ${act.status === "concluído" && "border-green-500 bg-green-50"}
          ${act.status === "não concluído" && "border-red-500 bg-red-50"}
          ${!act.status && "border-gray-200 bg-white"}
        `}
      >
        <p className="font-semibold mb-3">{act.description}</p>

        <textarea
          disabled={finalized}
          defaultValue={act.note ?? ""}
          onBlur={(e) => updateNote(act.id, e.target.value)}
          placeholder="Observações..."
          className="w-full rounded-xl border p-3 text-sm"
        />

        <div className="text-xs text-gray-400 mt-2">
          ➜ Deslize para direita = Concluído  
          ➜ Deslize para esquerda = Não concluído
        </div>
      </div>
    );
  }

  return (
    <MobileShell
      title="Checklist"
      backHref={`/mobile/projetos/${params.id}/work-orders`}
    >
      <div className="space-y-4 pb-28">
        {activities.map(act => (
          <SwipeCard key={act.id} act={act} />
        ))}
      </div>

      {!finalized && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
          <button
            onClick={finalize}
            className="w-full py-4 rounded-2xl font-bold text-white bg-[var(--green)]"
          >
            Finalizar Work Order
          </button>
        </div>
      )}
    </MobileShell>
  );
}
