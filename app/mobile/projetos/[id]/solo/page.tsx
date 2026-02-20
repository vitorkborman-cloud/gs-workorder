"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AppShell from "../../../../../components/AppShell";

type Layer = {
  profundidade: string;
  tipo: string;
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
  secao_filtrante: string;
  coord_x: string;
  coord_y: string;
  profundidade_total: string;
};

export default function SoloPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [draftId, setDraftId] = useState<string | null>(null);

  const [layers, setLayers] = useState<Layer[]>([
    { profundidade: "", tipo: "" },
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
    secao_filtrante: "",
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
      secao_filtrante: data.secao_filtrante ?? "",
      coord_x: data.coord_x ?? "",
      coord_y: data.coord_y ?? "",
      profundidade_total: data.profundidade_total ?? "",
    });

    setLayers(
      data.layers && data.layers.length > 0
        ? data.layers
        : [{ profundidade: "", tipo: "" }]
    );
  }

  useEffect(() => {
    loadDraft();
  }, []);

  function setField(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addLayer() {
    setLayers((prev) => [...prev, { profundidade: "", tipo: "" }]);
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

    await supabase.from("soil_descriptions").insert({
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
      secao_filtrante: "",
      coord_x: "",
      coord_y: "",
      profundidade_total: "",
    });
    setLayers([{ profundidade: "", tipo: "" }]);

    alert("Descrição concluída e enviada para o desktop.");
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 px-4 py-6 space-y-6">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-[#391e2a]">
                Perfil Descritivo
              </h1>
              <p className="text-xs text-gray-500">
                Registro técnico de sondagem
              </p>
            </div>

            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">
              {draftId ? "Rascunho" : "Novo"}
            </span>
          </div>
        </div>

        <Section title="Dados da Sondagem">
          <Input label="Nome da Sondagem" value={form.nome_sondagem} onChange={(v) => setField("nome_sondagem", v)} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" value={form.data} onChange={(v) => setField("data", v)} />
            <Input label="Hora" value={form.hora} onChange={(v) => setField("hora", v)} />
          </div>

          <Input label="Tipo de Sondagem" value={form.tipo_sondagem} onChange={(v) => setField("tipo_sondagem", v)} />
          <Input label="Nível d’água" value={form.nivel_agua} onChange={(v) => setField("nivel_agua", v)} />
          <Input label="Profundidade Total" value={form.profundidade_total} onChange={(v) => setField("profundidade_total", v)} />
        </Section>

        <Section title="Construção do Poço">
          <Input label="Diâmetro da Sondagem" value={form.diametro_sondagem} onChange={(v) => setField("diametro_sondagem", v)} />
          <Input label="Diâmetro do Poço" value={form.diametro_poco} onChange={(v) => setField("diametro_poco", v)} />
          <Input label="Pré-filtro" value={form.pre_filtro} onChange={(v) => setField("pre_filtro", v)} />
          <Input label="Seção Filtrante" value={form.secao_filtrante} onChange={(v) => setField("secao_filtrante", v)} />
        </Section>

        <Section title="Coordenadas">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Coord. X" value={form.coord_x} onChange={(v) => setField("coord_x", v)} />
            <Input label="Coord. Y" value={form.coord_y} onChange={(v) => setField("coord_y", v)} />
          </div>
        </Section>

        <Section title="Camadas Estratigráficas">
          {layers.map((layer, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <Input
                label="Profundidade (m)"
                value={layer.profundidade}
                onChange={(v) => {
                  const copy = [...layers];
                  copy[i].profundidade = v;
                  setLayers(copy);
                }}
              />
              <Input
                label="Tipo de Solo"
                value={layer.tipo}
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
            className="w-full mt-2 bg-[#391e2a] text-white font-semibold py-2 rounded-lg"
          >
            + Adicionar Camada
          </button>
        </Section>

        {/* BOTÕES PROFISSIONAIS */}
        <div className="space-y-3 pt-2">
          <button
            onClick={salvar}
            className="w-full border border-[#391e2a] text-[#391e2a] font-semibold py-3 rounded-xl"
          >
            Salvar Rascunho
          </button>

          <button
            onClick={concluir}
            className="w-full bg-[#80b02d] text-white font-bold py-3 rounded-xl shadow-md"
          >
            Concluir Perfil
          </button>
        </div>
      </div>
    </AppShell>
  );
}

/* COMPONENTES */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-4">
      <h2 className="text-sm font-semibold text-[#391e2a] border-l-4 border-[#80b02d] pl-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#80b02d]"
      />
    </div>
  );
}