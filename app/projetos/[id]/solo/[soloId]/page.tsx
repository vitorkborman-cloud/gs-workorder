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
     PDF EXECUTIVO + DESENHO TÉCNICO
  ====================================================== */

  async function gerarPDF() {
    if (!data) return;

    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let y = 30;

    /* CABEÇALHO INSTITUCIONAL */

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
    pdf.text("PERFIL DESCRITIVO DE SOLO", pageWidth / 2, y, {
      align: "center",
    });

    y += 12;

    pdf.setDrawColor(128, 176, 45);
    pdf.setLineWidth(1);
    pdf.line(margin, y, pageWidth - margin, y);

    y += 15;

    pdf.setFontSize(11);

    function campo(label: string, valor: any) {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, y);

      pdf.setFont("helvetica", "normal");
      pdf.text(String(valor ?? "-"), margin + 55, y);

      y += 7;

      if (y > pageHeight - 20) {
        pdf.addPage();
        y = 20;
      }
    }

    /* SEÇÕES */

    pdf.setFont("helvetica", "bold");
    pdf.text("1. Dados da Sondagem", margin, y);
    y += 10;

    campo("Sondagem:", data.nome_sondagem);
    campo("Data:", data.data);
    campo("Hora:", data.hora);
    campo("Tipo:", data.tipo_sondagem);
    campo("Nível d'água:", data.nivel_agua);
    campo("Profundidade total:", data.profundidade_total);

    y += 8;

    pdf.setFont("helvetica", "bold");
    pdf.text("2. Construção do Poço", margin, y);
    y += 10;

    campo("Diâmetro sondagem:", data.diametro_sondagem);
    campo("Diâmetro poço:", data.diametro_poco);
    campo("Pré-filtro:", data.pre_filtro);
    campo("Seção filtrante:", data.secao_filtrante);

    y += 8;

    pdf.setFont("helvetica", "bold");
    pdf.text("3. Coordenadas", margin, y);
    y += 10;

    campo("Coord X:", data.coord_x);
    campo("Coord Y:", data.coord_y);

    y += 10;

    /* TABELA DE CAMADAS */

    pdf.setFont("helvetica", "bold");
    pdf.text("4. Camadas Estratigráficas", margin, y);
    y += 8;

    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, y, pageWidth - margin * 2, 8, "F");

    pdf.setFontSize(10);
    pdf.text("Profundidade (m)", margin + 5, y + 5);
    pdf.text("Tipo de Solo", margin + 75, y + 5);

    y += 12;
    pdf.setFont("helvetica", "normal");

    if (layers.length === 0) {
      pdf.text("Nenhuma camada informada.", margin, y);
      y += 6;
    } else {
      layers.forEach((l) => {
        pdf.text(l.profundidade || "-", margin + 5, y);
        pdf.text(l.tipo || "-", margin + 75, y);
        y += 6;

        if (y > pageHeight - 20) {
          pdf.addPage();
          y = 20;
        }
      });
    }

    /* PAGINAÇÃO */

    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(
        `Página ${i} de ${totalPages}`,
        pageWidth - margin,
        pageHeight - 10,
        { align: "right" }
      );
    }

    /* =====================================================
       NOVA PÁGINA - DESENHO ILUSTRATIVO
    ====================================================== */

    pdf.addPage();

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Esquema Ilustrativo do Poço de Monitoramento", pageWidth / 2, 20, {
      align: "center",
    });

    const centerX = pageWidth / 2;
    const topo = 40;
    const altura = 150;
    const larguraSolo = 60;
    const larguraTubo = 20;

    /* Solo externo */
    pdf.setFillColor(220, 200, 150);
    pdf.rect(centerX - larguraSolo / 2, topo, larguraSolo, altura, "F");

    /* Tubo */
    pdf.setFillColor(180, 220, 255);
    pdf.rect(centerX - larguraTubo / 2, topo, larguraTubo, altura, "F");

    /* Filtro */
    pdf.setFillColor(255, 255, 150);
    pdf.rect(centerX - larguraTubo / 2, topo + 95, larguraTubo, 40, "F");

    /* Cap fundo */
    pdf.setFillColor(80, 80, 80);
    pdf.rect(centerX - larguraTubo / 2, topo + 135, larguraTubo, 8, "F");

    /* Nível d'água */
    pdf.setDrawColor(0, 100, 200);
    pdf.setLineWidth(1);
    pdf.line(centerX - larguraSolo / 2 - 10, topo + 80, centerX + larguraSolo / 2 + 10, topo + 80);
    pdf.setFontSize(9);
    pdf.text("N.A.", centerX + larguraSolo / 2 + 12, topo + 82);

    /* LEGENDAS */

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    function legenda(texto: string, yPos: number) {
      pdf.text(texto, centerX - 90, yPos);
      pdf.line(centerX - 10, yPos - 2, centerX - larguraTubo / 2, yPos - 2);
    }

    legenda("Tampa / Lacre", topo + 5);
    legenda("Tubo PVC Geomecânico", topo + 40);
    legenda("Filtro", topo + 110);
    legenda("Pré-Filtro", topo + 125);
    legenda("Cap de Fundo", topo + 140);

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