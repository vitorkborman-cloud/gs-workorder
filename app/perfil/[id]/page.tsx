"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../../components/layout/AdminShell";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

type Layer = {
  profundidade: string;
  tipo: string;
};

export default function PerfilPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("soil_descriptions")
      .select("*")
      .eq("id", id)
      .single();

    setData(data);
  }

  function downloadPDF() {
    window.open(`/api/perfil/${id}/pdf`, "_blank");
  }

  if (!data) return <AdminShell>Carregando...</AdminShell>;

  return (
    <AdminShell>
      <div className="space-y-6">

        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{data.nome_sondagem}</h1>
          <Button className="bg-primary text-white" onClick={downloadPDF}>
            Baixar PDF
          </Button>
        </div>

        <Card className="bg-secondary text-white border-0">
          <CardContent className="p-6 grid md:grid-cols-2 gap-3 text-sm">
            <p><b>Data:</b> {data.data}</p>
            <p><b>Hora:</b> {data.hora}</p>
            <p><b>Nível d'água:</b> {data.nivel_agua}</p>
            <p><b>Tipo de sondagem:</b> {data.tipo_sondagem}</p>
            <p><b>Diâmetro sondagem:</b> {data.diametro_sondagem}</p>
            <p><b>Diâmetro poço:</b> {data.diametro_poco}</p>
            <p><b>Pré-filtro:</b> {data.pre_filtro}</p>
            <p><b>Seção filtrante:</b> {data.secao_filtrante}</p>
            <p><b>Coordenada X:</b> {data.coord_x}</p>
            <p><b>Coordenada Y:</b> {data.coord_y}</p>
            <p><b>Profundidade total:</b> {data.profundidade_total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="text-lg font-semibold">Perfil estratigráfico</h2>

            <table className="w-full text-sm border rounded-xl overflow-hidden">
              <thead className="bg-primary text-white">
                <tr>
                  <th className="p-3 text-left">Profundidade (m)</th>
                  <th className="p-3 text-left">Tipo de solo</th>
                </tr>
              </thead>
              <tbody>
                {data.layers?.map((l: Layer, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{l.profundidade}</td>
                    <td className="p-3">{l.tipo}</td>
                  </tr>
                ))}
              </tbody>
            </table>

          </CardContent>
        </Card>

      </div>
    </AdminShell>
  );
}
