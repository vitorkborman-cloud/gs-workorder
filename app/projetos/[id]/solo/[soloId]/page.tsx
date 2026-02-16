"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AdminShell from "../../../../../components/layout/AdminShell";
import { Card, CardContent } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import jsPDF from "jspdf";

type Layer = {
  profundidade: string;
  tipo: string;
};

export default function SoloDetailPage() {
  const params = useParams();
  const soloId = params.soloId as string;

  const [data, setData] = useState<any>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("soil_descriptions")
      .select("*")
      .eq("id", soloId)
      .single();

    if (data) {
      setData(data);
      setLayers(data.layers || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function gerarPDF() {
    if (!data) return;

    const pdf = new jsPDF("p", "mm", "a4");
    let y = 20;

    pdf.setFontSize(14);
    pdf.text(`Descrição de Solo - ${data.nome_sondagem}`, 10, y);
    y += 10;

    Object.entries(data).forEach(([key, value]) => {
      if (key === "layers" || key === "id") return;
      pdf.text(`${key}: ${value ?? "-"}`, 10, y);
      y += 6;
    });

    y += 6;
    pdf.text("Camadas:", 10, y);
    y += 6;

    layers.forEach((l, i) => {
      pdf.text(`${i + 1}. ${l.profundidade}m - ${l.tipo}`, 10, y);
      y += 6;
    });

    pdf.save(`perfil_${data.nome_sondagem}.pdf`);
  }

  if (loading) return <AdminShell><p>Carregando...</p></AdminShell>;

  if (!data) return <AdminShell><p>Perfil não encontrado.</p></AdminShell>;

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Perfil descritivo</h1>
          <Button onClick={gerarPDF} className="bg-primary text-white">
            Baixar PDF
          </Button>
        </div>

        <Card className="bg-secondary text-white border-0">
          <CardContent className="p-6 grid md:grid-cols-2 gap-4">
            {Object.entries({
              "Sondagem": data.nome_sondagem,
              "Data": data.data,
              "Hora": data.hora,
              "Nível d'água": data.nivel_agua,
              "Tipo": data.tipo_sondagem,
              "Diâmetro sondagem": data.diametro_sondagem,
              "Diâmetro poço": data.diametro_poco,
              "Pré-filtro": data.pre_filtro,
              "Seção filtrante": data.secao_filtrante,
              "Coord X": data.coord_x,
              "Coord Y": data.coord_y,
              "Profundidade total": data.profundidade_total,
            }).map(([label, value]) => (
              <div key={label}>
                <p className="text-sm opacity-70">{label}</p>
                <p className="font-semibold">{value || "-"}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-secondary text-white border-0">
          <CardContent className="p-6 space-y-3">
            <h2 className="text-xl font-semibold">Camadas</h2>

            {layers.length === 0 ? (
              <p className="opacity-70">Nenhuma camada informada</p>
            ) : (
              layers.map((l, i) => (
                <div key={i} className="bg-primary rounded-xl px-4 py-3">
                  <p className="font-semibold">{l.profundidade} m</p>
                  <p className="text-sm opacity-90">{l.tipo}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
