"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../../lib/supabase";
import MobileShell from "../../../../../../components/layout/MobileShell";
import { useToast } from "../../../../../../components/Toast";
import proj4 from "proj4";

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
  Crosshair: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22v-4M12 6V2M22 12h-4M6 12H2M12 12a4 4 0 100-8 4 4 0 000 8z" /></svg>,
};

type Layer = { de: string; ate: string; tipo: string; leitura_voc: string; coloracao: string; };

type FormData = {
  nome_sondagem: string; nomenclatura_poco: string; data: string; hora: string;
  nivel_agua: string; tipo_sondagem: string; diametro_sondagem: string; diametro_poco: string;
  pre_filtro: string; secao_filtrante_base: string; secao_filtrante_topo: string;
  coord_x: string; coord_y: string; utm_zona: string; cota: string; profundidade_total: string;
};

const tiposSolo = [
  "Areia", "Areia de granulação variada argilosa", "Areia de granulação variada pouco argilosa",
  "Areia de granulação variada pouco siltosa", "Areia de granulação variada silto argilosa",
  "Areia de granulação variada siltosa", "Areia de granulação variada muito argilosa",
  "Areia fina", "Areia fina argilosa", "Areia fina e média argilosa", "Areia fina e média pouco argilosa",
  "Areia fina e média pouco siltosa", "Areia fina e média silto argilosa", "Areia fina e média siltosa",
  "Areia fina e média muito argilosa", "Areia fina pouco argilosa", "Areia fina pouco siltosa",
  "Areia fina silto argilosa", "Areia fina siltosa", "Areia fina muito argilosa", "Areia grossa",
  "Areia grossa argilosa", "Areia grossa pouco argilosa", "Areia grossa pouco siltosa",
  "Areia grossa silto argilosa", "Areia grossa siltosa", "Areia grossa muito argilosa", "Areia média",
  "Argila", "Argila orgânica", "Argila plástica", "Argila silto arenosa", "Argila siltosa",
  "Argila siltosa pouco arenosa", "Argila siltosa muito arenosa", "Aterro", "Britas", "Concreto",
  "Rachão", "Silte", "Silte argilo arenoso", "Silte argiloso", "Silte areno argiloso",
  "Silte arenoso", "Silte muito arenoso"
];

const emptyForm: FormData = {
  nome_sondagem: "", nomenclatura_poco: "", data: "", hora: "", nivel_agua: "",
  tipo_sondagem: "", diametro_sondagem: "", diametro_poco: "", pre_filtro: "",
  secao_filtrante_base: "", secao_filtrante_topo: "", coord_x: "", coord_y: "",
  utm_zona: "", cota: "", profundidade_total: "",
};

