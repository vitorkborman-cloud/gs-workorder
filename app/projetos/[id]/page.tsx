"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AppShell from "../../../components/AppShell";
import Card from "../../../components/Card";
import Button from "../../../components/Button";

type WorkOrder = {
  id: string;
  title: string;
  finalized: boolean;
};

export default function ProjetoPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("work_orders")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (data) setWorkOrders(data);
    setLoading(false);
  }

  async function createWorkOrder() {
    const title = prompt("Nome da Work Order:");
    if (!title) return;

    await supabase.from("work_orders").insert({
      title,
      project_id: projectId,
    });

    load();
  }

  async function deleteWorkOrder(id: string, title: string) {
    const ok = confirm(
      `Excluir a Work Order "${title}"?\nTodas as atividades serão removidas.`
    );
    if (!ok) return;

    await supabase.from("work_orders").delete().eq("id", id);
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Projeto</h1>

      <Card title="Work Orders">
        <div className="mb-4">
          <Button text="Criar Work Order" onClick={createWorkOrder} />
        </div>

        {loading ? (
          <p>Carregando...</p>
        ) : workOrders.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma Work Order criada.
          </p>
        ) : (
          <div className="space-y-3">
            {workOrders.map((wo) => (
              <div
                key={wo.id}
                className="flex justify-between items-center border rounded-xl p-3"
              >
                <span
                  className="font-bold cursor-pointer"
                  onClick={() =>
                    router.push(`/work-orders/${wo.id}`)
                  }
                >
                  {wo.title}
                </span>

                <button
                  onClick={() =>
                    deleteWorkOrder(wo.id, wo.title)
                  }
                  className="text-sm font-bold underline"
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
