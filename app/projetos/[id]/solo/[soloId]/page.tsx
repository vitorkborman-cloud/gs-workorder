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

  /* ================= PDF ================= */

  async function gerarPDF() {
    if (!data) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    const ROXO: [number, number, number] = [57, 30, 42];
    const VERDE: [number, number, number] = [128, 176, 45];

    /* ---------- PÁGINA 1 - DADOS ---------- */

    pdf.setFillColor(...ROXO);
    pdf.rect(0, 0, pageWidth, 25, "F");

    const logo = new Image();
    logo.src = "/logo.png";
    await new Promise((resolve) => (logo.onload = resolve));

    const logoWidth = 30;
    const logoHeight = (logo.height / logo.width) * logoWidth;

    pdf.addImage(logo, "PNG", margin, 5, logoWidth, logoHeight);

    pdf.setGState(new (pdf as any).GState({ opacity: 0.85 }));
    pdf.setFillColor(255, 255, 255);
    pdf.rect(margin, 5, logoWidth, logoHeight, "F");
    pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

    pdf.setTextColor(255);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("PERFIL DESCRITIVO", pageWidth / 2, 15, {
      align: "center",
    });

    pdf.setTextColor(0);

    let y = 45;

    function titulo(secao: string) {
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text(secao, margin, y);
      y += 6;
      pdf.setDrawColor(...VERDE);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;
    }

    function linha(label: string, valor: any) {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(valor ?? "-"), margin + 75, y);
      y += 8;
    }

    titulo("1. Dados da Sondagem");
    linha("Sondagem:", data.nome_sondagem);
    linha("Data:", data.data);
    linha("Hora:", data.hora);
    linha("Tipo:", data.tipo_sondagem);
    linha("Nível d'água (m):", data.nivel_agua);
    linha("Profundidade total (m):", data.profundidade_total);

    y += 5;

    titulo("2. Construção do Poço");
    linha("Diâmetro sondagem:", data.diametro_sondagem);
    linha("Diâmetro poço:", data.diametro_poco);
    linha("Comprimento seção filtrante (m):", data.secao_filtrante);

    y += 5;

    titulo("3. Coordenadas");
    linha("Coord X:", data.coord_x);
    linha("Coord Y:", data.coord_y);

    /* ---------- PÁGINA 2 - TABELA ---------- */

    pdf.addPage();

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("4. Camadas Estratigráficas", margin, 20);

    let yTable = 30;

    const col1 = margin;
    const col2 = margin + 30;
    const col3 = margin + 60;
    const colWidth1 = 30;
    const colWidth2 = 30;
    const colWidth3 = pageWidth - margin * 2 - 60;

    function header() {
      pdf.setFillColor(...VERDE);
      pdf.rect(col1, yTable, colWidth1, 8, "F");
      pdf.rect(col2, yTable, colWidth2, 8, "F");
      pdf.rect(col3, yTable, colWidth3, 8, "F");

      pdf.setTextColor(255);
      pdf.text("De (m)", col1 + 5, yTable + 5);
      pdf.text("Até (m)", col2 + 5, yTable + 5);
      pdf.text("Descrição", col3 + 5, yTable + 5);
      pdf.setTextColor(0);

      yTable += 8;
    }

    header();

    let profAnterior = 0;

    layers.forEach((l, index) => {
      if (yTable > pageHeight - 15) {
        pdf.addPage();
        yTable = 20;
        header();
      }

      const profAtual = parseFloat(l.profundidade);

      if (index % 2 === 0) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(col1, yTable, colWidth1 + colWidth2 + colWidth3, 8, "F");
      }

      pdf.rect(col1, yTable, colWidth1, 8);
      pdf.rect(col2, yTable, colWidth2, 8);
      pdf.rect(col3, yTable, colWidth3, 8);

      pdf.text(profAnterior.toFixed(2), col1 + 5, yTable + 5);
      pdf.text(profAtual.toFixed(2), col2 + 5, yTable + 5);
      pdf.text(l.tipo, col3 + 5, yTable + 5);

      profAnterior = profAtual;
      yTable += 8;
    });

    /* ---------- PÁGINA 3 - PERFIL ---------- */

    pdf.addPage();

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Perfil Estratigráfico", pageWidth / 2, 20, {
      align: "center",
    });

    const topo = 30;
    const alturaMax = 170;
    const larguraPerfil = 40;

    const centro = pageWidth / 2;
    const esquerdaPerfil = centro - larguraPerfil / 2;
    const direitaPerfil = centro + larguraPerfil / 2;

    const profundidadeTotal = parseFloat(data.profundidade_total || "1");
    const escala = alturaMax / profundidadeTotal;

    pdf.setFontSize(8);
    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
      const yEscala = topo + i * escala;
      pdf.line(esquerdaPerfil - 6, yEscala, esquerdaPerfil, yEscala);
      pdf.text(`${i.toFixed(1)} m`, esquerdaPerfil - 25, yEscala + 2);
    }

    let profAnt = 0;

    layers.forEach((l) => {
      const profAtual = parseFloat(l.profundidade);
      const altura = (profAtual - profAnt) * escala;
      const yCamada = topo + profAnt * escala;

      pdf.setFillColor(200, 180, 140);
      pdf.rect(esquerdaPerfil, yCamada, larguraPerfil, altura, "F");

      profAnt = profAtual;
    });

    pdf.setDrawColor(0);
    pdf.rect(esquerdaPerfil, topo, larguraPerfil, alturaMax);

    if (data.nivel_agua) {
      const nivel = parseFloat(data.nivel_agua);
      const yNivel = topo + nivel * escala;
      pdf.setDrawColor(0, 0, 255);
      pdf.setLineWidth(1);
      pdf.line(esquerdaPerfil - 10, yNivel, direitaPerfil + 10, yNivel);
    }

    if (data.secao_filtrante) {
      const comprimento = parseFloat(data.secao_filtrante);
      const inicio = profundidadeTotal - comprimento;
      const yInicio = topo + inicio * escala;
      const yFim = topo + profundidadeTotal * escala;

      for (let i = yInicio; i < yFim; i += 3) {
        pdf.line(centro - 6, i, centro + 6, i);
      }
    }

    pdf.save(`perfil_${data.nome_sondagem}.pdf`);
  }

  /* ================= DESKTOP (CONGELADO) ================= */

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

  function Info({ label, value }: { label: string; value: any }) {
    return (
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-base font-semibold">{value || "-"}</p>
      </div>
    );
  }

  return (
    <AdminShell>
      <div className="space-y-10">

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              Perfil Descritivo
            </h1>
            <p className="text-gray-500 text-sm">
              Visualização técnica executiva
            </p>
          </div>

          <Button onClick={gerarPDF} className="bg-primary text-white">
            Baixar PDF
          </Button>
        </div>

        <Card className="shadow-md border-0">
          <CardContent className="p-8 grid md:grid-cols-4 gap-6">
            <Info label="Sondagem" value={data.nome_sondagem} />
            <Info label="Data" value={data.data} />
            <Info label="Profundidade Total" value={data.profundidade_total} />
            <Info label="Nível d'água" value={data.nivel_agua} />
          </CardContent>
        </Card>

        <Card className="shadow-md border-0">
          <CardContent className="p-8">
            <h2 className="text-xl font-bold text-primary mb-6">
              Construção do Poço
            </h2>
            <div className="grid md:grid-cols-4 gap-6">
              <Info label="Diâmetro sondagem" value={data.diametro_sondagem} />
              <Info label="Diâmetro poço" value={data.diametro_poco} />
              <Info label="Pré-filtro" value={data.pre_filtro} />
              <Info label="Seção filtrante" value={data.secao_filtrante} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-0">
          <CardContent className="p-8">
            <h2 className="text-xl font-bold text-primary mb-6">
              Coordenadas
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Info label="Coord X" value={data.coord_x} />
              <Info label="Coord Y" value={data.coord_y} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-0">
          <CardContent className="p-8">
            <h2 className="text-xl font-bold text-primary mb-6">
              Camadas Estratigráficas
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="p-3 text-left">De (m)</th>
                    <th className="p-3 text-left">Até (m)</th>
                    <th className="p-3 text-left">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {layers.map((l, index) => {
                    const profAnterior =
                      index === 0
                        ? 0
                        : parseFloat(layers[index - 1].profundidade);

                    return (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
                      >
                        <td className="p-3 border">
                          {profAnterior.toFixed(2)}
                        </td>
                        <td className="p-3 border">
                          {parseFloat(l.profundidade).toFixed(2)}
                        </td>
                        <td className="p-3 border font-medium">{l.tipo}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </AdminShell>
  );
}