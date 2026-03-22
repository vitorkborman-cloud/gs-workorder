"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AppShell from "../../../../../components/AppShell";

// ================= ÍCONES PREMIUM =================
const Icons = {
  Clipboard: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  Ruler: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>,
  MapPin: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  LayersIcon: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
  Save: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
  Loader: () => <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
};

// ================= TYPES =================
type Layer = {
  de: string;
  ate: string;
  tipo: string;
  leitura_voc: string;
  coloracao: string;
};

type FormData = {
  nome_sondagem: string;
  data: string;
  hora: string;
  nivel_agua: string;
  tipo_sondagem: string;
  diametro_sondagem: string;
  diametro_poco: string;
  pre_filtro: string;
  secao_filtrante_base: string;
  secao_filtrante_topo: string;
  coord_x: string;
  coord_y: string;
  profundidade_total: string;
};

const tiposSolo = [
  "Areia",
  "Areia de granulação variada argilosa",
  "Areia de granulação variada pouco argilosa",
  "Areia de granulação variada pouco siltosa",
  "Areia de granulação variada silto argilosa",
  "Areia de granulação variada siltosa",
  "Areia de granulação variada muito argilosa",
  "Areia fina",
  "Areia fina argilosa",
  "Areia fina e média argilosa",
  "Areia fina e média pouco argilosa",
  "Areia fina e média pouco siltosa",
  "Areia fina e média silto argilosa",
  "Areia fina e média siltosa",
  "Areia fina e média muito argilosa",
  "Areia fina pouco argilosa",
  "Areia fina pouco siltosa",
  "Areia fina silto argilosa",
  "Areia fina siltosa",
  "Areia fina muito argilosa",
  "Areia grossa",
  "Areia grossa argilosa",
  "Areia grossa pouco argilosa",
  "Areia grossa pouco siltosa",
  "Areia grossa silto argilosa",
  "Areia grossa siltosa",
  "Areia grossa muito argilosa",
  "Areia média",
  "Argila",
  "Argila orgânica",
  "Argila plástica",
  "Argila silto arenosa",
  "Argila siltosa",
  "Argila siltosa pouco arenosa",
  "Argila siltosa muito arenosa",
  "Aterro",
  "Britas",
  "Concreto",
  "Rachão",
  "Silte",
  "Silte argilo arenoso",
  "Silte argiloso",
  "Silte areno argiloso",
  "Silte arenoso",
  "Silte muito arenoso"
];

