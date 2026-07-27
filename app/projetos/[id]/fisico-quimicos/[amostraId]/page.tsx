"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { buildWaterSamplingPdf } from "@/lib/pdf/water-sampling";

// ================= ÍCONES =================
const Icons = {
  ArrowLeft: () => <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Download: () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Edit: () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Save: () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
};

export default function FisicoQuimicosDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const amostraId = params.amostraId as string;

  const [amostra, setAmostra] = useState<any>(null);
  const [projectName, setProjectName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("water_samplings").select("*").eq("id", amostraId).single();
    if (data) setAmostra(data);
    const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single();
    if (proj) setProjectName(proj.name);
  }

  function formatDateBr(dateString: string) {
    if (!dateString) return "-";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }

  async function salvarAlteracoes() {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("water_samplings")
        .update({
          poco: amostra.poco,
          nomenclatura: amostra.nomenclatura,
          identificacao_codigo: amostra.identificacao_codigo,
          data: amostra.data,
          hora_inicio: amostra.hora_inicio,
          na_inicial: amostra.na_inicial,
          na_final: amostra.na_final,
          fase_livre: amostra.fase_livre,
          espessura_fl: amostra.espessura_fl,
          leituras: amostra.leituras
        })
        .eq("id", amostraId);

      if (error) throw error;
      setIsEditing(false);
      alert("Ficha atualizada com sucesso!");
    } catch (e) {
      alert("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  // ================= GERAÇÃO DO PDF =================
  async function gerarPDF() {
    if (!amostra) return;
    const doc = await buildWaterSamplingPdf({ amostra, projectName });
    doc.save(`Ficha_FQ_${amostra.poco}_${amostra.data}.pdf`);
  }

  if (!amostra) return <AdminShell><p className="p-10 font-bold text-gray-500">Carregando ficha...</p></AdminShell>;

  return (
    <AdminShell>
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        
        {/* BOTÃO VOLTAR */}
        <button onClick={() => router.back()} className="text-gray-500 hover:text-[#80b02d] font-bold text-sm flex items-center transition-colors">
          <Icons.ArrowLeft /> Voltar para Compilados
        </button>

        {/* HEADER DA PÁGINA */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-[#391e2a] px-8 py-6 text-white flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-inner">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Ficha Físico-Química</h1>
              <p className="text-[#80b02d] font-semibold mt-1 uppercase tracking-wider text-xs">
                POÇO {amostra.poco} • {formatDateBr(amostra.data)}
              </p>
            </div>
            <div className="flex gap-3">
              {isEditing ? (
                <Button onClick={salvarAlteracoes} disabled={isSaving} className="bg-white text-[#391e2a] hover:bg-gray-100 font-bold shadow-sm">
                  {isSaving ? "Salvando..." : <><Icons.Save /> Salvar Edição</>}
                </Button>
              ) : (
                <Button onClick={() => setIsEditing(true)} className="bg-transparent border border-white/30 hover:bg-white/10 text-white font-bold shadow-sm">
                  <Icons.Edit /> Editar Ficha
                </Button>
              )}
              <Button onClick={gerarPDF} className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold shadow-lg">
                <Icons.Download /> Gerar Laudo PDF
              </Button>
            </div>
          </div>

          <div className="p-8 space-y-8 bg-gray-50/50">
            
            {/* SEÇÃO 1: DADOS GERAIS */}
            <div>
              <h3 className="text-sm font-extrabold text-[#391e2a] uppercase tracking-wider mb-4 border-b-2 border-gray-200 pb-2">Identificação e Dados Gerais</h3>
              <div className="grid grid-cols-3 gap-4">
                <InputView label="Poço" value={amostra.poco} isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, poco: v})} />
                <InputView label="Nomenclatura" value={amostra.nomenclatura} isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, nomenclatura: v})} />
                <InputView label="Código (Amostra)" value={amostra.identificacao_codigo} isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, identificacao_codigo: v})} />
                <InputView label="Data" value={amostra.data} type="date" isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, data: v})} />
                <InputView label="Hora Início" value={amostra.hora_inicio} type="time" isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, hora_inicio: v})} />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <InputView label="Nível D'água Inicial (m)" value={amostra.na_inicial} type="number" isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, na_inicial: v})} />
                <InputView label="Nível D'água Final (m)" value={amostra.na_final} type="number" isEditing={isEditing} onChange={(v: string) => setAmostra({...amostra, na_final: v})} />
              </div>
            </div>

            {/* SEÇÃO 2: FASE LIVRE */}
            <div className={`p-5 rounded-2xl border ${amostra.fase_livre ? 'bg-red-50 border-red-100' : 'bg-gray-100 border-gray-200'}`}>
              <h3 className={`text-sm font-extrabold uppercase tracking-wider mb-3 ${amostra.fase_livre ? 'text-red-700' : 'text-gray-500'}`}>
                Detecção de Fase Livre
              </h3>
              {isEditing ? (
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 font-bold text-sm">
                    <input type="checkbox" checked={amostra.fase_livre} onChange={(e) => setAmostra({...amostra, fase_livre: e.target.checked})} className="w-5 h-5 rounded text-[#80b02d]" />
                    Sim, Fase Livre detectada
                  </label>
                  {amostra.fase_livre && (
                    <input type="number" value={amostra.espessura_fl || ""} onChange={(e) => setAmostra({...amostra, espessura_fl: e.target.value})} placeholder="Espessura (m)" className="border p-2 rounded text-sm outline-none focus:border-[#80b02d]" />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 font-bold text-lg">
                  {amostra.fase_livre ? <span className="text-red-600">⚠️ SIM (Espessura: {amostra.espessura_fl}m)</span> : <span className="text-gray-600">NÃO DETECTADA</span>}
                </div>
              )}
            </div>

            {/* SEÇÃO 3: LEITURAS (TABELA) */}
            <div>
              <h3 className="text-sm font-extrabold text-[#391e2a] uppercase tracking-wider mb-4 border-b-2 border-gray-200 pb-2">Leituras de Purga ({amostra.leituras?.length || 0})</h3>
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#391e2a]/5 font-bold text-[#391e2a] text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-center">Nº</th>
                      <th className="px-4 py-3">Horário</th>
                      <th className="px-4 py-3">NA (m)</th>
                      <th className="px-4 py-3">pH</th>
                      <th className="px-4 py-3">ORP (mV)</th>
                      <th className="px-4 py-3">OD (mg/L)</th>
                      <th className="px-4 py-3">Cond. (µS/cm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {amostra.leituras?.map((leit: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-center font-bold text-gray-400">{idx + 1}</td>
                        {isEditing ? (
                          <>
                            <td className="px-2 py-2"><input type="time" value={leit.horario} onChange={(e) => { const n = [...amostra.leituras]; n[idx].horario = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                            <td className="px-2 py-2"><input type="number" value={leit.na} onChange={(e) => { const n = [...amostra.leituras]; n[idx].na = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                            <td className="px-2 py-2"><input type="number" value={leit.ph} onChange={(e) => { const n = [...amostra.leituras]; n[idx].ph = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                            <td className="px-2 py-2"><input type="number" value={leit.orp} onChange={(e) => { const n = [...amostra.leituras]; n[idx].orp = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                            <td className="px-2 py-2"><input type="number" value={leit.od} onChange={(e) => { const n = [...amostra.leituras]; n[idx].od = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                            <td className="px-2 py-2"><input type="number" value={leit.condutividade} onChange={(e) => { const n = [...amostra.leituras]; n[idx].condutividade = e.target.value; setAmostra({...amostra, leituras: n})}} className="w-full border rounded p-1 text-sm outline-none focus:border-[#80b02d]"/></td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-semibold text-gray-700">{leit.horario || "-"}</td>
                            <td className="px-4 py-3">{leit.na || "-"}</td>
                            <td className="px-4 py-3 font-semibold text-[#80b02d]">{leit.ph || "-"}</td>
                            <td className="px-4 py-3">{leit.orp || "-"}</td>
                            <td className="px-4 py-3 text-blue-600 font-semibold">{leit.od || "-"}</td>
                            <td className="px-4 py-3">{leit.condutividade || "-"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// === COMPONENTE AUXILIAR PARA INPUT / VIEW ===
function InputView({ label, value, isEditing, onChange, type = "text" }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</label>
      {isEditing ? (
        <input 
          type={type} 
          value={value || ""} 
          onChange={(e) => onChange(e.target.value)} 
          className="border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-[#80b02d]/50 focus:border-[#80b02d] transition-all bg-white" 
        />
      ) : (
        <div className="font-semibold text-gray-800 text-sm py-1">{value || "-"}</div>
      )}
    </div>
  );
}