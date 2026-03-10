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

  /* ================= CORES AUTOMÁTICAS ================= */

  function gerarCor(nome: string): [number, number, number] {
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

    return [200, 180, 140];
  }

  async function gerarPDF() {
    if (!data) return;

    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;

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

    campo(
      "Seção filtrante:",
      `${data.secao_filtrante_topo ?? "-"} - ${
        data.secao_filtrante_base ?? "-"
      }`
    );

    y += 8;

    pdf.setFont("helvetica", "bold");
    pdf.text("3. Coordenadas", margin, y);
    y += 8;

    campo("Coord X:", data.coord_x);
    campo("Coord Y:", data.coord_y);

    /* ================= TABELA ================= */

    pdf.addPage();

    y = 30;

    pdf.setFont("helvetica", "bold");
    pdf.text("4. Camadas Estratigráficas", margin, y);
    y += 10;

    const col1 = margin;
    const col2 = margin + 35;
    const col3 = margin + 70;

    const larguraTabela = pageWidth - margin * 2;
    const alturaLinha = 8;

    pdf.setFillColor(128, 176, 45);
    pdf.rect(col1, y, larguraTabela, alturaLinha, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.text("De (m)", col1 + 3, y + 5.5);
    pdf.text("Até (m)", col2 + 3, y + 5.5);
    pdf.text("Tipo de Solo", col3 + 3, y + 5.5);

    y += alturaLinha;

    pdf.setTextColor(0);

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

    pdf.setFontSize(8);

    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
      const yEscala = topo + i * escala;
      pdf.line(esquerdaPerfil - 6, yEscala, esquerdaPerfil, yEscala);
      pdf.text(`${i.toFixed(1)} m`, esquerdaPerfil - 25, yEscala + 2);
    }

    let profAnt = 0;

    layers.forEach((l) => {
      const profAtual = parseFloat(l.profundidade);
      const altura = (profAtual - profAnt) * escala;
      const yCamada = topo + profAnt * escala;

      const [r, g, b] = gerarCor(l.tipo);

      pdf.setFillColor(r, g, b);
      pdf.rect(esquerdaPerfil, yCamada, larguraPerfil, altura, "F");

     const tipo = l.tipo.toLowerCase();

if (
  tipo.includes("areia") ||
  tipo.includes("arenoso") ||
  tipo.includes("arenosa")
) {

  let espacamento = 1.5;
  let raio = 0.15;

  if (l.tipo.toLowerCase().includes("fina")) {
    espacamento = 1;
    raio = 0.1;
  }

  if (l.tipo.toLowerCase().includes("grossa")) {
    espacamento = 1.5;
    raio = 0.3;
  }

  pdf.setFillColor(0,0,0);

  for (let yDot = yCamada + 1; yDot < yCamada + altura; yDot += espacamento) {

    for (
      let xDot = esquerdaPerfil + 1;
      xDot < esquerdaPerfil + larguraPerfil;
      xDot += espacamento
    ) {

      pdf.circle(xDot, yDot, raio, "F");

    }

  }

}

      profAnt = profAtual;
    });

    pdf.setDrawColor(0);
    pdf.rect(esquerdaPerfil, topo, larguraPerfil, alturaMax);

    /* ================= LEGENDA ================= */

    let yLegenda = topo;
    let profLegenda = 0;

    pdf.setFontSize(9);

    layers.forEach((l) => {
      const profAtual = parseFloat(l.profundidade);
      const [r, g, b] = gerarCor(l.tipo);

      pdf.setFillColor(r, g, b);
      pdf.rect(direitaPerfil + 20, yLegenda, 8, 8, "F");

      pdf.text(
        `${profLegenda} – ${profAtual} m : ${l.tipo}`,
        direitaPerfil + 32,
        yLegenda + 6
      );

      yLegenda += 12;
      profLegenda = profAtual;
    });

    /* ================= TUBO ================= */

    const larguraTubo = 12;
    const esquerdaTubo = centro - larguraTubo / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax, "F");
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax);

    /* ================= SEÇÃO FILTRANTE ================= */

    const topoFiltro = parseFloat(data.secao_filtrante_topo);
    const baseFiltro = parseFloat(data.secao_filtrante_base);

    if (!isNaN(topoFiltro) && !isNaN(baseFiltro)) {
      const yTopoFiltro = topo + topoFiltro * escala;
      const yBaseFiltro = topo + baseFiltro * escala;

      const alturaFiltro = yBaseFiltro - yTopoFiltro;

      pdf.rect(esquerdaTubo, yTopoFiltro, larguraTubo, alturaFiltro);

      for (let i = 3; i < alturaFiltro; i += 3) {
        pdf.line(
          esquerdaTubo + 0.5,
          yTopoFiltro + i,
          esquerdaTubo + larguraTubo - 0.5,
          yTopoFiltro + i
        );
      }
    }

    /* ================= PRÉ-FILTRO ================= */

const topoPrefiltro = parseFloat(data.pre_filtro);