export default function SoloFormPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const soloId = params.soloId as string;
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [finalized, setFinalized] = useState(false);

  const [layers, setLayers] = useState<Layer[]>([{ de: "", ate: "", tipo: "", leitura_voc: "", coloracao: "" }]);
  const [form, setForm] = useState<FormData>(emptyForm);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("soil_descriptions").select("*").eq("id", soloId).single();
    if (data) {
      setFinalized(data.finalized);
      setForm({
        nome_sondagem: data.nome_sondagem ?? "", nomenclatura_poco: data.nomenclatura_poco ?? "",
        data: data.data ?? "", hora: data.hora ?? "", nivel_agua: data.nivel_agua ?? "",
        tipo_sondagem: data.tipo_sondagem ?? "", diametro_sondagem: data.diametro_sondagem ?? "",
        diametro_poco: data.diametro_poco ?? "", pre_filtro: data.pre_filtro ?? "",
        secao_filtrante_base: data.secao_filtrante_base ?? "", secao_filtrante_topo: data.secao_filtrante_topo ?? "",
        coord_x: data.coord_x ?? "", coord_y: data.coord_y ?? "", utm_zona: data.utm_zona ?? "",
        cota: data.cota ?? "", profundidade_total: data.profundidade_total ?? "",
      });
      if (data.layers?.length > 0) setLayers(data.layers);
    }
    setLoading(false);
  }

  function setField(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function obterLocalizacaoAutomatica() {
    if (!navigator.geolocation) { showToast("Geolocalização não suportada.", "error"); return; }
    setFetchingLocation(true);
    let watchId: number;
    let bestPosition: GeolocationPosition | null = null;
    watchId = navigator.geolocation.watchPosition(
      (pos) => { if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) bestPosition = pos; },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      if (bestPosition) {
        const lat = bestPosition.coords.latitude;
        const lon = bestPosition.coords.longitude;
        const altitude = bestPosition.coords.altitude;
        const precisao = bestPosition.coords.accuracy;
        if (precisao > 20) showToast(`GPS com margem de ${precisao.toFixed(0)}m. Vá para local aberto.`, "info");
        const zoneNum = Math.floor((lon + 180) / 6) + 1;
        const isSouth = lat < 0;
        const [easting, northing] = proj4(
          "+proj=longlat +datum=WGS84 +no_defs",
          `+proj=utm +zone=${zoneNum} ${isSouth ? "+south" : ""} +datum=WGS84 +units=m +no_defs`,
          [lon, lat]
        );
        setForm((prev) => ({
          ...prev, coord_x: easting.toFixed(2), coord_y: northing.toFixed(2),
          utm_zona: `${zoneNum}${isSouth ? "S" : "N"}`, cota: altitude ? altitude.toFixed(2) : "",
        }));
      } else {
        showToast("Não foi possível capturar o GPS.", "error");
      }
      setFetchingLocation(false);
    }, 8000);
  }

  async function salvar() {
    setSaving(true);
    try {
      await supabase.from("soil_descriptions").update({ ...form, layers }).eq("id", soloId);
      showToast("Rascunho salvo com sucesso!");
    } catch {
      showToast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function concluir() {
    if (!confirm("Concluir descrição de solo? Após isso não será possível editar.")) return;
    setSaving(true);
    try {
      await supabase.from("soil_descriptions").update({ ...form, layers, finalized: true }).eq("id", soloId);
      showToast("Perfil concluído com sucesso!");
      router.push(`/mobile/projetos/${projectId}/solo`);
    } catch {
      showToast("Erro ao concluir.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <MobileShell title="Carregando..." backHref={`/mobile/projetos/${projectId}/solo`}>
      <div className="p-10 text-center text-gray-400 animate-pulse">Carregando dados...</div>
    </MobileShell>
  );

  return (
    <MobileShell
      title={form.nomenclatura_poco || "Novo Perfil"}
      subtitle="Registro Técnico de Sondagem"
      backHref={`/mobile/projetos/${projectId}/solo`}
    >
      <div className="min-h-screen bg-gray-50 pb-28 -m-4 p-4">
        <div className="py-2 space-y-6 max-w-4xl mx-auto">

          {finalized && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-center text-sm text-green-700 font-semibold">
              ✓ Este perfil foi concluído e está somente leitura.
            </div>
          )}

          <Section title="Dados da Sondagem" icon={<Icons.Clipboard />}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="ID / Nomenclatura (Poço) *" value={form.nomenclatura_poco} onChange={(v: string) => setField("nomenclatura_poco", v)} placeholder="Ex: GS-W01" disabled={finalized} />
                <Input label="ID Interno da Sondagem" value={form.nome_sondagem} onChange={(v: string) => setField("nome_sondagem", v)} placeholder="Ex: ST-01" disabled={finalized} />
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="Data" value={form.data} type="date" onChange={(v: string) => setField("data", v)} disabled={finalized} />
                <Input label="Hora" value={form.hora} type="time" onChange={(v: string) => setField("hora", v)} disabled={finalized} />
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="Tipo de Sondagem" value={form.tipo_sondagem} onChange={(v: string) => setField("tipo_sondagem", v)} placeholder="Ex: Trado manual" disabled={finalized} />
                <Input label="Profundidade Total (m)" value={form.profundidade_total} type="number" onChange={(v: string) => setField("profundidade_total", v)} placeholder="0.00" disabled={finalized} />
              </div>
              <Input label="Nível d'água (m)" value={form.nivel_agua} type="number" onChange={(v: string) => setField("nivel_agua", v)} placeholder="0.00" disabled={finalized} />
            </div>
          </Section>

          <Section title="Dados de Instalação" icon={<Icons.Ruler />}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="Diâmetro Sondagem (in)" value={form.diametro_sondagem} onChange={(v: string) => setField("diametro_sondagem", v)} placeholder="Ex: 4" disabled={finalized} />
                <Input label="Diâmetro Poço (in)" value={form.diametro_poco} onChange={(v: string) => setField("diametro_poco", v)} placeholder="Ex: 2" disabled={finalized} />
              </div>
              <Input label="Nível do Pré-filtro (m)" value={form.pre_filtro} type="number" onChange={(v: string) => setField("pre_filtro", v)} placeholder="0.00" disabled={finalized} />
              <div className="grid grid-cols-2 gap-4 items-end">
                <Input label="Seção Filtrante - Início (m)" value={form.secao_filtrante_topo} type="number" onChange={(v: string) => setField("secao_filtrante_topo", v)} placeholder="0.00" disabled={finalized} />
                <Input label="Seção Filtrante - Fim (m)" value={form.secao_filtrante_base} type="number" onChange={(v: string) => setField("secao_filtrante_base", v)} placeholder="0.00" disabled={finalized} />
              </div>
            </div>
          </Section>

          <Section title="Geolocalização (UTM)" icon={<Icons.MapPin />}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 items-end">
                <Input label="UTM Este (X)" value={form.coord_x} onChange={(v: string) => setField("coord_x", v)} placeholder="Ex: 333420" disabled={finalized} />
                <Input label="UTM Norte (Y)" value={form.coord_y} onChange={(v: string) => setField("coord_y", v)} placeholder="Ex: 7393300" disabled={finalized} />
                <Input label="Zona" value={form.utm_zona} onChange={(v: string) => setField("utm_zona", v)} placeholder="Ex: 23S" disabled={finalized} />
                <Input label="Cota / Alt. (m)" value={form.cota} type="number" onChange={(v: string) => setField("cota", v)} placeholder="Ex: 750.50" disabled={finalized} />
              </div>
              {!finalized && (
                <button
                  onClick={obterLocalizacaoAutomatica}
                  disabled={fetchingLocation}
                  className="w-full bg-[#80b02d]/10 text-[#6a9425] hover:bg-[#80b02d]/20 py-3 rounded-xl border border-[#80b02d]/30 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
                >
                  {fetchingLocation ? <><Icons.Loader /> Triangulando satélites (8s)...</> : <><Icons.Crosshair /> Capturar Localização (UTM + Cota)</>}
                </button>
              )}
            </div>
          </Section>

          <Section title={`Camadas Estratigráficas (${layers.length})`} icon={<Icons.LayersIcon />}>
            <div className="space-y-5">
              {layers.map((layer, i) => (
                <div key={i} className="relative bg-white border-2 border-gray-100 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <span className="bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-md">Camada {i + 1}</span>
                    {!finalized && layers.length > 1 && (
                      <button onClick={() => setLayers((prev) => prev.filter((_, idx) => idx !== i))} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white w-7 h-7 rounded-full flex items-center justify-center transition-colors">
                        <Icons.Trash />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <Input label="De (m)" type="number" value={layer.de} onChange={(v: string) => { const c = [...layers]; c[i].de = v; setLayers(c); }} placeholder="0.00" disabled={finalized} />
                    <Input label="Até (m)" type="number" value={layer.ate} onChange={(v: string) => { const c = [...layers]; c[i].ate = v; setLayers(c); }} placeholder="0.00" disabled={finalized} />
                  </div>
                  <Select label="Classificação do Solo" value={layer.tipo} options={tiposSolo} onChange={(v: string) => { const c = [...layers]; c[i].tipo = v; setLayers(c); }} disabled={finalized} />
                  <div className="grid grid-cols-2 gap-4 items-end bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                    <Input label="Observações" value={layer.coloracao} onChange={(v: string) => { const c = [...layers]; c[i].coloracao = v; setLayers(c); }} placeholder="Avermelhado/Úmido/Odor" disabled={finalized} />
                    <Input label="Leitura VOC (ppm)" type="number" value={layer.leitura_voc} onChange={(v: string) => { const c = [...layers]; c[i].leitura_voc = v; setLayers(c); }} placeholder="0.0" disabled={finalized} />
                  </div>
                </div>
              ))}
            </div>
            {!finalized && (
              <button onClick={() => setLayers((prev) => [...prev, { de: "", ate: "", tipo: "", leitura_voc: "", coloracao: "" }])} className="w-full mt-2 bg-white hover:bg-gray-50 text-[#391e2a] py-3.5 rounded-xl border-2 border-gray-200 border-dashed text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition">
                <Icons.Plus /> Adicionar Nova Camada
              </button>
            )}
          </Section>

        </div>

        {!finalized && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md p-4 border-t shadow-[0_-10px_40px_rgba(0,0,0,0.08)] flex gap-3 z-40">
            <div className="max-w-4xl mx-auto w-full flex gap-3">
              <button onClick={salvar} disabled={saving} className="flex-1 bg-white border-2 border-[#391e2a] text-[#391e2a] font-bold py-3.5 rounded-xl text-sm disabled:opacity-50 active:scale-95 transition flex items-center justify-center gap-2">
                {saving ? <Icons.Loader /> : <Icons.Save />} Salvar Rascunho
              </button>
              <button onClick={concluir} disabled={saving} className="flex-1 bg-[#80b02d] text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-80 active:scale-95 transition flex items-center justify-center gap-2">
                {saving ? <Icons.Loader /> : <Icons.Check />} Concluir Perfil
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
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 space-y-5 overflow-hidden">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 -mx-1">
        {icon && <div className="bg-[#391e2a]/5 text-[#391e2a] p-2.5 rounded-xl">{icon}</div>}
        <h2 className="text-xs font-extrabold text-[#391e2a] uppercase tracking-wider">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "", disabled = false }: any) {
  return (
    <div className="flex flex-col justify-end gap-1.5 w-full">
      <label className="text-[11px] font-bold text-gray-500 ml-1 tracking-tight">{label}</label>
      <input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="w-full h-[46px] border border-gray-200 rounded-xl px-4 text-sm bg-white focus:ring-2 focus:ring-[#80b02d]/30 focus:border-[#80b02d] transition-all placeholder:text-gray-300 disabled:bg-gray-50 disabled:text-gray-400" />
    </div>
  );
}

function Select({ label, value, options, onChange, disabled = false }: any) {
  return (
    <div className="flex flex-col justify-end gap-1.5 w-full">
      <label className="text-[11px] font-bold text-gray-500 ml-1 tracking-tight">{label}</label>
      <div className="relative flex items-center">
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
          className="w-full h-[46px] border border-gray-200 rounded-xl px-4 text-sm bg-white focus:ring-2 focus:ring-[#80b02d]/30 focus:border-[#80b02d] transition-all appearance-none disabled:bg-gray-50 disabled:text-gray-400">
          <option value="">Selecione...</option>
          {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
        <div className="absolute right-4 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    </div>
  );
}
