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

    /* ================= PÁGINA 1 – RELATÓRIO COMPLETO ================= */

    pdf.setFillColor(57, 30, 42);
    pdf.rect(0, 0, pageWidth, 25, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(13);
    pdf.text("GS WORK ORDER - RELATÓRIO TÉCNICO", pageWidth / 2, 15, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("PERFIL DESCRITIVO DE SOLO", pageWidth / 2, 40, { align: "center" });

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
    campo("Seção filtrante:", data.secao_filtrante);

    y += 8;

    pdf.setFont("helvetica", "bold");
    pdf.text("3. Coordenadas", margin, y);
    y += 8;

    campo("Coord X:", data.coord_x);
    campo("Coord Y:", data.coord_y);

    y += 10;

    pdf.setFont("helvetica", "bold");
    pdf.text("4. Camadas Estratigráficas", margin, y);
    y += 8;

    pdf.setFont("helvetica", "normal");

    let profAnterior = 0;
    layers.forEach((l) => {
      const profAtual = parseFloat(l.profundidade);
      pdf.text(`${profAnterior} – ${profAtual} m : ${l.tipo}`, margin, y);
      y += 6;
      profAnterior = profAtual;
    });

    /* ================= PÁGINA 2 – PERFIL ================= */

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

    pdf.setFontSize(8);
    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
      const yEscala = topo + i * escala;
      pdf.line(esquerdaPerfil - 6, yEscala, esquerdaPerfil, yEscala);
      pdf.text(`${i.toFixed(1)} m`, esquerdaPerfil - 25, yEscala + 2);
    }

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

    function gerarCor(nome: string): [number, number, number] {
      if (!mapaCores[nome]) {
        mapaCores[nome] = base[contadorCor % base.length];
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
      pdf.rect(esquerdaPerfil, yCamada, larguraPerfil, altura, "F");

      profAnt = profAtual;
    });

    pdf.setDrawColor(0);
    pdf.rect(esquerdaPerfil, topo, larguraPerfil, alturaMax);

    /* Tubo */

    const larguraTubo = 12;
    const esquerdaTubo = centro - larguraTubo / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax, "F");
    pdf.setDrawColor(0);
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax);

    /* Seção filtrante – ranhuras horizontais */

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

    pdf.rect(esquerdaTubo, topoFiltro, larguraTubo, alturaFiltro);

    /* Nível d’água */

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
      </div>
    </AdminShell>
  );
}