"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";

// ================= ÍCONES =================
const Icons = {
  Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Droplet: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Eye: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
};

type Sampling = {
  id: string;
  poco: string;
  nomenclatura: string;
  identificacao_codigo: string;
  data: string;
  hora_inicio: string;
  fase_livre: boolean;
  leituras: any[];
};

export default function FisicoQuimicosDesktopPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("Carregando...");
  const [groupedData, setGroupedData] = useState<{ [key: string]: Sampling[] }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    // 1. Busca o nome do projeto
    const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single();
    if (proj) setProjectName(proj.name);

    // 2. Busca todas as amostragens finalizadas deste projeto
    const { data: samplings } = await supabase
      .from("water_samplings")
      .select("*")
      .eq("project_id", projectId)
      .eq("finalized", true)
      .order("data", { ascending: false });

    if (samplings) {
      // 3. MÁGICA: Agrupar as amostragens pela data (YYYY-MM-DD)
      const grouped = samplings.reduce((acc: any, curr: Sampling) => {
        const dateKey = curr.data;
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(curr);
        return acc;
      }, {});
      
      setGroupedData(grouped);
    }
    setLoading(false);
  }

  // Helper para formatar a data (Ex: 2026-03-23 -> 23/03/2026)
  function formatDateBr(dateString: string) {
    if (!dateString) return "Sem Data";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }

  if (loading) return <AdminShell><p className="p-10 text-gray-500 font-bold">Carregando compilados...</p></AdminShell>;

  const datasAgrupadas = Object.keys(groupedData).sort((a, b) => b.localeCompare(a)); // Ordena da mais recente pra mais antiga

  return (
    <AdminShell>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* ================= HEADER DA PÁGINA ================= */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-[#391e2a] px-10 py-8 text-white flex justify-between items-center shadow-inner">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Compilado de Físico-Químicos</h1>
              <p className="text-[#80b02d] font-bold mt-2 tracking-widest uppercase text-xs">
                Projeto: {projectName}
              </p>
            </div>
            <div className="bg-white/10 px-5 py-3 rounded-2xl border border-white/20 backdrop-blur-sm text-center">
              <p className="text-3xl font-black">{datasAgrupadas.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mt-1">Dias de Campanha</p>
            </div>
          </div>
        </div>

        {/* ================= LISTA DE CARDS COMPILADOS POR DATA ================= */}
        {datasAgrupadas.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Icons.Droplet />
            </div>
            <h3 className="text-lg font-bold text-gray-700">Nenhuma amostragem recebida</h3>
            <p className="text-gray-500 mt-2">As fichas preenchidas no aplicativo aparecerão compiladas aqui.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {datasAgrupadas.map((dataCampanha) => {
              const amostrasDoDia = groupedData[dataCampanha];

              return (
                <div key={dataCampanha} className="bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden group hover:shadow-lg transition-all duration-300">
                  
                  {/* CABEÇALHO DO CARD (DATA) */}
                  <div className="bg-gray-50 border-b border-gray-200 px-8 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#80b02d]/10 text-[#80b02d] rounded-2xl flex items-center justify-center">
                        <Icons.Calendar />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-[#391e2a]">Campanha do dia {formatDateBr(dataCampanha)}</h2>
                        <p className="text-sm font-semibold text-gray-500 mt-0.5">
                          {amostrasDoDia.length} {amostrasDoDia.length === 1 ? "poço amostrado" : "poços amostrados"}
                        </p>
                      </div>
                    </div>

                    <Button className="bg-[#391e2a] hover:bg-[#2a161f] text-white font-bold rounded-xl h-11 px-6 shadow-sm hidden md:flex items-center gap-2">
                      <Icons.Download /> Baixar Planilha Geral
                    </Button>
                  </div>

                  {/* TABELA COMPILADA DO DIA */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                        <tr>
                          <th className="px-8 py-4">Poço</th>
                          <th className="px-6 py-4">Amostra (Código)</th>
                          <th className="px-6 py-4">Início</th>
                          <th className="px-6 py-4">Fase Livre</th>
                          <th className="px-6 py-4">Qtd. Leituras</th>
                          <th className="px-8 py-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {amostrasDoDia.map((amostra) => (
                          <tr key={amostra.id} className="hover:bg-gray-50/50 transition-colors group/row">
                            <td className="px-8 py-4 font-bold text-[#391e2a]">
                              {amostra.poco}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-800">{amostra.nomenclatura || "-"}</span>
                                <span className="text-xs text-gray-400">{amostra.identificacao_codigo || "-"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-600">
                              {amostra.hora_inicio || "-"}
                            </td>
                            <td className="px-6 py-4">
                              {amostra.fase_livre ? (
                                <span className="bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-md text-xs">Sim</span>
                              ) : (
                                <span className="bg-gray-100 text-gray-600 font-bold px-2.5 py-1 rounded-md text-xs">Não</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-[#80b02d]/10 text-[#80b02d] font-bold px-3 py-1 rounded-full text-xs">
                                {amostra.leituras?.length || 0} leituras
                              </span>
                            </td>
                            <td className="px-8 py-4 text-right">
                              <button 
                                onClick={() => router.push(`/projetos/${projectId}/fisico-quimicos/${amostra.id}`)}
                                className="text-[#80b02d] hover:text-white hover:bg-[#80b02d] font-bold px-4 py-2 rounded-lg transition-all text-xs flex items-center gap-2 ml-auto opacity-0 group-hover/row:opacity-100"
                              >
                                <Icons.Eye /> Ver Ficha
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </AdminShell>
  );
}