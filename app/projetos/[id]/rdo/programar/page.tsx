"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { STATUS_NAO_CONCLUIDO } from "@/lib/rdo/v2";

type Planejada = { atividade: string; responsaveis: string[] };

export default function ProgramarRdoPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("");
  const [equipe, setEquipe] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [atividades, setAtividades] = useState<Planejada[]>([{ atividade: "", responsaveis: [] }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("projects").select("name").eq("id", projectId).single()
      .then(({ data }) => { if (data) setProjectName(data.name); });
    supabase.from("rdo_equipe").select("nome").eq("project_id", projectId).eq("ativo", true).order("nome")
      .then(({ data }) => setEquipe((data || []).map((e: any) => e.nome)));
  }, [projectId]);

  const upd = (idx: number, patch: Partial<Planejada>) =>
    setAtividades((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));

  async function salvar() {
    if (!scheduledDate) { alert("Escolha a data planejada para o RDO."); return; }
    const validas = atividades.filter((a) => a.atividade.trim());

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from("rdo_reports").insert({
        project_id: projectId,
        formato: "v2",
        data: scheduledDate,
        inicio: "",
        fim: "",
        clima: [],
        envolvidos: [],
        atividades: validas.map((a) => ({
          atividade: a.atividade.trim(),
          responsaveis: a.responsaveis,
          status: STATUS_NAO_CONCLUIDO,
          obs: "",
          origem: "programada",
        })),
        sheq: { incidente: "Não", incidenteObs: "", vazamento: "Não", vazamentoObs: "" },
        comentarios: "",
        fotos: [],
        assinaturas: [],
        draft: true,
        status: "programado",
        scheduled_by: userData?.user?.id ?? null,
        scheduled_at: new Date().toISOString(),
        scheduled_date: scheduledDate,
      });

      if (error) throw error;
      router.push(`/projetos/${projectId}`);
    } catch (err: any) {
      alert("Erro ao programar RDO: " + (err?.message ?? String(err)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100">

          <div className="bg-[#391e2a] p-8 text-white">
            <h1 className="text-2xl font-bold tracking-tight">Programar RDO</h1>
            <p className="text-[#80b02d] font-semibold mt-1 uppercase tracking-wider text-xs">{projectName}</p>
          </div>

          <div className="p-8 space-y-8">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Data planejada</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-64 text-sm border p-2 rounded outline-none focus:ring-1 focus:ring-[#80b02d]"
              />
              <p className="text-xs text-gray-400 mt-1">
                O técnico verá este RDO como pendente de preenchimento no app mobile para essa data.
                As leituras e atividades fixas do projeto entram automaticamente.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#391e2a] uppercase tracking-wider mb-4 border-b border-[#80b02d] inline-block pb-1">
                Atividades Planejadas
              </h3>
              <div className="space-y-3">
                {atividades.map((a, idx) => (
                  <div key={idx} className="bg-white p-3 border rounded-md shadow-sm space-y-2">
                    <div className="flex gap-3 items-center">
                      <input
                        type="text"
                        value={a.atividade}
                        onChange={(e) => upd(idx, { atividade: e.target.value })}
                        className="flex-1 text-sm border p-2 rounded focus:ring-1 focus:ring-[#80b02d] outline-none"
                        placeholder="Atividade planejada"
                      />
                      <button onClick={() => setAtividades(atividades.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded">✕</button>
                    </div>
                    {equipe.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {equipe.map((n) => {
                          const on = a.responsaveis.includes(n);
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => upd(idx, { responsaveis: on ? a.responsaveis.filter((x) => x !== n) : [...a.responsaveis, n] })}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${on ? "bg-[#391e2a] text-white border-[#391e2a]" : "bg-white text-gray-500 border-gray-200"}`}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setAtividades([...atividades, { atividade: "", responsaveis: [] }])}
                  className="text-xs font-bold text-[#80b02d] hover:text-[#6a9425] mt-2"
                >
                  + ADICIONAR ATIVIDADE
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
              <Button
                onClick={() => router.back()}
                className="bg-transparent border border-gray-300 text-gray-600 hover:bg-gray-50 h-11 px-5 font-bold"
              >
                Cancelar
              </Button>
              <Button
                onClick={salvar}
                disabled={saving}
                className="bg-[#80b02d] hover:bg-[#6a9425] text-white h-11 px-6 font-bold shadow-lg"
              >
                {saving ? "PROGRAMANDO..." : "PROGRAMAR RDO"}
              </Button>
            </div>
          </div>

        </div>
      </div>
    </AdminShell>
  );
}
