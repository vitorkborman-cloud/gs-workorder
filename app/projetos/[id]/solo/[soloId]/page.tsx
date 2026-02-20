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
    const margin = 20;

    /* ==============================
       PÁGINA 1 – RELATÓRIO
    ============================== */

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

    /* ==============================
       PÁGINA 2 – PERFIL ESTRATIGRÁFICO
    ============================== */

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

    /* ===== ESCALA ===== */

    pdf.setFontSize(8);
    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
      const yEscala = topo + i * escala;
      pdf.line(esquerdaPerfil - 6, yEscala, esquerdaPerfil, yEscala);
      pdf.text(`${i.toFixed(1)} m`, esquerdaPerfil - 25, yEscala + 2);
    }

    /* ===== MAPA DE CORES RIGOROSO ===== */

    const mapaCores: Record<string, [number, number, number]> = {};
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

    function gerarCorUnica(nome: string): [number, number, number] {
      if (!mapaCores[nome]) {
        mapaCores[nome] = base[contadorCor % base.length];
        contadorCor++;
      }
      return mapaCores[nome];
    }

    /* ===== CAMADAS (SEM TEXTURA) ===== */

    let profundidadeAnterior = 0;

    layers.forEach((layer) => {
      const nomeChave = layer.tipo.trim();
      const profAtual = parseFloat(layer.profundidade);

      const alturaCamada = (profAtual - profundidadeAnterior) * escala;
      const y = topo + profundidadeAnterior * escala;

      const [r, g, b] = gerarCorUnica(nomeChave);

      pdf.setFillColor(r, g, b);
      pdf.rect(esquerdaPerfil, y, larguraPerfil, alturaCamada, "F");

      profundidadeAnterior = profAtual;
    });

    pdf.setDrawColor(0);
    pdf.rect(esquerdaPerfil, topo, larguraPerfil, alturaMax);

    /* ===== TUBO CENTRAL ===== */

    const larguraTubo = 12;
    const esquerdaTubo = centro - larguraTubo / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0);
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax, "FD");

    /* ===== SEÇÃO FILTRANTE ===== */

    const alturaFiltro = alturaMax * 0.3;
    const topoFiltro = topo + alturaMax - alturaFiltro;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(esquerdaTubo, topoFiltro, larguraTubo, alturaFiltro, "F");

    pdf.setDrawColor(0);
    for (let i = 2; i < larguraTubo; i += 2) {
      pdf.line(
        esquerdaTubo + i,
        topoFiltro,
        esquerdaTubo + i,
        topoFiltro + alturaFiltro
      );
    }

    pdf.rect(esquerdaTubo, topoFiltro, larguraTubo, alturaFiltro);

    /* ===== NÍVEL D’ÁGUA ===== */

    if (data.nivel_agua) {
      const nivel = parseFloat(data.nivel_agua);

      if (!isNaN(nivel) && nivel <= profundidadeTotal) {
        const yNivel = topo + nivel * escala;

        pdf.setDrawColor(0, 0, 255);
        pdf.setLineWidth(1.2);

        pdf.line(
          esquerdaPerfil - 10,
          yNivel,
          direitaPerfil + 10,
          yNivel
        );

        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 255);
        pdf.text("N.A.", direitaPerfil + 12, yNivel + 2);

        pdf.setTextColor(0);
      }
    }

    /* ===== LEGENDA ===== */

    let yLegenda = topo;
    profundidadeAnterior = 0;

    pdf.setFontSize(9);

    layers.forEach((layer) => {
      const nomeChave = layer.tipo.trim();
      const profAtual = parseFloat(layer.profundidade);

      const [r, g, b] = gerarCorUnica(nomeChave);

      pdf.setFillColor(r, g, b);
      pdf.rect(direitaPerfil + 15, yLegenda, 8, 8, "F");

      pdf.setTextColor(0);
      pdf.text(
        `${profundidadeAnterior} – ${profAtual} m : ${layer.tipo}`,
        direitaPerfil + 28,
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