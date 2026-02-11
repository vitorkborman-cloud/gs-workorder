"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AppShell from "../../../../../components/AppShell";
import Card from "../../../../../components/Card";
import Button from "../../../../../components/Button";

type Layer = {
  profundidade: string;
  tipo: string;
};

type Draft = {
  id: string;
};

export default function SoloPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [draftId, setDraftId] = useState<string | null>(null);

  const [layers, setLayers] = useState<Layer[]>([
    { profundidade: "", tipo: "" },
  ]);

  const [form, setForm] = useState({
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

  // =========================
  // CARREGAR RASCUNHO
  // =========================
  async function loadDraft() {
    const { data } = await supabase
      .from("soil_descriptions")
      .select("id, nome_sondagem, data, hora, nivel_agua, tipo_sondagem, diametro_sondagem, diametro_poco, pre_filtro, secao_filtrante, coord_x, coord_y, profundidade_total, layers")
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

  // =========================
  // HELPERS
  // =========================
  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addLayer() {
    setLayers((prev) => [...prev, { profundidade: "", tipo: "" }]);
  }

  // =========================
  // SALVAR = UPDATE OU INSERT
  // =========================
  async function salvar() {
    if (draftId) {
      await supabase
        .from("soil_descriptions")
        .update({
          ...form,
          layers,
        })
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

  // =========================
  // CONCLUIR = GERAR OFICIAL
  // =========================
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
      <Card title="Descrição de Solo">
        <div className="space-y-3">
          {Object.entries(form).map(([key, value]) => (
            <input
              key={key}
              placeholder={key.replaceAll("_", " ")}
              value={value}
              onChange={(e) => setField(key, e.target.value)}
              className="w-full border rounded-lg p-2"
            />
          ))}

          <div className="mt-4 space-y-2">
            <p className="font-bold">Camadas</p>

            {layers.map((layer, i) => (
              <div key={i} className="flex gap-2">
                <input
                  placeholder="Profundidade (m)"
                  value={layer.profundidade}
                  onChange={(e) => {
                    const copy = [...layers];
                    copy[i].profundidade = e.target.value;
                    setLayers(copy);
                  }}
                  className="flex-1 border rounded-lg p-2"
                />
                <input
                  placeholder="Tipo de solo"
                  value={layer.tipo}
                  onChange={(e) => {
                    const copy = [...layers];
                    copy[i].tipo = e.target.value;
                    setLayers(copy);
                  }}
                  className="flex-1 border rounded-lg p-2"
                />
              </div>
            ))}

            <button
              onClick={addLayer}
              className="w-full bg-gray-200 font-bold py-2 rounded-lg"
            >
              +
            </button>
          </div>

          <div className="space-y-2 mt-4">
            <Button text="Salvar" onClick={salvar} />
            <Button text="Concluir" onClick={concluir} />
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
