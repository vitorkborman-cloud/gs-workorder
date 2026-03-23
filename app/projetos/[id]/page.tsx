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

type RDO = {
  id: string;
  data: string;
  created_at: string;
};

type CampanhaFQ = {
  data: string;
  quantidade: number;
};

export default function ProjetoPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [rdos, setRdos] = useState<RDO[]>([]);
  const [campanhasFQ, setCampanhasFQ] = useState<CampanhaFQ[]>([]); // NOVO ESTADO
  const [loading, setLoading] = useState(true);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobileDevice());
    load();
  }, []);

  async function load() {
    // 1. Work Orders
    const { data: wo } = await supabase
      .from("work_orders")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (wo) setWorkOrders(wo);

    // 2. Perfis
    const { data: sd } = await supabase
      .from("soil_descriptions")
      .select("id, nome_sondagem, created_at")
      .eq("project_id", projectId)
      .eq("finalized", true)
      .order("created_at", { ascending: false });
    if (sd) setPerfis(sd);

    // 3. RDOs
    const { data: rdoData } = await supabase
      .from("rdo_reports")
      .select("id, data, created_at")
      .eq("project_id", projectId)
      .eq("draft", false)
      .order("created_at", { ascending: false });
    if (rdoData) setRdos(rdoData);

    // 4. Físico-Químicos (NOVO)
    const { data: fqData } = await supabase
      .from("water_samplings")
      .select("id, data")
      .eq("project_id", projectId)
      .eq("finalized", true);

    if (fqData) {
      // Agrupa as fichas contando quantas ocorreram no mesmo dia
      const grouped = fqData.reduce((acc: any, curr: any) => {
        acc[curr.data] = (acc[curr.data] || 0) + 1;
        return acc;
      }, {});

      // Transforma o objeto agrupado em um array e ordena da data mais recente pra mais antiga
      const formatadas = Object.keys(grouped).map(date => ({
        data: date,
        quantidade: grouped[date]
      })).sort((a, b) => b.data.localeCompare(a.data));

      setCampanhasFQ(formatadas);
    }

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

  async function deleteRDO(id: string, dataRdo: string) {
    const ok = confirm(`Excluir o relatório do dia ${dataRdo} permanentemente?`);
    if (!ok) return;
    await supabase.from("rdo_reports").delete().eq("id", id);
    load();
  }

  // Função auxiliar para formatar a data visualmente
  function formatDateBr(dateString: string) {
    if (!dateString) return "Sem Data";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }

  return (
    <AdminShell>
      <div className="space-y-10">

        {/* ================= WORK ORDERS ================= */}
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Work Orders
              </h1>
              <p className="text-sm text-gray-500">
                Registros de visitas e atividades de campo
              </p>
            </div>

            {!mobile && (
              <Button
                onClick={createWorkOrder}
                className="bg-gradient-to-r from-[#391e2a] to-[#80b02d] text-white shadow-lg"
              >
                Nova Work Order
              </Button>
            )}
          </div>

          <div className="bg-secondary rounded-3xl p-8 shadow-inner">
            {loading ? (
              <p className="text-white/80">Carregando...</p>
            ) : workOrders.length === 0 ? (
              <p className="text-white/70">Nenhum Work Order criado.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {workOrders.map((wo) => (
                  <div key={wo.id} className="relative group">
                    {!mobile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteWorkOrder(wo.id, wo.title);
                        }}
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold shadow hover:bg-red-700 opacity-0 group-hover:opacity-100 transition z-10"
                      >
                        ✕
                      </button>
                    )}

                    <Card
                      onClick={() => router.push(`/work-orders/${wo.id}`)}
                      className="cursor-pointer border-0 bg-gradient-to-br from-[#80b02d] to-[#5e8420] text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition rounded-2xl"
                    >
                      <CardContent className="p-6 space-y-2">
                        <p className="font-semibold text-lg">
                          {wo.title}
                        </p>
                        <p className="text-sm opacity-90">
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

        {/* ================= FÍSICO-QUÍMICOS (NOVO) ================= */}
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Físico-Químicos
            </h2>
            <p className="text-sm text-gray-500">
              Amostragens de água subterrânea (Agrupadas por dia de campanha)
            </p>
          </div>

          <div className="bg-secondary rounded-3xl p-8 shadow-inner">
            {campanhasFQ.length === 0 ? (
              <p className="text-white/70">
                Nenhuma amostragem de físico-químicos recebida.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {campanhasFQ.map((campanha) => (
                  <div key={campanha.data} className="relative group">
                    <Card
                      onClick={() =>
                        router.push(`/projetos/${projectId}/fisico-quimicos`)
                      }
                      className="cursor-pointer border-0 bg-gradient-to-br from-[#2f7ea1] to-[#1f5c78] text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition rounded-2xl"
                    >
                      <CardContent className="p-6 space-y-2">
                        <p className="font-semibold text-lg">
                          Campanha FQ
                        </p>
                        <p className="text-sm opacity-90 font-medium">
                          {formatDateBr(campanha.data)}
                        </p>
                        <div className="mt-4 inline-block bg-white/20 px-3 py-1 rounded-lg text-xs font-bold">
                          {campanha.quantidade} {campanha.quantidade === 1 ? "poço amostrado" : "poços amostrados"}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ================= PERFIS DESCRITIVOS ================= */}
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Perfis descritivos
            </h2>
            <p className="text-sm text-gray-500">
              Perfis estratigráficos gerados pelo aplicativo
            </p>
          </div>

          <div className="bg-secondary rounded-3xl p-8 shadow-inner">
            {perfis.length === 0 ? (
              <p className="text-white/70">
                Nenhum perfil gerado pelo aplicativo.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {perfis.map((p) => (
                  <div key={p.id} className="relative group">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePerfil(p.id, p.nome_sondagem);
                      }}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold shadow hover:bg-red-700 opacity-0 group-hover:opacity-100 transition z-10"
                    >
                      ✕
                    </button>

                    <Card
                      onClick={() =>
                        router.push(`/projetos/${projectId}/solo/${p.id}`)
                      }
                      className="cursor-pointer border-0 bg-gradient-to-br from-[#391e2a] to-[#2a1420] text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition rounded-2xl"
                    >
                      <CardContent className="p-6 space-y-2">
                        <p className="font-semibold text-lg">
                          {p.nome_sondagem}
                        </p>
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

        {/* ================= RELATÓRIOS DIÁRIOS (RDO) ================= */}
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Relatórios diários
            </h2>
            <p className="text-sm text-gray-500">
              Relatórios enviados pelo aplicativo de campo
            </p>
          </div>

          <div className="bg-secondary rounded-3xl p-8 shadow-inner">
            {rdos.length === 0 ? (
              <p className="text-white/70">
                Nenhum relatório finalizado.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {rdos.map((r) => (
                  <div key={r.id} className="relative group">
                    {!mobile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRDO(r.id, r.data || "Sem data");
                        }}
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold shadow hover:bg-red-700 opacity-0 group-hover:opacity-100 transition z-10"
                      >
                        ✕
                      </button>
                    )}

                    <Card
                      onClick={() =>
                        router.push(`/projetos/${projectId}/rdo/${r.id}`)
                      }
                      className="cursor-pointer border-0 bg-gradient-to-br from-[#80b02d] to-[#5e8420] text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition rounded-2xl"
                    >
                      <CardContent className="p-6 space-y-2">
                        <p className="font-semibold text-lg">
                          RDO - {r.data || "Sem data"}
                        </p>
                        <p className="text-sm opacity-80">
                          {new Date(r.created_at).toLocaleDateString()}
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