if (!isNaN(topoPrefiltro)) {

  const larguraPrefiltro = larguraPerfil * 0.07;

  const yInicioPrefiltro = topo + topoPrefiltro * escala;
  const alturaPrefiltro = (profundidadeTotal - topoPrefiltro) * escala;

  const esquerdaPrefiltro = esquerdaTubo - larguraPrefiltro;
  const direitaPrefiltro = esquerdaTubo + larguraTubo;

  /* AREIA ACIMA DO PRÉ FILTRO */

pdf.setFillColor(245,222,179);

pdf.rect(
  esquerdaPrefiltro,
  topo,
  larguraPrefiltro,
  yInicioPrefiltro - topo,
  "F"
);

pdf.rect(
  direitaPrefiltro,
  topo,
  larguraPrefiltro,
  yInicioPrefiltro - topo,
  "F"
);

/* BORDA BLOCO SUPERIOR */

pdf.setDrawColor(0);
pdf.setLineWidth(0.2);

pdf.rect(
  esquerdaPrefiltro,
  topo,
  larguraPrefiltro,
  yInicioPrefiltro - topo
);

pdf.rect(
  direitaPrefiltro,
  topo,
  larguraPrefiltro,
  yInicioPrefiltro - topo
);

/* PRÉ FILTRO */

pdf.setFillColor(210,180,140);

pdf.rect(
  esquerdaPrefiltro,
  yInicioPrefiltro,
  larguraPrefiltro,
  alturaPrefiltro,
  "F"
);

pdf.rect(
  direitaPrefiltro,
  yInicioPrefiltro,
  larguraPrefiltro,
  alturaPrefiltro,
  "F"
);

/* BORDA PRÉ FILTRO */

pdf.rect(
  esquerdaPrefiltro,
  yInicioPrefiltro,
  larguraPrefiltro,
  alturaPrefiltro
);

pdf.rect(
  direitaPrefiltro,
  yInicioPrefiltro,
  larguraPrefiltro,
  alturaPrefiltro
);

/* TEXTURA DO PRÉ FILTRO */

pdf.setFillColor(0,0,0);

const margem = 0.8;       // distância da borda
const espacamento = 1.2;  // densidade
const raio = 0.18;        // tamanho das bolinhas

for (
  let yDot = yInicioPrefiltro + margem;
  yDot < yInicioPrefiltro + alturaPrefiltro;
  yDot += espacamento
) {

  for (
    let xDot = esquerdaPrefiltro + margem;
    xDot < esquerdaPrefiltro + larguraPrefiltro - margem;
    xDot += espacamento
  ) {
    pdf.circle(xDot, yDot, raio, "F");
  }

  for (
    let xDot = direitaPrefiltro + margem;
    xDot < direitaPrefiltro + larguraPrefiltro - margem;
    xDot += espacamento
  ) {
    pdf.circle(xDot, yDot, raio, "F");
  }

}

}

    /* ================= NÍVEL ÁGUA ================= */

    if (data.nivel_agua) {
      const nivel = Number(String(data.nivel_agua).replace(",", "."));

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
      <div className="bg-gray-100 min-h-screen pb-12">

        <div className="bg-[#391e2a] text-white px-10 py-8 shadow-md">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold">Perfil Descritivo</h1>
              <p className="opacity-80">Registro técnico de sondagem</p>
            </div>
            <Button
              onClick={gerarPDF}
              className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-semibold px-6"
            >
              Exportar PDF
            </Button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 space-y-8 px-6">

          <Section title="Dados da Sondagem">
            <Grid>
              <Info label="Nome da Sondagem" value={data.nome_sondagem} />
              <Info label="Tipo de Sondagem" value={data.tipo_sondagem} />
              <Info label="Data" value={data.data} />
              <Info label="Hora" value={data.hora} />
              <Info label="Nível d’água" value={data.nivel_agua} />
              <Info label="Profundidade Total" value={data.profundidade_total} />
            </Grid>
          </Section>

          <Section title="Construção do Poço">
            <Grid>
              <Info label="Diâmetro da Sondagem" value={data.diametro_sondagem} />
              <Info label="Diâmetro do Poço" value={data.diametro_poco} />
              <Info label="Pré-filtro" value={data.pre_filtro} />
              <Info label="Seção Filtrante" value={`${data.secao_filtrante_topo ?? "-"} - ${data.secao_filtrante_base ?? "-"}`} />
            </Grid>
          </Section>

          <Section title="Coordenadas">
            <Grid>
              <Info label="Coord. X" value={data.coord_x} />
              <Info label="Coord. Y" value={data.coord_y} />
            </Grid>
          </Section>

          <Section title="Camadas Estratigráficas">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-3 text-left">De (m)</th>
                  <th className="border p-3 text-left">Até (m)</th>
                  <th className="border p-3 text-left">Tipo de Solo</th>
                </tr>
              </thead>
              <tbody>
                {layers.map((layer, index) => {
                  const de = index === 0 ? 0 : layers[index - 1].profundidade;
                  return (
                    <tr key={index}>
                      <td className="border p-3">{de}</td>
                      <td className="border p-3">{layer.profundidade}</td>
                      <td className="border p-3">{layer.tipo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

        </div>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-8">
      <h2 className="text-xl font-bold text-[#391e2a] uppercase tracking-wide">
        {title}
      </h2>
      <div className="border-b border-[#391e2a] mt-2 mb-6 w-full"></div>
      {children}
    </div>
  );
}

function Grid({ children }: any) {
  return <div className="grid md:grid-cols-2 gap-6 text-sm">{children}</div>;
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-gray-800">{value || "-"}</p>
    </div>
  );
}