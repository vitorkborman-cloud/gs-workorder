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

"Argila",
"Argila orgânica",
"Argila plástica",
"Argila siltosa",
"Argila siltosa pouco arenosa",
"Argila silto arenosa",
"Argila siltosa muito arenosa",

"Silte",
"Silte argiloso",
"Silte argilo arenoso",
"Silte arenoso",
"Silte areno argiloso",
"Silte muito arenoso",

"Areia",
"Areia fina",
"Areia média",
"Areia grossa",
"Areia fina argilosa",
"Areia fina pouco argilosa",
"Areia fina muito argilosa",
"Areia fina siltosa",
"Areia fina pouco siltosa",
"Areia fina silto argilosa",

"Areia fina e média argilosa",
"Areia fina e média pouco argilosa",
"Areia fina e média muito argilosa",
"Areia fina e média siltosa",
"Areia fina e média pouco siltosa",
"Areia fina e média silto argilosa",

"Areia grossa argilosa",
"Areia grossa pouco argilosa",
"Areia grossa muito argilosa",
"Areia grossa siltosa",
"Areia grossa pouco siltosa",
"Areia grossa silto argilosa",

"Britas",
"Rachão",

"Areia de granulação variada argilosa",
"Areia de granulação variada pouco argilosa",
"Areia de granulação variada muito argilosa",
"Areia de granulação variada siltosa",
"Areia de granulação variada pouco siltosa",
"Areia de granulação variada silto argilosa"

];

export default function SoloPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [draftId, setDraftId] = useState<string | null>(null);

  const [layers, setLayers] = useState<Layer[]>([
    { de: "", ate: "", tipo: "" },
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
      secao_filtrante_base: "",
      secao_filtrante_topo: "",
      coord_x: "",
      coord_y: "",
      profundidade_total: "",
    });

    setLayers([{ de: "", ate: "", tipo: "" }]);

    alert("Descrição concluída.");
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