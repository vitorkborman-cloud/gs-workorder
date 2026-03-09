"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AppShell from "../../../../../components/AppShell";

type Layer = {
  profundidade: string;
  textura: string;
  cor: string;
  genese: string;
  complemento: string;
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

const TEXTURAS = [
  "Areia fina",
  "Areia média",
  "Areia grossa",
  "Areia siltosa",
  "Areia argilosa",
  "Silte",
  "Silte arenoso",
  "Silte argiloso",
  "Argila",
  "Argila siltosa",
  "Argila arenosa",
];

const GENESES = [
  "",
  "Residual",
  "Aluvial",
  "Coluvial",
  "Eluvial",
  "Orgânico",
  "Laterítico",
];

const COMPLEMENTOS = [
  "",
  "Com cascalho",
  "Com matéria orgânica",
  "Micáceo",
  "Muito compacto",
  "Pouco compacto",
];

export default function SoloPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [draftId, setDraftId] = useState<string | null>(null);

  const [layers, setLayers] = useState<Layer[]>([
    { profundidade: "", textura: "", cor: "", genese: "", complemento: "" },
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

  function setField(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addLayer() {
    setLayers((prev) => [
      ...prev,
      { profundidade: "", textura: "", cor: "", genese: "", complemento: "" },
    ]);
  }

  function gerarDescricao(layer: Layer) {
    return [
      layer.textura,
      layer.cor,
      layer.genese,
      layer.complemento,
    ]
      .filter(Boolean)
      .join(" ");
  }

  async function salvar() {
    const layersComDescricao = layers.map((l) => ({
      profundidade: l.profundidade,
      tipo: gerarDescricao(l),
    }));

    if (draftId) {
      await supabase
        .from("soil_descriptions")
        .update({ ...form, layers: layersComDescricao })
        .eq("id", draftId);
    } else {
      const { data } = await supabase
        .from("soil_descriptions")
        .insert({
          project_id: projectId,
          ...form,
          layers: layersComDescricao,
          finalized: false,
        })
        .select("id")
        .single();

      if (data) setDraftId(data.id);
    }

    alert("Rascunho salvo.");
  }

  async function concluir() {
    const layersComDescricao = layers.map((l) => ({
      profundidade: l.profundidade,
      tipo: gerarDescricao(l),
    }));

    await supabase.from("soil_descriptions").insert({
      project_id: projectId,
      ...form,
      layers: layersComDescricao,
      finalized: true,
    });

    alert("Perfil enviado para o desktop.");
  }

  return (
    <AppShell>
      <div className="px-4 py-6 space-y-6">

        <Section title="Dados da Sondagem">
          <Input label="Nome da Sondagem" value={form.nome_sondagem} onChange={(v) => setField("nome_sondagem", v)} />
          <Input label="Tipo de Sondagem" value={form.tipo_sondagem} onChange={(v) => setField("tipo_sondagem", v)} />
          <Input label="Nível d’água" value={form.nivel_agua} onChange={(v) => setField("nivel_agua", v)} />
          <Input label="Profundidade Total" value={form.profundidade_total} onChange={(v) => setField("profundidade_total", v)} />
        </Section>

        <Section title="Camadas Estratigráficas">

          {layers.map((layer, i) => (
            <div key={i} className="space-y-3 border p-3 rounded-lg">

              <Input
                label="Profundidade (m)"
                value={layer.profundidade}
                onChange={(v) => {
                  const copy = [...layers];
                  copy[i].profundidade = v;
                  setLayers(copy);
                }}
              />

              <Select
                label="Textura"
                value={layer.textura}
                options={TEXTURAS}
                onChange={(v) => {
                  const copy = [...layers];
                  copy[i].textura = v;
                  setLayers(copy);
                }}
              />

              <Input
                label="Cor"
                value={layer.cor}
                onChange={(v) => {
                  const copy = [...layers];
                  copy[i].cor = v;
                  setLayers(copy);
                }}
              />

              <Select
                label="Gênese (opcional)"
                value={layer.genese}
                options={GENESES}
                onChange={(v) => {
                  const copy = [...layers];
                  copy[i].genese = v;
                  setLayers(copy);
                }}
              />

              <Select
                label="Complemento (opcional)"
                value={layer.complemento}
                options={COMPLEMENTOS}
                onChange={(v) => {
                  const copy = [...layers];
                  copy[i].complemento = v;
                  setLayers(copy);
                }}
              />

            </div>
          ))}

          <button
            onClick={addLayer}
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg"
          >
            + Adicionar Camada
          </button>
        </Section>

        <button
          onClick={salvar}
          className="w-full bg-white border py-3 rounded-lg"
        >
          Salvar Rascunho
        </button>

        <button
          onClick={concluir}
          className="w-full bg-[#80b02d] text-white py-3 rounded-lg"
        >
          Concluir Perfil
        </button>

      </div>
    </AppShell>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow space-y-3">
      <h2 className="font-semibold text-[#391e2a]">{title}</h2>
      {children}
    </div>
  );
}

function Input({ label, value, onChange }: any) {
  return (
    <div>
      <label className="text-xs">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded p-2"
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: any) {
  return (
    <div>
      <label className="text-xs">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded p-2"
      >
        {options.map((o: string) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}