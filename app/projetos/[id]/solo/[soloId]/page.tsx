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

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;

    pdf.setFillColor(57, 30, 42);
    pdf.rect(0, 0, pageWidth, 25, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(13);
    pdf.text("GS WORK ORDER - RELATÓRIO TÉCNICO", pageWidth / 2, 15, {
      align: "center",
    });

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("PERFIL DESCRITIVO DE SOLO", pageWidth / 2, 40, {
      align: "center",
    });

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");

    let y = 60;

    function campo(label: string, valor: any) {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(valor ?? "-"), margin + 60, y);
      y += 7;
    }

    pdf.setFont("helvetica", "bold");
    pdf.text("1. Dados da Sondagem", margin, y);
    y += 8;

    campo("Sondagem:", data.nome_sondagem);
    campo("Data:", data.data);
    campo("Hora:", data.hora);
    campo("Tipo:", data.tipo_sondagem);
    campo("Nível d'água:", data.nivel_agua);
    campo("Profundidade total:", data.profundidade_total);

    y += 8;

    pdf.setFont("helvetica", "bold");
    pdf.text("2. Construção do Poço", margin, y);
    y += 8;

    campo("Diâmetro sondagem:", data.diametro_sondagem);
    campo("Diâmetro poço:", data.diametro_poco);
    campo("Pré-filtro:", data.pre_filtro);
    campo(
      "Seção filtrante:",
      `${data.secao_filtrante_topo || "-"} – ${data.secao_filtrante_base || "-"}`
    );

    pdf.addPage();

    const topo = 30;
    const alturaMax = 170;
    const larguraPerfil = 40;

    const centro = pageWidth / 2;
    const esquerdaPerfil = centro - larguraPerfil / 2;
    const direitaPerfil = centro + larguraPerfil / 2;

    const profundidadeTotal = parseFloat(data.profundidade_total || "1");
    const escala = alturaMax / profundidadeTotal;

    const larguraTubo = 12;
    const esquerdaTubo = centro - larguraTubo / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax, "F");
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax);

    const topoFiltro = parseFloat(data.secao_filtrante_topo);
    const baseFiltro = parseFloat(data.secao_filtrante_base);

    if (!isNaN(topoFiltro) && !isNaN(baseFiltro)) {

      const yInicioFiltro = topo + topoFiltro * escala;
      const alturaFiltro = (baseFiltro - topoFiltro) * escala;

      /* FILTRO */
      for (let i = 0; i < alturaFiltro; i += 3) {
        pdf.line(
          esquerdaTubo,
          yInicioFiltro + i,
          esquerdaTubo + larguraTubo,
          yInicioFiltro + i
        );
      }

      pdf.rect(esquerdaTubo, yInicioFiltro, larguraTubo, alturaFiltro);

      /* TUBO LISO INFERIOR */

      const yInicioLiso = topo + baseFiltro * escala;
      const alturaLiso = (profundidadeTotal - baseFiltro) * escala;

      if (alturaLiso > 0) {

        pdf.setDrawColor(120);

        for (let i = 0; i < alturaLiso; i += 4) {
          pdf.line(
            esquerdaTubo,
            yInicioLiso + i,
            esquerdaTubo + larguraTubo,
            yInicioLiso + i
          );
        }

        pdf.rect(esquerdaTubo, yInicioLiso, larguraTubo, alturaLiso);

      }
    }

    if (data.nivel_agua) {
      const nivel = Number(String(data.nivel_agua).replace(",", "."));

      if (!isNaN(nivel)) {
        const yNivel = topo + nivel * escala;

        pdf.setDrawColor(0, 0, 255);
        pdf.setLineWidth(1.2);
        pdf.line(esquerdaPerfil - 10, yNivel, direitaPerfil + 10, yNivel);
      }
    }

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

          <Section title="Dados da Sondagem">
            <Grid>
              <Info label="Nome da Sondagem" value={data.nome_sondagem} />
              <Info label="Tipo de Sondagem" value={data.tipo_sondagem} />
              <Info label="Data" value={data.data} />
              <Info label="Hora" value={data.hora} />
              <Info label="Nível d’água" value={data.nivel_agua} />
              <Info label="Profundidade Total" value={data.profundidade_total} />
            </Grid>
          </Section>

          <Section title="Construção do Poço">
            <Grid>
              <Info label="Diâmetro da Sondagem" value={data.diametro_sondagem} />
              <Info label="Diâmetro do Poço" value={data.diametro_poco} />
              <Info label="Pré-filtro" value={data.pre_filtro} />
              <Info
                label="Seção Filtrante"
                value={`${data.secao_filtrante_topo || "-"} – ${data.secao_filtrante_base || "-"}`}
              />
            </Grid>
          </Section>

        </div>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-8">
      <h2 className="text-xl font-bold text-[#391e2a] uppercase tracking-wide">
        {title}
      </h2>
      <div className="border-b border-[#391e2a] mt-2 mb-6 w-full"></div>
      {children}
    </div>
  );
}

function Grid({ children }: any) {
  return <div className="grid md:grid-cols-2 gap-6 text-sm">{children}</div>;
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-gray-800">{value || "-"}</p>
    </div>
  );
}