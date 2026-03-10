"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AppShell from "../../../../../components/AppShell";

type Layer = {
  de: string;
  ate: string;
  tipo: string;
};

type Photo = {
  id: string;
  url: string;
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

export default function SoloPage() {

  const params = useParams();
  const projectId = params.id as string;

  const [draftId, setDraftId] = useState<string | null>(null);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);

  const [layers, setLayers] = useState<Layer[]>([
    { de: "", ate: "", tipo: "" }
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
        ? data.layers
        : [{ de: "", ate: "", tipo: "" }]
    );

  }

  useEffect(() => {
    loadDraft();
  }, []);

  function setField(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addLayer() {
    setLayers((prev) => [...prev, { de: "", ate: "", tipo: "" }]);
  }

  async function salvar() {

    if (draftId) {

      await supabase
        .from("soil_descriptions")
        .update({ ...form, layers })
        .eq("id", draftId);

    } else {

      const { data } = await supabase
        .from("soil_descriptions")
        .insert({
          project_id: projectId,
          ...form,
          layers,
          finalized: false,
        })
        .select("id")
        .single();

      if (data) setDraftId(data.id);

    }

    await loadDraft();

    alert("Rascunho salvo.");

  }

  async function concluir() {

    const ok = confirm(
      "Concluir descrição de solo? Após isso não será possível editar."
    );

    if (!ok) return;

    await supabase
      .from("soil_descriptions")
      .insert({
        project_id: projectId,
        ...form,
        layers,
        finalized: true,
      });

    if (draftId) {

      await supabase
        .from("soil_descriptions")
        .delete()
        .eq("id", draftId);

    }

    setDraftId(null);

    setForm({
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

    setLayers([{ de: "", ate: "", tipo: "" }]);

  alert("Descrição concluída.");

}

async function uploadPhoto(file: File) {

  if (!draftId) {
    alert("Salve o rascunho antes de anexar fotos.");
    return;
  }

  setUploading(true);

  const fileName = `${Date.now()}_${file.name}`;

  const filePath = `${projectId}/${draftId}/${fileName}`;

  const { error } = await supabase.storage
    .from("soil-photos")
    .upload(filePath, file);

  if (error) {
    alert("Erro ao enviar foto.");
    setUploading(false);
    return;
  }

  const { data } = supabase.storage
    .from("soil-photos")
    .getPublicUrl(filePath);

  const publicUrl = data.publicUrl;

  setPhotos((prev) => [
    ...prev,
    {
      id: fileName,
      url: publicUrl
    }
  ]);

  setUploading(false);

}

return (

    <AppShell>

      <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-50">

        <div className="bg-[#391e2a] text-white px-4 py-4 shadow-md">

          <div className="flex justify-between items-center">

            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                Perfil Descritivo
              </h1>
              <p className="text-xs text-gray-300">
                Registro técnico de sondagem
              </p>
            </div>

            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#80b02d] text-white shadow">
              {draftId ? "Rascunho" : "Novo"}
            </span>

          </div>

        </div>

        <div className="px-4 py-6 space-y-6">

          <Section title="Dados da Sondagem">

            <Input label="Nome da Sondagem" value={form.nome_sondagem} onChange={(v) => setField("nome_sondagem", v)} />

            <div className="grid grid-cols-2 gap-3">
              <Input label="Data" value={form.data} onChange={(v) => setField("data", v)} />
              <Input label="Hora" value={form.hora} onChange={(v) => setField("hora", v)} />
            </div>

            <Input label="Tipo de Sondagem" value={form.tipo_sondagem} onChange={(v) => setField("tipo_sondagem", v)} />
            <Input label="Nível d’água (m)" value={form.nivel_agua} onChange={(v) => setField("nivel_agua", v)} />
            <Input label="Profundidade Total (m)" value={form.profundidade_total} onChange={(v) => setField("profundidade_total", v)} />

          </Section>

          <Section title="Construção do Poço">

            <Input label="Diâmetro da Sondagem (in)" value={form.diametro_sondagem} onChange={(v) => setField("diametro_sondagem", v)} />
            <Input label="Diâmetro do Poço (in)" value={form.diametro_poco} onChange={(v) => setField("diametro_poco", v)} />
            <Input label="Pré-filtro (Nível - m)" value={form.pre_filtro} onChange={(v) => setField("pre_filtro", v)} />

            <div className="grid grid-cols-2 gap-3">
              <Input label="Seção Filtrante Base (m)" value={form.secao_filtrante_base} onChange={(v) => setField("secao_filtrante_base", v)} />
              <Input label="Seção Filtrante Topo (m)" value={form.secao_filtrante_topo} onChange={(v) => setField("secao_filtrante_topo", v)} />
            </div>

          </Section>

          <Section title="Coordenadas">

            <div className="grid grid-cols-2 gap-3">
              <Input label="Coord. X" value={form.coord_x} onChange={(v) => setField("coord_x", v)} />
              <Input label="Coord. Y" value={form.coord_y} onChange={(v) => setField("coord_y", v)} />
            </div>

          </Section>

          <Section title="Camadas Estratigráficas">

            {layers.map((layer, i) => (

              <div key={i} className="grid grid-cols-3 gap-3 items-end">

                <Input
                  label="De (m)"
                  value={layer.de}
                  onChange={(v) => {
                    const copy = [...layers];
                    copy[i].de = v;
                    setLayers(copy);
                  }}
                />

                <Input
                  label="Até (m)"
                  value={layer.ate}
                  onChange={(v) => {
                    const copy = [...layers];
                    copy[i].ate = v;
                    setLayers(copy);
                  }}
                />

                <Select
                  label="Tipo de Solo"
                  value={layer.tipo}
                  options={tiposSolo}
                  onChange={(v) => {
                    const copy = [...layers];
                    copy[i].tipo = v;
                    setLayers(copy);
                  }}
                />

              </div>

            ))}

            <button
              onClick={addLayer}
              className="w-full mt-3 bg-[#391e2a] text-white font-semibold py-2 rounded-lg shadow hover:opacity-90 transition"
            >
              + Adicionar Camada
            </button>

          </Section>

          <Section title="Fotos da Sondagem">

            <div className="space-y-3">

              <label className="text-xs font-semibold text-gray-600 tracking-wide">
                Tirar foto da sondagem
              </label>

              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  uploadPhoto(file);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50"
              />

              {uploading && (
                <p className="text-xs text-gray-500">
                  Enviando foto...
                </p>
              )}

              <div className="grid grid-cols-3 gap-3">

                {photos.map((p) => (

                  <img
                    key={p.id}
                    src={p.url}
                    className="rounded-lg shadow border object-cover h-24 w-full"
                  />

                ))}

              </div>

            </div>

          </Section>

          <div className="space-y-4 pt-4">

            <button
              onClick={salvar}
              className="w-full bg-white border-2 border-[#391e2a] text-[#391e2a] font-semibold py-3 rounded-xl shadow-sm hover:bg-gray-100 transition"
            >
              Salvar Rascunho
            </button>

            <button
              onClick={concluir}
              className="w-full bg-[#80b02d] text-white font-bold py-3 rounded-xl shadow-lg hover:brightness-105 transition"
            >
              Concluir Perfil
            </button>

          </div>

        </div>

      </div>

    </AppShell>

  );

}

function Section({ title, children }: { title: string; children: React.ReactNode }) {

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-5 space-y-4">

      <h2 className="text-sm font-semibold text-[#391e2a] tracking-wide uppercase border-b pb-2">
        {title}
      </h2>

      {children}

    </div>
  );

}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {

  return (

    <div className="flex flex-col gap-1">

      <label className="text-xs font-semibold text-gray-600 tracking-wide">
        {label}
      </label>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#80b02d] focus:bg-white transition"
      />

    </div>

  );

}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {

  return (

    <div className="flex flex-col gap-1">

      <label className="text-xs font-semibold text-gray-600 tracking-wide">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#80b02d] focus:bg-white transition"
      >

        <option value="">Selecionar</option>

        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}

      </select>

    </div>

  );

}