// ================= PAGE =================
export default function SoloPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [layers, setLayers] = useState<Layer[]>([
    { de: "", ate: "", tipo: "", leitura_voc: "", coloracao: "" }
  ]);

  const [form, setForm] = useState<FormData>({
    nome_sondagem: "",
    data: "",
    hora: "",
    nivel_agua: "",
    tipo_sondagem: "",
    diametro_sondagem: "",
    diametro_poco: "",
    pre_filtro: "",
    secao_filtrante_base: "",
    secao_filtrante_topo: "",
    coord_x: "",
    coord_y: "",
    profundidade_total: "",
  });

  async function loadDraft() {
    const { data } = await supabase
      .from("soil_descriptions")
      .select("*")
      .eq("project_id", projectId)
      .eq("finalized", false)
      .maybeSingle();

    if (!data) return;

    setDraftId(data.id);

    setForm({
      nome_sondagem: data.nome_sondagem ?? "",
      data: data.data ?? "",
      hora: data.hora ?? "",
      nivel_agua: data.nivel_agua ?? "",
      tipo_sondagem: data.tipo_sondagem ?? "",
      diametro_sondagem: data.diametro_sondagem ?? "",
      diametro_poco: data.diametro_poco ?? "",
      pre_filtro: data.pre_filtro ?? "",
      secao_filtrante_base: data.secao_filtrante_base ?? "",
      secao_filtrante_topo: data.secao_filtrante_topo ?? "",
      coord_x: data.coord_x ?? "",
      coord_y: data.coord_y ?? "",
      profundidade_total: data.profundidade_total ?? "",
    });

    setLayers(
      data.layers && data.layers.length > 0
        ? data.layers.map((l: any) => ({
            de: l.de || "",
            ate: l.ate || "",
            tipo: l.tipo || "",
            leitura_voc: l.leitura_voc || "",
            coloracao: l.coloracao || ""
          }))
        : [{ de: "", ate: "", tipo: "", leitura_voc: "", coloracao: "" }]
    );
  }

  useEffect(() => {
    loadDraft();
  }, []);

  function setField(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function removeLayer(index: number) {
    setLayers((prev) => prev.filter((_, i) => i !== index));
  }

  function addLayer() {
    setLayers((prev) => [...prev, { de: "", ate: "", tipo: "", leitura_voc: "", coloracao: "" }]);
  }

  async function salvar() {
    setSaving(true);
    try {
      if (draftId) {
        await supabase.from("soil_descriptions").update({ ...form, layers }).eq("id", draftId);
      } else {
        const { data } = await supabase
          .from("soil_descriptions")
          .insert({ project_id: projectId, ...form, layers, finalized: false })
          .select("id")
          .single();

        if (data) setDraftId(data.id);
      }
      await loadDraft();
      alert("Rascunho salvo com sucesso.");
    } catch (error) {
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function concluir() {
    const ok = confirm("Concluir descrição de solo? Após isso não será possível editar.");
    if (!ok) return;

    setSaving(true);
    try {
      await supabase
        .from("soil_descriptions")
        .insert({ project_id: projectId, ...form, layers, finalized: true });

      if (draftId) {
        await supabase.from("soil_descriptions").delete().eq("id", draftId);
      }

      setDraftId(null);
      setForm({
        nome_sondagem: "", data: "", hora: "", nivel_agua: "", tipo_sondagem: "",
        diametro_sondagem: "", diametro_poco: "", pre_filtro: "",
        secao_filtrante_base: "", secao_filtrante_topo: "", coord_x: "", coord_y: "", profundidade_total: "",
      });
      setLayers([{ de: "", ate: "", tipo: "", leitura_voc: "", coloracao: "" }]);
      
      alert("Descrição de solo concluída com sucesso!");
    } catch (error) {
      alert("Erro ao concluir.");
    } finally {
      setSaving(false);
    }
  }

  // ================= UI RENDER =================
  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 pb-28">
        
        {/* HEADER EXECUTIVO (Agora sem o 'sticky' e sem a tag de novo/rascunho) */}
        <div className="bg-[#391e2a] text-white px-5 py-5 shadow-md">
          <div className="flex justify-between items-center max-w-4xl mx-auto w-full">
            <div>
              <h1 className="text-xl font-bold tracking-wide">
                Perfil Descritivo
              </h1>
              <p className="text-xs text-[#80b02d] font-semibold mt-0.5 uppercase tracking-wider">
                Registro Técnico de Sondagem
              </p>
            </div>
          </div>
        </div>

        {/* CONTAINER PRINCIPAL */}
        <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto">

          {/* SONDAGEM */}
          <Section title="Dados da Sondagem" icon={<Icons.Clipboard />}>
            <div className="space-y-4">
              <Input label="Nome / Identificação da Sondagem *" value={form.nome_sondagem} onChange={(v: string) => setField("nome_sondagem", v)} placeholder="Ex: SP-01" />
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="Data" value={form.data} type="date" onChange={(v: string) => setField("data", v)} />
                <Input label="Hora" value={form.hora} type="time" onChange={(v: string) => setField("hora", v)} />
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="Tipo de Sondagem" value={form.tipo_sondagem} onChange={(v: string) => setField("tipo_sondagem", v)} placeholder="Ex: Trado manual" />
                <Input label="Profundidade Total (m)" value={form.profundidade_total} type="number" onChange={(v: string) => setField("profundidade_total", v)} placeholder="0.00" />
              </div>
              <Input label="Nível d'água (m) - Opcional" value={form.nivel_agua} type="number" onChange={(v: string) => setField("nivel_agua", v)} placeholder="0.00" />
            </div>
          </Section>

          {/* POÇO (Nome Alterado) */}
          <Section title="Dados de instalação" icon={<Icons.Ruler />}>
            <div className="space-y-4">
              {/* Adicionado items-end na grade para alinhar os inputs por baixo perfeitamente */}
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="Diâmetro Sondagem (in)" value={form.diametro_sondagem} onChange={(v: string) => setField("diametro_sondagem", v)} placeholder="Ex: 4" />
                <Input label="Diâmetro Poço (in)" value={form.diametro_poco} onChange={(v: string) => setField("diametro_poco", v)} placeholder="Ex: 2" />
              </div>
              <Input label="Nível do Pré-filtro (m)" value={form.pre_filtro} type="number" onChange={(v: string) => setField("pre_filtro", v)} placeholder="0.00" />
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="Seção Filtrante - Topo (m)" value={form.secao_filtrante_topo} type="number" onChange={(v: string) => setField("secao_filtrante_topo", v)} placeholder="0.00" />
                <Input label="Seção Filtrante - Base (m)" value={form.secao_filtrante_base} type="number" onChange={(v: string) => setField("secao_filtrante_base", v)} placeholder="0.00" />
              </div>
            </div>
          </Section>

          {/* COORDENADAS */}
          <Section title="Geolocalização" icon={<Icons.MapPin />}>
            <div className="grid grid-cols-2 gap-4 items-end">
              <Input label="Coordenada X (UTM/Long)" value={form.coord_x} onChange={(v: string) => setField("coord_x", v)} placeholder="000000.00" />
              <Input label="Coordenada Y (UTM/Lat)" value={form.coord_y} onChange={(v: string) => setField("coord_y", v)} placeholder="0000000.00" />
            </div>
          </Section>

          {/* CAMADAS */}
          <Section title={`Camadas Estratigráficas (${layers.length})`} icon={<Icons.LayersIcon />}>
            <div className="space-y-5">
              {layers.map((layer, i) => (
                <div key={i} className="relative bg-white border-2 border-gray-100 p-5 rounded-2xl shadow-sm space-y-4 transition-all hover:border-gray-200">
                  
                  {/* Número da Camada & Botão Excluir */}
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <span className="bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-md">
                      Camada {i + 1}
                    </span>
                    {layers.length > 1 && (
                      <button
                        onClick={() => removeLayer(i)}
                        className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white w-7 h-7 rounded-full text-xs flex items-center justify-center transition-colors"
                        title="Remover Camada"
                      >
                        <Icons.Trash />
                      </button>
                    )}
                  </div>

                  {/* Formulário da Camada */}
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <Input label="Prof. Inicial - De (m)" type="number" value={layer.de} onChange={(v: string) => { const copy = [...layers]; copy[i].de = v; setLayers(copy); }} placeholder="0.00" />
                    <Input label="Prof. Final - Até (m)" type="number" value={layer.ate} onChange={(v: string) => { const copy = [...layers]; copy[i].ate = v; setLayers(copy); }} placeholder="0.00" />
                  </div>
                  
                  <Select label="Classificação do Solo" value={layer.tipo} options={tiposSolo} onChange={(v: string) => { const copy = [...layers]; copy[i].tipo = v; setLayers(copy); }} />
                  
                  <div className="grid grid-cols-2 gap-4 items-end bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                    <Input label="Coloração Visual" value={layer.coloracao} onChange={(v: string) => { const copy = [...layers]; copy[i].coloracao = v; setLayers(copy); }} placeholder="Ex: Marrom escuro" />
                    <Input label="Leitura VOC (ppm)" type="number" value={layer.leitura_voc} onChange={(v: string) => { const copy = [...layers]; copy[i].leitura_voc = v; setLayers(copy); }} placeholder="0.0" />
                  </div>
                </div>
              ))}
            </div>

            <AddButton label="Adicionar Nova Camada" onClick={addLayer} />
          </Section>

        </div>

        {/* ================= BARRA DE AÇÕES FIXA (Mobile First) ================= */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md p-4 border-t shadow-[0_-10px_40px_rgba(0,0,0,0.08)] flex gap-3 z-40">
          <div className="max-w-4xl mx-auto w-full flex gap-3">
            <button
              onClick={salvar}
              disabled={saving}
              className="flex-1 bg-white border-2 border-[#391e2a] text-[#391e2a] font-bold py-3.5 rounded-xl text-sm disabled:opacity-50 active:scale-95 transition flex items-center justify-center gap-2"
            >
              {saving ? <Icons.Loader /> : <Icons.Save />}
              Salvar Rascunho
            </button>
            <button
              onClick={concluir}
              disabled={saving}
              className="flex-1 bg-[#80b02d] text-white font-bold py-3.5 rounded-xl text-sm shadow-md hover:bg-[#729e28] disabled:opacity-80 active:scale-95 transition flex items-center justify-center gap-2"
            >
              {saving ? <Icons.Loader /> : <Icons.Check />}
              Concluir Perfil
            </button>
          </div>
        </div>

      </div>
    </AppShell>
  );
}

// ================= COMPONENTES DE UI PREMIUM COM TIPAGEM ESTRITA =================

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 space-y-5 overflow-hidden">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 -mx-1">
        {icon && (
          <div className="bg-[#391e2a]/5 text-[#391e2a] p-2.5 rounded-xl">
            {icon}
          </div>
        )}
        <h2 className="text-xs font-extrabold text-[#391e2a] uppercase tracking-wider">
          {title}
        </h2>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (val: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="flex flex-col justify-end gap-1.5 w-full">
      <label className="text-[11px] font-bold text-gray-500 ml-1 tracking-tight">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[46px] border border-gray-200 rounded-xl px-4 text-sm bg-white focus:ring-2 focus:ring-[#80b02d]/30 focus:border-[#80b02d] transition-all placeholder:text-gray-300 shadow-inner-sm"
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (val: string) => void }) {
  return (
    <div className="flex flex-col justify-end gap-1.5 w-full">
      <label className="text-[11px] font-bold text-gray-500 ml-1 tracking-tight">
        {label}
      </label>
      <div className="relative flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-[46px] border border-gray-200 rounded-xl px-4 text-sm bg-white focus:ring-2 focus:ring-[#80b02d]/30 focus:border-[#80b02d] transition-all appearance-none shadow-inner-sm"
        >
          <option value="" className="text-gray-300">Selecione uma opção...</option>
          {options.map((o: string) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <div className="absolute right-4 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full mt-2 bg-white hover:bg-gray-50 text-[#391e2a] py-3.5 rounded-xl border-2 border-gray-200 border-dashed text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-sm"
    >
      <Icons.Plus />
      {label}
    </button>
  );
}