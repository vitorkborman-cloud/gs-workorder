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

  /* ================= PDF EXECUTIVO ================= */

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

    // Logo pequeno mantendo proporção
    const logo = new Image();
    logo.src = "/logo.png";

    await new Promise((resolve) => {
      logo.onload = resolve;
    });

    const logoWidth = 25;
    const logoHeight = (logo.height / logo.width) * logoWidth;

    pdf.addImage(
      logo,
      "PNG",
      margin,
      6,
      logoWidth,
      logoHeight
    );

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

    // Cabeçalho
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

    /* ================= RODAPÉ ================= */

    const hoje = new Date().toLocaleDateString("pt-BR");

    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(
      `Emitido em ${hoje}`,
      margin,
      pageHeight - 10
    );

    pdf.text(
      `Página 1`,
      pageWidth - margin,
      pageHeight - 10,
      { align: "right" }
    );

    pdf.save(`perfil_${data.nome_sondagem}.pdf`);
  }

  /* ================= DESKTOP EXECUTIVO ================= */

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
          <Button onClick={gerarPDF} className="bg-primary text-white">
            Baixar PDF
          </Button>
        </div>

        {/* CARD PRINCIPAL */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-8 grid md:grid-cols-3 gap-6">
            {Object.entries({
              Sondagem: data.nome_sondagem,
              Data: data.data,
              Hora: data.hora,
              "Nível d'água": data.nivel_agua,
              Tipo: data.tipo_sondagem,
              "Diâmetro sondagem": data.diametro_sondagem,
              "Diâmetro poço": data.diametro_poco,
              "Pré-filtro": data.pre_filtro,
              "Seção filtrante": data.secao_filtrante,
              "Coord X": data.coord_x,
              "Coord Y": data.coord_y,
              "Profundidade total": data.profundidade_total,
            }).map(([label, value]) => (
              <div
                key={label}
                className="bg-white p-4 rounded-2xl shadow-sm border"
              >
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-semibold text-gray-800">
                  {value || "-"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}