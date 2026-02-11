"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AppShell from "../../../../../components/AppShell";
import Card from "../../../../../components/Card";
import Button from "../../../../../components/Button";
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
    let y = 20;

    // ===== CORES =====
    pdf.setDrawColor(57, 30, 42); // roxo
    pdf.setTextColor(57, 30, 42);

    // ===== LOGO =====
    const logo = new Image();
    logo.src = "/logo.png";

    await new Promise((resolve) => {
      logo.onload = resolve;
    });

    pdf.addImage(logo, "PNG", 10, 8, 30, 15);

    // ===== TÍTULO =====
    pdf.setFontSize(16);
    pdf.text("RELATÓRIO – DESCRIÇÃO DE SOLO", pageWidth / 2, 15, {
      align: "center",
    });

    y = 30;

    // ===== SUBTÍTULO =====
    pdf.setFontSize(12);
    pdf.text(`Sondagem: ${data.nome_sondagem}`, 10, y);
    y += 8;

    pdf.setLineWidth(0.5);
    pdf.line(10, y, pageWidth - 10, y);
    y += 6;

    // ===== DADOS GERAIS =====
    pdf.setFontSize(11);

    const campos = [
      ["Data", data.data],
      ["Hora", data.hora],
      ["Nível d'água (m)", data.nivel_agua],
      ["Tipo de sondagem", data.tipo_sondagem],
      ["Diâmetro sondagem (in)", data.diametro_sondagem],
      ["Diâmetro poço (in)", data.diametro_poco],
      ["Pré-filtro", data.pre_filtro],
      ["Seção filtrante", data.secao_filtrante],
      ["Coordenada X", data.coord_x],
      ["Coordenada Y", data.coord_y],
      ["Profundidade total", data.profundidade_total],
    ];

    campos.forEach(([label, value]) => {
      pdf.text(`${label}: ${value || "-"}`, 10, y);
      y += 6;

      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
    });

    // ===== CAMADAS =====
    y += 4;
    pdf.setFontSize(13);
    pdf.setTextColor(128, 176, 45); // verde
    pdf.text("Camadas de Solo", 10, y);
    y += 8;

    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);

    layers.forEach((layer, index) => {
      pdf.text(
        `${index + 1}. Profundidade: ${layer.profundidade} m | Solo: ${layer.tipo}`,
        10,
        y
      );
      y += 6;

      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
    });

    // ===== RODAPÉ =====
    const totalPages = pdf.getNumberOfPages();
    const dataGeracao = new Date().toLocaleDateString("pt-BR");

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(
        `Gerado em ${dataGeracao} | Página ${i} de ${totalPages}`,
        pageWidth / 2,
        290,
        { align: "center" }
      );
    }

    pdf.save(`descricao_solo_${data.nome_sondagem}.pdf`);
  }

  if (loading) {
    return (
      <AppShell>
        <p>Carregando...</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Card title={`Sondagem: ${data.nome_sondagem}`}>
        <div className="mb-6">
          <Button text="Gerar PDF" onClick={gerarPDF} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries({
            "Data": data.data,
            "Hora": data.hora,
            "Nível d’água (m)": data.nivel_agua,
            "Tipo de sondagem": data.tipo_sondagem,
            "Diâmetro sondagem (in)": data.diametro_sondagem,
            "Diâmetro poço (in)": data.diametro_poco,
            "Pré-filtro": data.pre_filtro,
            "Seção filtrante": data.secao_filtrante,
            "Coordenada X": data.coord_x,
            "Coordenada Y": data.coord_y,
            "Profundidade": data.profundidade_total,
          }).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="font-bold">{value || "-"}</p>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
