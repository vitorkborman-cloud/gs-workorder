"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import MobileShell from "../../../../../components/layout/MobileShell";

type WorkOrder = {
  id: string;
  title: string;
  finalized: boolean;
};

export default function MobileWorkOrders() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  async function load() {
    const { data } = await supabase
      .from("work_orders")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (data) setWorkOrders(data);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <MobileShell
      title="Work Orders"
      subtitle="Selecione para preencher"
      backHref={`/mobile/projetos/${projectId}`}
    >
      <div className="space-y-3">

        {workOrders.length === 0 && (
          <div className="text-center text-sm text-gray-500 mt-10">
            Nenhuma Work Order disponível
          </div>
        )}

        {workOrders.map((wo) => (
          <button
            key={wo.id}
            onClick={() =>
              router.push(`/mobile/projetos/${projectId}/work-orders/${wo.id}`)
            }
            className={`
              w-full text-left rounded-2xl p-4 shadow-sm transition
              border active:scale-[0.98]

              ${wo.finalized
                ? "bg-gray-100 border-gray-200"
                : "bg-white border-[var(--green)]"}
            `}
          >
            <div className="flex justify-between items-center">

              <div>
                <p className="font-semibold text-[15px]">
                  {wo.title}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Toque para abrir
                </p>
              </div>

              <div
                className={`
                  px-3 py-1 rounded-full text-xs font-bold
                  ${wo.finalized
                    ? "bg-gray-300 text-gray-700"
                    : "bg-[var(--green)] text-white"}
                `}
              >
                {wo.finalized ? "Finalizada" : "Pendente"}
              </div>

            </div>
          </button>
        ))}

      </div>
    </MobileShell>
  );
}
