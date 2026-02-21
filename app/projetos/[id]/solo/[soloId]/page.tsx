"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AdminShell from "../../../../../components/layout/AdminShell";
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
    pdf.save(`perfil_${data.nome_sondagem}.pdf`);
  }

  if (loading)
    return (
      <AdminShell>
        <p>Carregando...</p>
      </AdminShell>
    );

  if (!data)
    return (
      <AdminShell>
        <p>Perfil não encontrado.</p>
      </AdminShell>
    );

  return (
    <AdminShell>
      <div className="bg-gray-100 min-h-screen pb-12">

        {/* HEADER */}
        <div className="bg-[#391e2a] text-white px-10 py-8 shadow-md">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold">Perfil Descritivo</h1>
              <p className="opacity-80">Registro técnico de sondagem</p>
            </div>
            <Button
              onClick={gerarPDF}
              className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-semibold px-6"
            >
              Exportar PDF
            </Button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 space-y-8 px-6">

          {/* DADOS DA SONDAGEM */}
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-xl font-bold text-[#391e2a] uppercase tracking-wide">
              Dados da Sondagem
            </h2>
            <div className="border-b border-[#391e2a] mt-2 mb-6 w-full"></div>

            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <Info label="Nome da Sondagem" value={data.nome_sondagem} />
              <Info label="Tipo de Sondagem" value={data.tipo_sondagem} />
              <Info label="Data" value={data.data} />
              <Info label="Hora" value={data.hora} />
              <Info label="Nível d’água" value={data.nivel_agua} />
              <Info label="Profundidade Total" value={data.profundidade_total} />
            </div>
          </div>

          {/* CONSTRUÇÃO DO POÇO */}
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-xl font-bold text-[#391e2a] uppercase tracking-wide">
              Construção do Poço
            </h2>
            <div className="border-b border-[#391e2a] mt-2 mb-6 w-full"></div>

            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <Info label="Diâmetro da Sondagem" value={data.diametro_sondagem} />
              <Info label="Diâmetro do Poço" value={data.diametro_poco} />
              <Info label="Pré-filtro" value={data.pre_filtro} />
              <Info label="Seção Filtrante" value={data.secao_filtrante} />
            </div>
          </div>

          {/* COORDENADAS */}
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-xl font-bold text-[#391e2a] uppercase tracking-wide">
              Coordenadas
            </h2>
            <div className="border-b border-[#391e2a] mt-2 mb-6 w-full"></div>

            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <Info label="Coord. X" value={data.coord_x} />
              <Info label="Coord. Y" value={data.coord_y} />
            </div>
          </div>

          {/* CAMADAS ESTRATIGRÁFICAS */}
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-xl font-bold text-[#391e2a] uppercase tracking-wide">
              Camadas Estratigráficas
            </h2>
            <div className="border-b border-[#391e2a] mt-2 mb-6 w-full"></div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-3 text-left">De (m)</th>
                  <th className="border p-3 text-left">Até (m)</th>
                  <th className="border p-3 text-left">Tipo de Solo</th>
                </tr>
              </thead>
              <tbody>
                {layers.map((layer, index) => {
                  const de = index === 0 ? 0 : layers[index - 1].profundidade;
                  return (
                    <tr key={index}>
                      <td className="border p-3">{de}</td>
                      <td className="border p-3">{layer.profundidade}</td>
                      <td className="border p-3">{layer.tipo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </AdminShell>
  );
}

/* COMPONENTE AUXILIAR */
function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-gray-800">{value || "-"}</p>
    </div>
  );
}