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
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    const ROXO: [number, number, number] = [57, 30, 42];
    const VERDE: [number, number, number] = [128, 176, 45];

    /* ================= CABEÇALHO ================= */

    pdf.setFillColor(...ROXO);
    pdf.rect(0, 0, pageWidth, 25, "F");

    const logo = new Image();
    logo.src = "/logo.png";
    await new Promise((resolve) => (logo.onload = resolve));

    const logoWidth = 25;
    const logoHeight = (logo.height / logo.width) * logoWidth;

    pdf.addImage(logo, "PNG", margin, 6, logoWidth, logoHeight);

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.text(
      "GS WORK ORDER - RELATÓRIO TÉCNICO",
      pageWidth / 2,
      15,
      { align: "center" }
    );

    pdf.setTextColor(0, 0, 0);

    /* ================= TÍTULO ================= */

    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(
      "PERFIL DESCRITIVO DE SOLO",
      pageWidth / 2,
      40,
      { align: "center" }
    );

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");

    let y = 55;

    function campo(label: string, valor: any) {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(valor ?? "-"), margin + 65, y);
      y += 7;
    }

    /* ================= DADOS ================= */

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
    campo("Seção filtrante:", data.secao_filtrante);

    y += 8;

    pdf.setFont("helvetica", "bold");
    pdf.text("3. Coordenadas", margin, y);
    y += 8;

    campo("Coord X:", data.coord_x);
    campo("Coord Y:", data.coord_y);

    y += 12;

    /* ================= TABELA ESTRATIGRAFIA ================= */

    pdf.setFont("helvetica", "bold");
    pdf.text("4. Camadas Estratigráficas", margin, y);
    y += 8;

    const col1 = margin;
    const col2 = margin + 30;
    const col3 = margin + 60;
    const colWidth1 = 30;
    const colWidth2 = 30;
    const colWidth3 = pageWidth - margin * 2 - 60;

    pdf.setFillColor(...VERDE);
    pdf.rect(col1, y, colWidth1, 8, "F");
    pdf.rect(col2, y, colWidth2, 8, "F");
    pdf.rect(col3, y, colWidth3, 8, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.text("De (m)", col1 + 5, y + 5);
    pdf.text("Até (m)", col2 + 5, y + 5);
    pdf.text("Descrição", col3 + 5, y + 5);

    pdf.setTextColor(0, 0, 0);
    y += 8;

    let profAnterior = 0;

    layers.forEach((l, index) => {
      const profAtual = parseFloat(l.profundidade);

      if (index % 2 === 0) {
        pdf.setFillColor(240, 240, 240);
        pdf.rect(col1, y, colWidth1 + colWidth2 + colWidth3, 8, "F");
      }

      pdf.rect(col1, y, colWidth1, 8);
      pdf.rect(col2, y, colWidth2, 8);
      pdf.rect(col3, y, colWidth3, 8);

      pdf.text(profAnterior.toFixed(2), col1 + 5, y + 5);
      pdf.text(profAtual.toFixed(2), col2 + 5, y + 5);
      pdf.text(l.tipo, col3 + 5, y + 5);

      profAnterior = profAtual;
      y += 8;
    });

    /* ================= RODAPÉ PÁGINA 1 ================= */

    const hoje = new Date().toLocaleDateString("pt-BR");

    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`Emitido em ${hoje}`, margin, pageHeight - 10);
    pdf.text(`Página 1`, pageWidth - margin, pageHeight - 10, {
      align: "right",
    });

    /* ================= PÁGINA 2 – PERFIL ORIGINAL ================= */

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

    const profundidadeTotal = parseFloat(
      data.profundidade_total || "1"
    );
    const escala = alturaMax / profundidadeTotal;

    pdf.setFontSize(8);
    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
      const yEscala = topo + i * escala;
      pdf.line(esquerdaPerfil - 6, yEscala, esquerdaPerfil, yEscala);
      pdf.text(
        `${i.toFixed(1)} m`,
        esquerdaPerfil - 25,
        yEscala + 2
      );
    }

    const mapaCores: Record<string, [number, number, number]> =
      {};
    let contadorCor = 0;

    const base: [number, number, number][] = [
      [210, 180, 140],
      [170, 170, 170],
      [190, 110, 90],
      [220, 200, 120],
      [150, 150, 120],
      [200, 160, 120],
      [140, 140, 140],
    ];

    function gerarCor(nome: string): [number, number, number] {
      if (!mapaCores[nome]) {
        mapaCores[nome] =
          base[contadorCor % base.length];
        contadorCor++;
      }
      return mapaCores[nome];
    }

    let profAnt = 0;

    layers.forEach((l) => {
      const nome = l.tipo.trim();
      const profAtual = parseFloat(l.profundidade);

      const altura = (profAtual - profAnt) * escala;
      const yCamada = topo + profAnt * escala;

      const [r, g, b] = gerarCor(nome);
      pdf.setFillColor(r, g, b);
      pdf.rect(
        esquerdaPerfil,
        yCamada,
        larguraPerfil,
        altura,
        "F"
      );

      profAnt = profAtual;
    });

    pdf.setDrawColor(0);
    pdf.rect(
      esquerdaPerfil,
      topo,
      larguraPerfil,
      alturaMax
    );

    const larguraTubo = 12;
    const esquerdaTubo = centro - larguraTubo / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(
      esquerdaTubo,
      topo,
      larguraTubo,
      alturaMax,
      "F"
    );
    pdf.setDrawColor(0);
    pdf.rect(
      esquerdaTubo,
      topo,
      larguraTubo,
      alturaMax
    );

    const alturaFiltro = alturaMax * 0.3;
    const topoFiltro = topo + alturaMax - alturaFiltro;

    for (let i = 0; i < alturaFiltro; i += 3) {
      pdf.line(
        esquerdaTubo,
        topoFiltro + i,
        esquerdaTubo + larguraTubo,
        topoFiltro + i
      );
    }

    pdf.rect(
      esquerdaTubo,
      topoFiltro,
      larguraTubo,
      alturaFiltro
    );

    if (data.nivel_agua) {
      const nivel = parseFloat(data.nivel_agua);
      if (!isNaN(nivel)) {
        const yNivel = topo + nivel * escala;
        pdf.setDrawColor(0, 0, 255);
        pdf.setLineWidth(1.2);
        pdf.line(
          esquerdaPerfil - 10,
          yNivel,
          direitaPerfil + 10,
          yNivel
        );
      }
    }

    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(
      `Página 2`,
      pageWidth - margin,
      pageHeight - 10,
      { align: "right" }
    );

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
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-primary">
            Perfil Descritivo
          </h1>
          <Button
            onClick={gerarPDF}
            className="bg-primary text-white"
          >
            Baixar PDF
          </Button>
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="p-8 grid md:grid-cols-3 gap-6">
            {Object.entries({
              Sondagem: data.nome_sondagem,
              Data: data.data,
              Hora: data.hora,
              "Nível d'água": data.nivel_agua,
              Tipo: data.tipo_sondagem,
              "Diâmetro sondagem":
                data.diametro_sondagem,
              "Diâmetro poço": data.diametro_poco,
              "Pré-filtro": data.pre_filtro,
              "Seção filtrante":
                data.secao_filtrante,
              "Coord X": data.coord_x,
              "Coord Y": data.coord_y,
              "Profundidade total":
                data.profundidade_total,
            }).map(([label, value]) => (
              <div
                key={label}
                className="bg-white p-4 rounded-2xl shadow-sm border"
              >
                <p className="text-xs text-gray-500">
                  {label}
                </p>
                <p className="text-lg font-semibold text-gray-800">
                  {value || "-"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardContent className="p-8">
            <h2 className="text-xl font-bold text-primary mb-6">
              Camadas Estratigráficas
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="p-3 text-left">
                      De (m)
                    </th>
                    <th className="p-3 text-left">
                      Até (m)
                    </th>
                    <th className="p-3 text-left">
                      Descrição
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {layers.map((l, index) => {
                    const profAnterior =
                      index === 0
                        ? 0
                        : parseFloat(
                            layers[index - 1]
                              .profundidade
                          );

                    return (
                      <tr
                        key={index}
                        className={
                          index % 2 === 0
                            ? "bg-gray-50"
                            : "bg-white"
                        }
                      >
                        <td className="p-3 border">
                          {profAnterior.toFixed(2)}
                        </td>
                        <td className="p-3 border">
                          {parseFloat(
                            l.profundidade
                          ).toFixed(2)}
                        </td>
                        <td className="p-3 border font-medium">
                          {l.tipo}
                        </td>
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