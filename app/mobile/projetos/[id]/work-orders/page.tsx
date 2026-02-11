"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AppShell from "../../../../../components/AppShell";
import Card from "../../../../../components/Card";

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
    <AppShell>
      <h1 className="text-xl font-bold text-[var(--purple)] mb-4">
        Work Orders
      </h1>

      <div className="space-y-3">
        {workOrders.map((wo) => (
          <div
            key={wo.id}
            onClick={() =>
              router.push(
                `/mobile/projetos/${projectId}/work-orders/${wo.id}`
              )
            }
            className="cursor-pointer"
          >
            <Card title={wo.title}>
              <span
                className={`text-sm font-bold ${
                  wo.finalized ? "text-gray-500" : "text-green-600"
                }`}
              >
                {wo.finalized ? "Finalizada" : "Em andamento"}
              </span>
            </Card>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
