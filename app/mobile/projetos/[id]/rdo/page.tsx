"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MobileShell from "@/components/layout/MobileShell";
import { RdoStatusBadge } from "@/components/rdo/RdoStatusBadge";

type RdoListItem = {
  id: string;
  data: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
};

function formatDateBr(d: string | null) {
  if (!d) return "Sem data";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function MobileRdoList() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [rdos, setRdos] = useState<RdoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("rdo_reports")
      .select("id, data, status, scheduled_date, created_at, draft")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (data) {
      // Compatibilidade: registros antigos podem não ter `status` preenchido ainda.
      const normalized = data.map((r: any) => ({
        ...r,
        status: r.status || (r.draft ? "rascunho" : "finalizado"),
      }));
      setRdos(normalized.filter((r: any) => r.status !== "finalizado"));
    }
    setLoading(false);
  }

  async function novoRdo() {
    setCreating(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("rdo_reports")
        .insert({
          project_id: projectId,
          data: hoje,
          inicio: "",
          fim: "",
          clima: [
            { periodo: "Manhã", tempo: "", condicao: "", razao: "" },
            { periodo: "Tarde", tempo: "", condicao: "", razao: "" },
            { periodo: "Noite", tempo: "", condicao: "", razao: "" },
          ],
          envolvidos: [{ empresa: "Greensoil", colaboradores: "", funcao: "" }],
          atividades: [{ atividade: "", empresa: "", status: "", obs: "" }],
          sheq: { incidente: "Não", incidenteObs: "", vazamento: "Não", vazamentoObs: "" },
          comentarios: "",
          fotos: [],
          assinaturas: [{ empresa: "Greensoil" }],
          draft: true,
          status: "rascunho",
        })
        .select("id")
        .single();

      if (error) throw error;
      router.push(`/mobile/projetos/${projectId}/rdo/${data.id}`);
    } catch (err: any) {
      alert("Erro ao criar RDO: " + (err?.message ?? String(err)));
    } finally {
      setCreating(false);
    }
  }

  return (
    <MobileShell
      title="Relatório Diário de Obra"
      subtitle="Selecione para preencher"
      backHref={`/mobile/projetos/${projectId}`}
    >
      <div className="space-y-3">

        {loading && (
          <div className="text-center text-sm text-gray-500 mt-10">Carregando...</div>
        )}

        {!loading && rdos.length === 0 && (
          <div className="text-center text-sm text-gray-500 mt-10">
            Nenhum RDO pendente. Toque abaixo para começar um novo.
          </div>
        )}

        {rdos.map((rdo) => {
          const programado = rdo.status === "programado";
          return (
            <button
              key={rdo.id}
              onClick={() => router.push(`/mobile/projetos/${projectId}/rdo/${rdo.id}`)}
              className={`w-full text-left rounded-2xl p-4 shadow-sm transition border active:scale-[0.98] ${
                programado ? "bg-amber-50 border-amber-300" : "bg-white border-[var(--green)]"
              }`}
            >
              <div className="flex justify-between items-center gap-3">
                <div>
                  <p className="font-semibold text-[15px]">
                    RDO — {formatDateBr(rdo.scheduled_date || rdo.data)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {programado ? "Aguardando preenchimento em campo" : "Toque para continuar"}
                  </p>
                </div>
                <RdoStatusBadge status={rdo.status} />
              </div>
            </button>
          );
        })}

        <button
          onClick={novoRdo}
          disabled={creating}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-bold text-gray-500 hover:bg-gray-50 transition active:scale-[0.98] disabled:opacity-50"
        >
          {creating ? "Criando..." : "+ Novo RDO (sem programação prévia)"}
        </button>

      </div>
    </MobileShell>
  );
}
