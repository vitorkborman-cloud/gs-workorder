"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../../lib/supabase";
import MobileShell from "../../../../../../components/layout/MobileShell";
import { useToast } from "../../../../../../components/Toast";

const Icons = {
  Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Save: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
  Droplet: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  Activity: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Loader: () => <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
};

type Reading = { horario: string; na: string; ph: string; orp: string; od: string; condutividade: string; };

const emptyReading: Reading = { horario: "", na: "", ph: "", orp: "", od: "", condutividade: "" };

export default function AmostragemFormPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const amostraId = params.amostraId as string;
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalized, setFinalized] = useState(false);

  const [readings, setReadings] = useState<Reading[]>([emptyReading]);
  const [form, setForm] = useState({
    poco: "", nomenclatura: "", identificacao_codigo: "", data: "",
    hora_inicio: "", na_inicial: "", na_final: "", fase_livre: false, espessura_fl: "",
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("water_samplings").select("*").eq("id", amostraId).single();
    if (data) {
      setFinalized(data.finalized);
      setForm({
        poco: data.poco ?? "", nomenclatura: data.nomenclatura ?? "",
        identificacao_codigo: data.identificacao_codigo ?? "", data: data.data ?? "",
        hora_inicio: data.hora_inicio ?? "", na_inicial: data.na_inicial ?? "",
        na_final: data.na_final ?? "", fase_livre: data.fase_livre ?? false, espessura_fl: data.espessura_fl ?? "",
      });
      if (data.leituras?.length > 0) setReadings(data.leituras);
    }
    setLoading(false);
  }

  function setField(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function salvar() {
    setSaving(true);
    try {
      await supabase.from("water_samplings").update({ ...form, leituras: readings }).eq("id", amostraId);
      showToast("Rascunho salvo com sucesso!");
    } catch {
      showToast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function concluir() {
    if (!form.poco || !form.data) { showToast("Preencha o poço e a data antes de concluir.", "error"); return; }
    if (!confirm("Finalizar amostragem?")) return;
    setSaving(true);
    try {
      await supabase.from("water_samplings").update({ ...form, leituras: readings, finalized: true }).eq("id", amostraId);
      showToast("Amostragem finalizada!");
      router.push(`/mobile/projetos/${projectId}/fisico-quimicos`);
    } catch {
      showToast("Erro ao finalizar.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <MobileShell title="Carregando..." backHref={`/mobile/projetos/${projectId}/fisico-quimicos`}>
      <div className="p-10 text-center text-gray-400 animate-pulse">Carregando dados...</div>
    </MobileShell>
  );

  return (
    <MobileShell
      title={form.poco || "Nova Amostragem"}
      subtitle="Amostragem de Água Subterrânea"
      backHref={`/mobile/projetos/${projectId}/fisico-quimicos`}
    >
      <div className="min-h-screen bg-gray-50 pb-28 -m-4 p-4">
        <div className="py-2 space-y-6 max-w-4xl mx-auto">

          {finalized && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-center text-sm text-green-700 font-semibold">
              ✓ Esta amostragem foi concluída e está somente leitura.
            </div>
          )}

          <Section title="Dados Gerais" icon={<Icons.Droplet />}>
            <div className="space-y-4">
              <Input label="Identificação do Poço *" value={form.poco} onChange={(v: string) => setField("poco", v)} placeholder="Ex: PM-01" disabled={finalized} />
              <Input label="Nomenclatura" value={form.nomenclatura} onChange={(v: string) => setField("nomenclatura", v)} placeholder="Ex: GS001-13" disabled={finalized} />
              <Input label="Identificação (código)" value={form.identificacao_codigo} onChange={(v: string) => setField("identificacao_codigo", v)} placeholder="Código do frasco" disabled={finalized} />
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="Data" value={form.data} type="date" onChange={(v: string) => setField("data", v)} disabled={finalized} />
                <Input label="Hora de Início" value={form.hora_inicio} type="time" onChange={(v: string) => setField("hora_inicio", v)} disabled={finalized} />
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="NA Inicial (m)" value={form.na_inicial} type="number" onChange={(v: string) => setField("na_inicial", v)} placeholder="0.00" disabled={finalized} />
                <Input label="NA Final (m)" value={form.na_final} type="number" onChange={(v: string) => setField("na_final", v)} placeholder="0.00" disabled={finalized} />
              </div>
            </div>
          </Section>

          <Section title="Detecção de Fase Livre" icon={<Icons.Activity />}>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50">
              <span className="text-sm font-bold text-[#391e2a] pr-4 leading-tight">Presença de Fase Livre identificada?</span>
              <button
                type="button"
                disabled={finalized}
                onClick={() => { setField("fase_livre", !form.fase_livre); if (form.fase_livre) setField("espessura_fl", ""); }}
                className={`shrink-0 relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${form.fase_livre ? "bg-[#80b02d]" : "bg-gray-300"} disabled:opacity-50`}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${form.fase_livre ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
            {form.fase_livre && (
              <Input label="Espessura da Fase Livre (m)" value={form.espessura_fl} type="number" onChange={(v: string) => setField("espessura_fl", v)} placeholder="Ex: 0.15" disabled={finalized} />
            )}
          </Section>

          <Section title={`Leituras Físico-Químicas (${readings.length})`} icon={<Icons.Activity />}>
            <div className="space-y-5">
              {readings.map((reading, i) => (
                <div key={i} className="relative bg-white border-2 border-gray-100 p-4 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <span className="bg-[#391e2a]/5 text-[#391e2a] text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-md">Leitura {i + 1}</span>
                    {!finalized && readings.length > 1 && (
                      <button onClick={() => setReadings((prev) => prev.filter((_, idx) => idx !== i))} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white w-7 h-7 rounded-full flex items-center justify-center transition-colors">
                        <Icons.Trash />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <Input label="Horário" type="time" value={reading.horario} onChange={(v: string) => { const r = [...readings]; r[i].horario = v; setReadings(r); }} disabled={finalized} />
                    <Input label="NA (m)" type="number" value={reading.na} placeholder="0.00" onChange={(v: string) => { const r = [...readings]; r[i].na = v; setReadings(r); }} disabled={finalized} />
                    <Input label="pH" type="number" value={reading.ph} placeholder="0.0" onChange={(v: string) => { const r = [...readings]; r[i].ph = v; setReadings(r); }} disabled={finalized} />
                    <Input label="ORP (mV)" type="number" value={reading.orp} placeholder="0" onChange={(v: string) => { const r = [...readings]; r[i].orp = v; setReadings(r); }} disabled={finalized} />
                    <Input label="OD (mg/L)" type="number" value={reading.od} placeholder="0.00" onChange={(v: string) => { const r = [...readings]; r[i].od = v; setReadings(r); }} disabled={finalized} />
                    <Input label="Cond. (µS/cm)" type="number" value={reading.condutividade} placeholder="0" onChange={(v: string) => { const r = [...readings]; r[i].condutividade = v; setReadings(r); }} disabled={finalized} />
                  </div>
                </div>
              ))}
            </div>
            {!finalized && (
              <button onClick={() => setReadings((prev) => [...prev, emptyReading])} className="w-full mt-4 bg-white text-[#391e2a] py-3.5 rounded-xl border-2 border-gray-200 border-dashed text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition">
                <Icons.Plus /> Adicionar Leitura
              </button>
            )}
          </Section>

        </div>

        {!finalized && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md p-4 border-t shadow-[0_-10px_40px_rgba(0,0,0,0.08)] flex gap-3 z-40">
            <div className="max-w-4xl mx-auto w-full flex gap-3">
              <button onClick={salvar} disabled={saving} className="flex-1 bg-white border-2 border-[#391e2a] text-[#391e2a] font-bold py-3.5 rounded-xl text-sm disabled:opacity-50 active:scale-95 transition flex items-center justify-center gap-2">
                {saving ? <Icons.Loader /> : <Icons.Save />} Rascunho
              </button>
              <button onClick={concluir} disabled={saving} className="flex-1 bg-[#80b02d] text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-80 active:scale-95 transition flex items-center justify-center gap-2">
                {saving ? <Icons.Loader /> : <Icons.Check />} Concluir e Enviar
              </button>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}

function Section({ title, icon, children }: any) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-5 space-y-5">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
        {icon && <div className="bg-[#391e2a]/5 text-[#391e2a] p-2.5 rounded-xl">{icon}</div>}
        <h2 className="text-xs font-extrabold text-[#391e2a] uppercase tracking-wider">{title}</h2>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "", disabled = false }: any) {
  return (
    <div className="flex flex-col justify-end gap-1.5 w-full h-full">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight">{label}</label>
      <input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 border border-gray-200 rounded-xl px-4 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#80b02d]/30 focus:border-[#80b02d] transition-all disabled:opacity-60" />
    </div>
  );
}
