"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../../components/layout/AdminShell";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { isMobileDevice } from "../../../lib/isMobile";

type WorkOrder = {
  id: string;
  title: string;
  finalized: boolean;
};

type Perfil = {
  id: string;
  nome_sondagem: string;
  created_at: string;
};

export default function ProjetoPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobileDevice());
    load();
  }, []);

  async function load() {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (wo) setWorkOrders(wo);

    const { data: sd } = await supabase
      .from("soil_descriptions")
      .select("id, nome_sondagem, created_at")
      .eq("project_id", projectId)
      .eq("finalized", true)
      .order("created_at", { ascending: false });

    if (sd) setPerfis(sd);

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
    const ok = confirm(`Excluir a Work Order "${title}"?`);
    if (!ok) return;

    await supabase.from("work_orders").delete().eq("id", id);
    load();
  }

  async function deletePerfil(id: string, nome: string) {
    const ok = confirm(`Excluir o perfil "${nome}" permanentemente?`);
    if (!ok) return;

    await supabase.from("soil_descriptions").delete().eq("id", id);
    load();
  }

  return (
    <AdminShell>
      <div className="space-y-8">

        {/* WORK ORDERS */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Work Orders</h1>

            {!mobile && (
              <Button onClick={createWorkOrder} className="bg-primary text-white">
                Nova Work Order
              </Button>
            )}
          </div>

          <div className="bg-secondary rounded-2xl p-6 shadow-inner">
            {loading ? (
              <p className="text-white/80">Carregando...</p>
            ) : workOrders.length === 0 ? (
              <p className="text-white/70">Nenhuma Work Order criada.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workOrders.map((wo) => (
                  <div key={wo.id} className="relative">

                    {!mobile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteWorkOrder(wo.id, wo.title);
                        }}
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold shadow hover:bg-red-700 z-10"
                      >
                        ✕
                      </button>
                    )}

                    <Card
                      onClick={() => router.push(`/work-orders/${wo.id}`)}
                      className="cursor-pointer bg-primary text-white border-0 hover:scale-[1.02] transition shadow"
                    >
                      <CardContent className="p-6">
                        <p className="font-semibold">{wo.title}</p>
                        <p className="text-sm opacity-80">
                          {wo.finalized ? "Finalizada" : "Em andamento"}
                        </p>
                      </CardContent>
                    </Card>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PERFIS DESCRITIVOS */}
        <div className="space-y-4">

          <h2 className="text-2xl font-bold">Perfis descritivos</h2>

          <div className="bg-secondary rounded-2xl p-6 shadow-inner">

            {perfis.length === 0 ? (
              <p className="text-white/70">Nenhum perfil gerado pelo aplicativo.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {perfis.map((p) => (
                  <div key={p.id} className="relative">

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePerfil(p.id, p.nome_sondagem);
                      }}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold shadow hover:bg-red-700 z-10"
                    >
                      ✕
                    </button>

                    {/* ROTA CORRIGIDA */}
                    <Card
                      onClick={() => router.push(`/projetos/${projectId}/solo/${p.id}`)}
                      className="cursor-pointer bg-primary text-white border-0 hover:scale-[1.02] transition shadow"
                    >
                      <CardContent className="p-6 space-y-1">
                        <p className="font-semibold">{p.nome_sondagem}</p>
                        <p className="text-sm opacity-80">
                          {new Date(p.created_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>

                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>
    </AdminShell>
  );
}
