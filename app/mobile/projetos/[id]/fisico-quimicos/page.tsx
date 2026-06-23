"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import MobileShell from "../../../../../components/layout/MobileShell";

type Amostra = {
  id: string;
  poco: string;
  data: string;
  finalized: boolean;
  created_at: string;
};

export default function FisicoQuimicosListPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [records, setRecords] = useState<Amostra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("water_samplings")
      .select("id, poco, data, finalized, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (data) setRecords(data);
    setLoading(false);
  }

  async function createNew() {
    const { data, error } = await supabase
      .from("water_samplings")
      .insert({
        project_id: projectId,
        finalized: false,
        poco: "",
        nomenclatura: "",
        identificacao_codigo: "",
        data: "",
        hora_inicio: "",
        na_inicial: "",
        na_final: "",
        fase_livre: false,
        espessura_fl: "",
        leituras: [],
      })
      .select("id")
      .single();

    if (!error && data) {
      router.push(`/mobile/projetos/${projectId}/fisico-quimicos/${data.id}`);
    }
  }

  if (loading) {
    return (
      <MobileShell title="Físico-Químicos" backHref={`/mobile/projetos/${projectId}`}>
        <div className="p-10 text-center text-gray-400 animate-pulse">Carregando...</div>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title="Físico-Químicos"
      subtitle="Fichas de amostragem"
      backHref={`/mobile/projetos/${projectId}`}
    >
      <div className="space-y-3">
        {records.length === 0 && (
          <div className="text-center text-sm text-gray-400 mt-12 space-y-2">
            <div className="text-4xl">🧪</div>
            <p className="font-medium">Nenhuma amostragem registrada.</p>
          </div>
        )}

        {records.map((r) => (
          <button
            key={r.id}
            onClick={() => router.push(`/mobile/projetos/${projectId}/fisico-quimicos/${r.id}`)}
            className={`w-full text-left rounded-2xl p-4 shadow-sm border transition active:scale-[0.98] ${
              r.finalized ? "bg-gray-100 border-gray-200" : "bg-white border-[#2f7ea1]"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-[15px] text-[#391e2a]">
                  {r.poco || "Poço não identificado"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {r.data || "Data não preenchida"} · Toque para abrir
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ml-2 ${
                  r.finalized
                    ? "bg-gray-300 text-gray-700"
                    : "bg-[#2f7ea1] text-white"
                }`}
              >
                {r.finalized ? "Concluído" : "Rascunho"}
              </span>
            </div>
          </button>
        ))}

        <button
          onClick={createNew}
          className="w-full bg-white hover:bg-gray-50 text-[#391e2a] py-4 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition mt-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Nova Amostragem
        </button>
      </div>
    </MobileShell>
  );
}
