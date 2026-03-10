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

  function obterCorSolo(nome: string): [number, number, number] {
    const n = nome.toLowerCase();
    if (n.includes("argila")) return [170, 95, 70];
    if (n.includes("silte")) return [165, 165, 165];
    if (n.includes("areia")) return [230, 200, 120];
    if (n.includes("brita") || n.includes("rachão")) return [190, 170, 140];
    return [210, 180, 140];
  }

  async function gerarPDF() {
    if (!data) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;

    // --- Capa/Dados ---
    pdf.setFillColor(57, 30, 42);
    pdf.rect(0, 0, pageWidth, 25, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(13);
    pdf.text("GS WORK ORDER - RELATÓRIO TÉCNICO", pageWidth / 2, 15, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("PERFIL DESCRITIVO DE SOLO", pageWidth / 2, 40, { align: "center" });

    let y = 60;
    const campo = (label: string, valor: any) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(valor ?? "-"), margin + 60, y);
      y += 7;
    };

    campo("Sondagem:", data.nome_sondagem);
    campo("Data:", data.data);
    campo("Profundidade total:", data.profundidade_total);
    campo("Nível d'água:", data.nivel_agua);

    // --- Nova Página: Perfil ---
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Perfil Estratigráfico e do Poço", pageWidth / 2, 20, { align: "center" });

    const topo = 30;
    const alturaMax = 170;
    const larguraPerfil = 45;
    const centro = pageWidth / 2;
    const esquerdaPerfil = centro - larguraPerfil / 2;
    const direitaPerfil = centro + larguraPerfil / 2;
    const profundidadeTotal = parseFloat(data.profundidade_total || "1");
    const escala = alturaMax / profundidadeTotal;

    // 1. DESENHAR CAMADAS DE SOLO (BASE)
    let profAnt = 0;
    layers.forEach((l) => {
      const profAtu = parseFloat(l.profundidade);
      const h = (profAtu - profAnt) * escala;
      const yCamada = topo + (profAnt * escala);
      const [r, g, b] = obterCorSolo(l.tipo);

      pdf.setDrawColor(0);
      pdf.setFillColor(r, g, b);
      pdf.rect(esquerdaPerfil, yCamada, larguraPerfil, h, "F");
      profAnt = profAtu;
    });

    // 2. DESENHAR PRÉ-FILTRO (LATERAIS)
    const topoPref = parseFloat(data.pre_filtro);
    const larguraTubo = 14;
    const esquerdaTubo = centro - larguraTubo / 2;
    const espacoAnular = (larguraPerfil - larguraTubo) / 2;

    if (!isNaN(topoPref)) {
      const yIniPre = topo + (topoPref * escala);
      const hPre = (profundidadeTotal - topoPref) * escala;

      // Desenhar fundo do pré-filtro (bege areia)
      pdf.setFillColor(240, 230, 200);
      pdf.rect(esquerdaPerfil, yIniPre, espacoAnular, hPre, "F");
      pdf.rect(direitaPerfil - espacoAnular, yIniPre, espacoAnular, hPre, "F");

      // Textura de Pontos (Sem jitter excessivo para não borrar)
      pdf.setFillColor(80, 60, 40);
      for (let yd = yIniPre; yd < yIniPre + hPre; yd += 2) {
        for (let xd = esquerdaPerfil + 1; xd < esquerdaPerfil + espacoAnular - 1; xd += 2) {
            pdf.circle(xd, yd, 0.15, "F");
        }
        for (let xd = direitaPerfil - espacoAnular + 1; xd < direitaPerfil - 1; xd += 2) {
            pdf.circle(xd, yd, 0.15, "F");
        }
      }
    }

    // 3. DESENHAR TUBO (CENTRO BRANCO)
    pdf.setFillColor(255, 255, 255);
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax, "F");
    pdf.setDrawColor(0);
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax);

    // 4. SEÇÃO FILTRANTE (RANHURAS NO TUBO)
    const tFil = parseFloat(data.secao_filtrante_topo);
    const bFil = parseFloat(data.secao_filtrante_base);
    if (!isNaN(tFil) && !isNaN(bFil)) {
      const yTf = topo + (tFil * escala);
      const yBf = topo + (bFil * escala);
      const hF = yBf - yTf;

      for (let r = yTf + 1; r < yBf; r += 2.5) {
        pdf.setDrawColor(0);
        pdf.line(esquerdaTubo + 1, r, esquerdaTubo + larguraTubo - 1, r);
      }
    }

    // 5. NÍVEL D'ÁGUA (LINHA AZUL)
    if (data.nivel_agua) {
      const na = Number(String(data.nivel_agua).replace(",", "."));
      if (!isNaN(na)) {
        const yNa = topo + na * escala;
        pdf.setDrawColor(0, 0, 255);
        pdf.setLineWidth(0.8);
        pdf.line(esquerdaPerfil - 10, yNa, direitaPerfil + 10, yNa);
        pdf.setTextColor(0, 0, 255);
        pdf.setFontSize(10);
        pdf.text("N.A.", esquerdaPerfil - 18, yNa - 1);
      }
    }

    // 6. ESCALA E CONTORNO FINAL
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.5);
    pdf.rect(esquerdaPerfil, topo, larguraPerfil, alturaMax); // Contorno do furo

    pdf.setFontSize(8);
    pdf.setTextColor(0);
    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
        const yEsc = topo + i * escala;
        pdf.line(esquerdaPerfil - 4, yEsc, esquerdaPerfil, yEsc);
        pdf.text(`${i.toFixed(1)} m`, esquerdaPerfil - 15, yEsc + 1.5);
    }

    // LEGENDA
    let yL = topo;
    pdf.setFontSize(9);
    pdf.text("LEGENDA DE SOLOS", direitaPerfil + 15, yL - 5);
    let pL = 0;
    layers.forEach((l) => {
      const [r, g, b] = obterCorSolo(l.tipo);
      pdf.setFillColor(r, g, b);
      pdf.rect(direitaPerfil + 15, yL, 6, 6, "F");
      pdf.text(`${pL}-${l.profundidade}m: ${l.tipo}`, direitaPerfil + 23, yL + 4.5);
      yL += 8;
      pL = parseFloat(l.profundidade);
    });

    pdf.save(`perfil_tecnico.pdf`);
  }

  if (loading) return <AdminShell><p className="p-10">Carregando...</p></AdminShell>;

  return (
    <AdminShell>
      <div className="bg-gray-100 min-h-screen p-10">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Detalhes do Perfil</h1>
                <Button onClick={gerarPDF} className="bg-green-600 hover:bg-green-700 text-white">
                    Exportar PDF Corrigido
                </Button>
            </div>
            <pre className="bg-gray-50 p-4 rounded text-xs">{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    </AdminShell>
  );
}