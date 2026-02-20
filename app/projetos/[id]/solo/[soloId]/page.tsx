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

  function corPorTipo(tipo: string) {
    const t = tipo.toLowerCase();

    if (t.includes("areia")) return [240, 220, 130];
    if (t.includes("argila")) return [180, 100, 80];
    if (t.includes("silte")) return [170, 170, 170];
    if (t.includes("cascalho")) return [200, 170, 120];
    if (t.includes("rocha")) return [120, 120, 120];

    return [150, 200, 150];
  }

  async function gerarPDF() {
    if (!data) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    /* ===============================
       PÁGINA 1 – RELATÓRIO
    =============================== */

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

    pdf.text(`Sondagem: ${data.nome_sondagem}`, margin, 60);
    pdf.text(`Data: ${data.data}`, margin, 68);
    pdf.text(`Profundidade total: ${data.profundidade_total} m`, margin, 76);

    /* ===============================
       PÁGINA 2 – PERFIL ESTRATIGRÁFICO
    =============================== */

    pdf.addPage();

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Perfil Estratigráfico", pageWidth / 2, 20, {
      align: "center",
    });

    const topo = 30;
    const alturaMax = 160;
    const largura = 40;
    const centro = pageWidth / 2;

    const profundidadeTotal = parseFloat(data.profundidade_total || "1");
    const escala = alturaMax / profundidadeTotal;

    let profundidadeAnterior = 0;

    layers.forEach((layer) => {
      const profAtual = parseFloat(layer.profundidade);
      const alturaCamada = (profAtual - profundidadeAnterior) * escala;

      const y = topo + profundidadeAnterior * escala;

      const [r, g, b] = corPorTipo(layer.tipo);
      pdf.setFillColor(r, g, b);

      pdf.rect(centro - largura / 2, y, largura, alturaCamada, "F");

      profundidadeAnterior = profAtual;
    });

    pdf.setDrawColor(0);
    pdf.rect(centro - largura / 2, topo, largura, alturaMax);

    /* ESCALA LATERAL */

    pdf.setFontSize(9);
    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
      const yEscala = topo + i * escala;
      pdf.line(centro - largura / 2 - 5, yEscala, centro - largura / 2, yEscala);
      pdf.text(`${i.toFixed(1)} m`, centro - largura / 2 - 25, yEscala + 2);
    }

    /* LEGENDA */

    let yLegenda = topo;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    profundidadeAnterior = 0;

    layers.forEach((layer) => {
      const profAtual = parseFloat(layer.profundidade);
      const [r, g, b] = corPorTipo(layer.tipo);

      pdf.setFillColor(r, g, b);
      pdf.rect(30, yLegenda, 8, 8, "F");

      pdf.setTextColor(0);
      pdf.text(
        `${profundidadeAnterior} – ${profAtual} m : ${layer.tipo}`,
        42,
        yLegenda + 6
      );

      yLegenda += 12;
      profundidadeAnterior = profAtual;
    });

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
              "Profundidade total": data.profundidade_total,
            }).map(([label, value]) => (
              <div key={label}>
                <p className="text-sm opacity-70">{label}</p>
                <p className="font-semibold">{value || "-"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}