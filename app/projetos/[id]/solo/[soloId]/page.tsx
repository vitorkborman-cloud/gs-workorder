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

  /* =====================================================
     PDF PROFISSIONAL
  ====================================================== */

  async function gerarPDF() {
    if (!data) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    /* HEADER */
    pdf.setFillColor(57, 30, 42);
    pdf.rect(0, 0, pageWidth, 25, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.text("GS WORK ORDER - RELATÓRIO TÉCNICO", pageWidth / 2, 15, { align: "center" });

    pdf.setTextColor(0);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("PERFIL DESCRITIVO DE SOLO", pageWidth / 2, 40, { align: "center" });

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
    campo("Seção filtrante:", data.secao_filtrante);

    y += 8;

    pdf.setFont("helvetica", "bold");
    pdf.text("3. Coordenadas", margin, y);
    y += 8;

    campo("Coord X:", data.coord_x);
    campo("Coord Y:", data.coord_y);

    /* ===== TABELA REAL ===== */

    y += 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("4. Camadas Estratigráficas", margin, y);
    y += 8;

    const col1 = margin;
    const col2 = margin + 30;
    const col3 = margin + 60;

    pdf.text("De (m)", col1, y);
    pdf.text("Até (m)", col2, y);
    pdf.text("Descrição", col3, y);
    y += 5;

    pdf.setFont("helvetica", "normal");

    let profAnterior = 0;

    layers.forEach((l) => {
      const profAtual = parseFloat(l.profundidade);

      pdf.text(profAnterior.toString(), col1, y);
      pdf.text(profAtual.toString(), col2, y);
      pdf.text(l.tipo, col3, y);

      y += 6;
      profAnterior = profAtual;
    });

    /* ================= PERFIL ================= */

    pdf.addPage();

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Perfil Estratigráfico", pageWidth / 2, 20, { align: "center" });

    const topo = 30;
    const alturaMax = 170;
    const larguraPerfil = 40;

    const centro = pageWidth / 2;
    const esquerdaPerfil = centro - larguraPerfil / 2;
    const direitaPerfil = centro + larguraPerfil / 2;

    const profundidadeTotal = parseFloat(data.profundidade_total || "1");
    const escala = alturaMax / profundidadeTotal;

    /* ESCALA */
    pdf.setFontSize(8);
    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
      const yEscala = topo + i * escala;
      pdf.line(esquerdaPerfil - 6, yEscala, esquerdaPerfil, yEscala);
      pdf.text(`${i.toFixed(1)} m`, esquerdaPerfil - 25, yEscala + 2);
    }

    /* CAMADAS */
    let profAnt = 0;

    layers.forEach((l) => {
      const profAtual = parseFloat(l.profundidade);
      const altura = (profAtual - profAnt) * escala;
      const yCamada = topo + profAnt * escala;

      pdf.setFillColor(210, 200, 180);
      pdf.rect(esquerdaPerfil, yCamada, larguraPerfil, altura, "F");

      profAnt = profAtual;
    });

    pdf.rect(esquerdaPerfil, topo, larguraPerfil, alturaMax);

    /* TUBO */
    const larguraTubo = 12;
    const esquerdaTubo = centro - larguraTubo / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax, "F");
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax);

    /* SEÇÃO FILTRANTE REAL */
    if (data.secao_filtrante) {
      const inicioFiltro = parseFloat(data.secao_filtrante);

      if (!isNaN(inicioFiltro)) {
        const yInicio = topo + inicioFiltro * escala;
        const alturaFiltro = alturaMax - inicioFiltro * escala;

        for (let i = 0; i < alturaFiltro; i += 3) {
          pdf.line(
            esquerdaTubo,
            yInicio + i,
            esquerdaTubo + larguraTubo,
            yInicio + i
          );
        }

        pdf.rect(esquerdaTubo, yInicio, larguraTubo, alturaFiltro);
      }
    }

    /* NÍVEL D'ÁGUA CORRETO */
    if (data.nivel_agua) {
      const nivel = parseFloat(data.nivel_agua);
      if (!isNaN(nivel)) {
        const yNivel = topo + nivel * escala;
        pdf.setDrawColor(0, 0, 255);
        pdf.setLineWidth(1.2);
        pdf.line(esquerdaPerfil - 10, yNivel, direitaPerfil + 10, yNivel);
      }
    }

    pdf.save(`perfil_${data.nome_sondagem}.pdf`);
  }

  /* =====================================================
     DESKTOP MELHORADO
  ====================================================== */

  if (loading) return <AdminShell><p>Carregando...</p></AdminShell>;
  if (!data) return <AdminShell><p>Perfil não encontrado.</p></AdminShell>;

  return (
    <AdminShell>
      <div className="space-y-8">

        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-[#391e2a]">
            Perfil Descritivo
          </h1>
          <Button onClick={gerarPDF} className="bg-[#391e2a] text-white">
            Exportar Relatório PDF
          </Button>
        </div>

        <Card>
          <CardContent className="p-6 grid md:grid-cols-2 gap-8">
            <div>
              <h2 className="font-bold text-lg mb-3 text-[#391e2a]">
                Dados da Sondagem
              </h2>
              <p><strong>Sondagem:</strong> {data.nome_sondagem}</p>
              <p><strong>Data:</strong> {data.data}</p>
              <p><strong>Hora:</strong> {data.hora}</p>
              <p><strong>Nível d’água:</strong> {data.nivel_agua}</p>
              <p><strong>Profundidade total:</strong> {data.profundidade_total}</p>
            </div>

            <div>
              <h2 className="font-bold text-lg mb-3 text-[#391e2a]">
                Construção do Poço
              </h2>
              <p><strong>Diâmetro sondagem:</strong> {data.diametro_sondagem}</p>
              <p><strong>Diâmetro poço:</strong> {data.diametro_poco}</p>
              <p><strong>Pré-filtro:</strong> {data.pre_filtro}</p>
              <p><strong>Seção filtrante:</strong> {data.secao_filtrante}</p>
              <p><strong>Coord X:</strong> {data.coord_x}</p>
              <p><strong>Coord Y:</strong> {data.coord_y}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="font-bold text-lg mb-4 text-[#391e2a]">
              Camadas Hidroestratigráficas
            </h2>

            <table className="w-full border text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2">De (m)</th>
                  <th className="border p-2">Até (m)</th>
                  <th className="border p-2">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {layers.map((l, i) => {
                  const de = i === 0 ? 0 : layers[i - 1].profundidade;
                  return (
                    <tr key={i}>
                      <td className="border p-2">{de}</td>
                      <td className="border p-2">{l.profundidade}</td>
                      <td className="border p-2">{l.tipo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

      </div>
    </AdminShell>
  );
}