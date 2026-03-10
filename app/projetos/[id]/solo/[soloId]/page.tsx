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

  /* ================= LÓGICA DE CORES AUTOMÁTICAS ================= */
  function obterCorSolo(nome: string): [number, number, number] {
    const n = nome.toLowerCase();
    if (n.includes("argila")) {
      if (n.includes("silt")) return [185, 120, 95];
      if (n.includes("aren")) return [200, 140, 90];
      return [170, 95, 70];
    }
    if (n.includes("silte")) {
      if (n.includes("aren")) return [175, 175, 175];
      if (n.includes("argil")) return [155, 155, 155];
      return [165, 165, 165];
    }
    if (n.includes("areia")) {
      if (n.includes("fina")) return [235, 210, 140];
      if (n.includes("grossa")) return [220, 190, 110];
      return [230, 200, 120];
    }
    if (n.includes("orgânica")) return [60, 60, 60];
    if (n.includes("turfa")) return [40, 40, 40];
    if (n.includes("cascalho")) return [120, 120, 120];
    return [210, 180, 140];
  }

  async function gerarPDF() {
    if (!data) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;

    // --- Cabeçalho ---
    pdf.setFillColor(57, 30, 42);
    pdf.rect(0, 0, pageWidth, 25, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(13);
    pdf.text("GS WORK ORDER - RELATÓRIO TÉCNICO", pageWidth / 2, 15, { align: "center" });

    // --- Título ---
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

    pdf.setFontSize(11);
    pdf.text("1. Dados da Sondagem", margin, y);
    y += 8;
    campo("Sondagem:", data.nome_sondagem);
    campo("Data:", data.data);
    campo("Tipo:", data.tipo_sondagem);
    campo("Nível d'água:", data.nivel_agua);
    campo("Profundidade total:", data.profundidade_total);

    y += 8;
    pdf.setFont("helvetica", "bold");
    pdf.text("2. Construção do Poço", margin, y);
    y += 8;
    campo("Diâmetro sondagem:", data.diametro_sondagem);
    campo("Diâmetro poço:", data.diametro_poco);
    campo("Pré-filtro (topo):", data.pre_filtro);
    campo("Seção filtrante:", `${data.secao_filtrante_topo ?? "-"} - ${data.secao_filtrante_base ?? "-"}`);

    /* ================= PÁGINA 2: TABELA ESTRATIGRÁFICA ================= */
    pdf.addPage();
    y = 30;
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("4. Camadas Estratigráficas", margin, y);
    y += 10;

    const col1 = margin, col2 = margin + 35, col3 = margin + 70;
    const larguraTabela = pageWidth - margin * 2;
    const alturaLinha = 8;

    pdf.setFillColor(128, 176, 45);
    pdf.rect(col1, y, larguraTabela, alturaLinha, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.text("De (m)", col1 + 3, y + 5.5);
    pdf.text("Até (m)", col2 + 3, y + 5.5);
    pdf.text("Tipo de Solo", col3 + 3, y + 5.5);

    y += alturaLinha;
    pdf.setTextColor(0);
    pdf.setFont("helvetica", "normal");

    let profAnterior = 0;
    layers.forEach((l, index) => {
      const profAtual = parseFloat(l.profundidade);
      if (index % 2 === 0) {
        pdf.setFillColor(230, 242, 214);
        pdf.rect(col1, y, larguraTabela, alturaLinha, "F");
      }
      pdf.text(String(profAnterior), col1 + 3, y + 5.5);
      pdf.text(String(profAtual), col2 + 3, y + 5.5);
      pdf.text(l.tipo, col3 + 3, y + 5.5);
      pdf.rect(col1, y, larguraTabela, alturaLinha);
      y += alturaLinha;
      profAnterior = profAtual;
    });

    /* ================= PÁGINA 3: PERFIL GRÁFICO TÉCNICO ================= */
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Perfil Estratigráfico e do Poço", pageWidth / 2, 20, { align: "center" });

    const topo = 30, alturaMax = 170, larguraPerfil = 40;
    const centro = pageWidth / 2;
    const esquerdaPerfil = centro - larguraPerfil / 2;
    const direitaPerfil = centro + larguraPerfil / 2;
    const profundidadeTotal = parseFloat(data.profundidade_total || "1");
    const escala = alturaMax / profundidadeTotal;

    // Escala lateral
    pdf.setFontSize(8);
    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
      const yEscala = topo + i * escala;
      pdf.setDrawColor(200);
      pdf.line(esquerdaPerfil - 6, yEscala, esquerdaPerfil, yEscala);
      pdf.text(`${i.toFixed(1)} m`, esquerdaPerfil - 20, yEscala + 2);
    }

    // Desenho das camadas de Solo
    let profAntCamada = 0;
    layers.forEach((l) => {
      const profAtual = parseFloat(l.profundidade);
      const alturaCamada = (profAtual - profAntCamada) * escala;
      const yCamada = topo + profAntCamada * escala;
      const [r, g, b] = obterCorSolo(l.tipo);

      pdf.setFillColor(r, g, b);
      pdf.rect(esquerdaPerfil, yCamada, larguraPerfil, alturaCamada, "F");

      // Textura de areia se aplicável
      if (l.tipo.toLowerCase().includes("areia")) {
        pdf.setFillColor(0, 0, 0, 0.2);
        for (let yd = yCamada + 1; yd < yCamada + alturaCamada; yd += 3) {
          for (let xd = esquerdaPerfil + 1; xd < esquerdaPerfil + larguraPerfil; xd += 3) {
            pdf.circle(xd, yd, 0.2, "F");
          }
        }
      }
      profAntCamada = profAtual;
    });

    // Borda do furo
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.5);
    pdf.rect(esquerdaPerfil, topo, larguraPerfil, alturaMax);

    /* ================= ESTRUTURA DO POÇO (PRÉ-FILTRO MELHORADO) ================= */
    const larguraTubo = 12;
    const larguraAnular = (larguraPerfil - larguraTubo) / 2;
    const esquerdaTubo = centro - larguraTubo / 2;
    const topoPrefiltroVal = parseFloat(data.pre_filtro);

    if (!isNaN(topoPrefiltroVal)) {
      const yIniPre = topo + topoPrefiltroVal * escala;
      const altPre = (profundidadeTotal - topoPrefiltroVal) * escala;

      // Fundo do pré-filtro
      pdf.setFillColor(245, 235, 220);
      pdf.rect(esquerdaPerfil, yIniPre, larguraAnular, altPre, "F");
      pdf.rect(direitaPerfil - larguraAnular, yIniPre, larguraAnular, altPre, "F");

      // Textura Orgânica de Brita/Grãos
      pdf.setFillColor(80, 60, 40);
      for (let yd = yIniPre; yd < yIniPre + altPre; yd += 2.2) {
        // Lado Esquerdo
        for (let xd = esquerdaPerfil + 1; xd < esquerdaPerfil + larguraAnular - 1; xd += 2.5) {
          pdf.circle(xd + Math.random(), yd + Math.random(), 0.18, "F");
        }
        // Lado Direito
        for (let xd = direitaPerfil - larguraAnular + 1; xd < direitaPerfil - 1; xd += 2.5) {
          pdf.circle(xd + Math.random(), yd + Math.random(), 0.18, "F");
        }
      }
    }

    // Tubo e Seção Filtrante
    const tFiltro = parseFloat(data.secao_filtrante_topo);
    const bFiltro = parseFloat(data.secao_filtrante_base);

    if (!isNaN(tFiltro) && !isNaN(bFiltro)) {
      const yTf = topo + tFiltro * escala;
      const yBf = topo + bFiltro * escala;

      // Tubo Liso Superior
      pdf.setFillColor(255, 255, 255);
      pdf.rect(esquerdaTubo, topo, larguraTubo, yTf - topo, "F");
      pdf.rect(esquerdaTubo, topo, larguraTubo, yTf - topo);

      // Seção Filtrante (Ranhuras)
      pdf.setFillColor(255, 255, 255);
      pdf.rect(esquerdaTubo, yTf, larguraTubo, yBf - yTf, "F");
      pdf.rect(esquerdaTubo, yTf, larguraTubo, yBf - yTf);
      for (let r = yTf + 1.5; r < yBf; r += 2.5) {
        pdf.setLineWidth(0.2);
        pdf.line(esquerdaTubo + 1, r, esquerdaTubo + larguraTubo - 1, r);
      }

      // Ponta de Decantação
      if (profundidadeTotal > bFiltro) {
        pdf.rect(esquerdaTubo, yBf, larguraTubo, (profundidadeTotal - bFiltro) * escala, "F");
        pdf.rect(esquerdaTubo, yBf, larguraTubo, (profundidadeTotal - bFiltro) * escala);
      }
    }

    // Nível d'água
    if (data.nivel_agua) {
      const na = Number(String(data.nivel_agua).replace(",", "."));
      if (!isNaN(na)) {
        const yNa = topo + na * escala;
        pdf.setDrawColor(0, 0, 255);
        pdf.setLineWidth(1);
        pdf.line(esquerdaPerfil - 12, yNa, direitaPerfil + 12, yNa);
        pdf.setTextColor(0, 0, 255);
        pdf.text("N.A.", esquerdaPerfil - 18, yNa - 1);
      }
    }

    // Legenda lateral
    let yL = topo;
    pdf.setFontSize(9);
    pdf.setTextColor(0);
    pdf.setFont("helvetica", "bold");
    pdf.text("LEGENDA DE SOLOS", direitaPerfil + 20, yL - 5);
    let pL = 0;
    layers.forEach((l) => {
      const [r, g, b] = obterCorSolo(l.tipo);
      pdf.setFillColor(r, g, b);
      pdf.rect(direitaPerfil + 20, yL, 6, 6, "F");
      pdf.setFont("helvetica", "normal");
      pdf.text(`${pL}-${l.profundidade}m: ${l.tipo}`, direitaPerfil + 28, yL + 4.5);
      yL += 9;
      pL = parseFloat(l.profundidade);
    });

    pdf.save(`relatorio_${data.nome_sondagem}.pdf`);
  }

  if (loading) return <AdminShell><p className="p-10 text-center">Carregando dados técnicos...</p></AdminShell>;
  if (!data) return <AdminShell><p className="p-10 text-center text-red-500">Perfil não localizado.</p></AdminShell>;

  return (
    <AdminShell>
      <div className="bg-gray-100 min-h-screen pb-12">
        <div className="bg-[#391e2a] text-white px-10 py-8 shadow-md">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold">Perfil Descritivo</h1>
              <p className="opacity-80">Registro técnico de sondagem e poço</p>
            </div>
            <Button onClick={gerarPDF} className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-semibold px-6 shadow-lg">
              Gerar Relatório PDF
            </Button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 space-y-8 px-6">
          <Section title="Dados da Sondagem">
            <Grid>
              <Info label="Identificação" value={data.nome_sondagem} />
              <Info label="Tipo de Sondagem" value={data.tipo_sondagem} />
              <Info label="Data" value={data.data} />
              <Info label="Nível d’água (m)" value={data.nivel_agua} />
              <Info label="Profundidade Final" value={`${data.profundidade_total} m`} />
            </Grid>
          </Section>

          <Section title="Construção do Poço">
            <Grid>
              <Info label="Diâmetros (Sond/Poço)" value={`${data.diametro_sondagem} / ${data.diametro_poco}`} />
              <Info label="Topo do Pré-filtro" value={`${data.pre_filtro} m`} />
              <Info label="Seção Filtrante" value={`${data.secao_filtrante_topo}m a ${data.secao_filtrante_base}m`} />
            </Grid>
          </Section>

          <Section title="Estratigrafia do Terreno">
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 text-left font-bold text-gray-600">De (m)</th>
                    <th className="p-4 text-left font-bold text-gray-600">Até (m)</th>
                    <th className="p-4 text-left font-bold text-gray-600">Descrição Litológica</th>
                  </tr>
                </thead>
                <tbody>
                  {layers.map((layer, index) => (
                    <tr key={index} className="bg-white border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4">{index === 0 ? "0.00" : layers[index - 1].profundidade}</td>
                      <td className="p-4 font-medium">{layer.profundidade}</td>
                      <td className="p-4">{layer.tipo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-lg font-bold text-[#391e2a] uppercase tracking-wider mb-1">{title}</h2>
      <div className="h-1 w-12 bg-[#80b02d] mb-6 rounded-full"></div>
      {children}
    </div>
  );
}

function Grid({ children }: any) {
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{children}</div>;
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-gray-400 uppercase mb-1">{label}</span>
      <span className="text-gray-800 font-medium">{value || "-"}</span>
    </div>
  );
}