"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AdminShell from "../../../../../components/layout/AdminShell";
import { Button } from "../../../../../components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Layer = {
  de: string;
  ate: string;
  tipo: string;
  coloracao?: string;
  leitura_voc?: string;
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
      setLayers((data.layers as Layer[]) || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  /* ================= CORES AUTOMÁTICAS ================= */
  function gerarCor(nome: string): [number, number, number] {
    const n = nome.toLowerCase();

    if (n.includes("concreto")) return [200, 200, 200]; // cinza claro

    /* MATERIAIS GROSSEIROS */
    if (n.includes("rachão") || n.includes("rachao")) return [100, 100, 100]; // cinza escuro
    if (n.includes("brita")) return [140, 140, 140]; // cinza médio
    if (n.includes("cascalho")) return [120, 120, 120];

    /* ARGILAS */
    if (n.includes("argila")) {
      if (n.includes("silt")) return [220, 120, 120];
      if (n.includes("aren")) return [200, 70, 70];
      return [150, 40, 40];
    }

    /* SILTES */
    if (n.includes("silte")) {
      if (n.includes("silt")) return [185, 120, 95];
      if (n.includes("aren")) return [200, 140, 90];
      return [170, 95, 70];
    }

    /* AREIAS */
    if (n.includes("areia")) {
      if (n.includes("fina")) return [235, 210, 140];
      if (n.includes("grossa")) return [220, 190, 110];
      return [230, 200, 120];
    }

    /* ORGÂNICOS */
    if (n.includes("orgânica") || n.includes("organica")) return [60, 60, 60];
    if (n.includes("turfa")) return [40, 40, 40];

    return [200, 180, 140];
  }

  async function gerarPDF() {
    if (!data) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const marginX = 15;

    const brandPurple: [number, number, number] = [57, 30, 42];
    const brandGreen: [number, number, number] = [128, 176, 45];

    // ================= PÁGINA 1: DADOS E TABELA (NOVO LAYOUT PREMIUM) =================
    
    // Header
    pdf.setFillColor(...brandPurple);
    pdf.rect(0, 0, pageWidth, 35, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("PERFIL DESCRITIVO DE SONDAGEM", pageWidth - marginX, 15, { align: "right" });
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${data.nome_sondagem} | Data: ${data.data || "-"}`, pageWidth - marginX, 22, { align: "right" });

    let currentY = 45;

    // Blocos de Informação usando AutoTable para alinhamento perfeito
    autoTable(pdf, {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      head: [["1. Dados da Sondagem", "2. Dados de Instalação", "3. Coordenadas"]],
      body: [[
        `Sondagem: ${data.nome_sondagem || "-"}\nData: ${data.data || "-"}\nHora: ${data.hora || "-"}\nTipo: ${data.tipo_sondagem || "-"}\nNível d'água: ${data.nivel_agua || "-"} m\nProf. total: ${data.profundidade_total || "-"} m`,
        `Ø Sondagem: ${data.diametro_sondagem || "-"} in\nØ Poço: ${data.diametro_poco || "-"} in\nPré-filtro: ${data.pre_filtro || "-"} m\nFiltro Topo: ${data.secao_filtrante_topo || "-"} m\nFiltro Base: ${data.secao_filtrante_base || "-"} m`,
        `Coord X:\n${data.coord_x || "-"}\n\nCoord Y:\n${data.coord_y || "-"}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: brandPurple, textColor: 255, fontStyle: "bold", fontSize: 10, cellPadding: 3 },
      styles: { fontSize: 9, cellPadding: 4, valign: 'top', textColor: 40 },
      columnStyles: { 
        0: { cellWidth: (pageWidth - marginX * 2) / 3 }, 
        1: { cellWidth: (pageWidth - marginX * 2) / 3 }, 
        2: { cellWidth: (pageWidth - marginX * 2) / 3 } 
      }
    });

    currentY = (pdf as any).lastAutoTable.finalY + 15;

    // Tabela de Camadas
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...brandPurple);
    pdf.text("4. Camadas Estratigráficas", marginX, currentY);
    
    currentY += 5;

    autoTable(pdf, {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      head: [["De (m)", "Até (m)", "Tipo de Solo", "Coloração", "VOC (ppm)"]],
      body: layers.map(l => [
        l.de || "-", 
        l.ate || "-", 
        l.tipo || "-", 
        l.coloracao || "-", 
        l.leitura_voc ? `${l.leitura_voc}` : "-"
      ]),
      theme: 'striped',
      headStyles: { fillColor: brandGreen, textColor: 255, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 4, textColor: 60 },
      alternateRowStyles: { fillColor: [248, 248, 248] }
    });

    // ================= PÁGINA 2: PERFIL GRÁFICO =================
    pdf.addPage();

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...brandPurple);
    pdf.text("Representação Visual do Perfil", pageWidth / 2, 20, { align: "center" });

    const topo = 35;
    const alturaMax = 170;
    const larguraPerfil = 40;

    // Posicionamento horizontal recalculado para caber o texto de VOC
    const centro = pageWidth / 2 - 35; 
    const esquerdaPerfil = centro - larguraPerfil / 2;
    const direitaPerfil = centro + larguraPerfil / 2;

    const profundidadeTotal = parseFloat(data.profundidade_total || "1");
    const escala = alturaMax / profundidadeTotal;

    // 1. Escala de Profundidade (Esquerda)
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.setDrawColor(150);
    for (let i = 0; i <= profundidadeTotal; i += 0.5) {
      const yEscala = topo + i * escala;
      pdf.line(esquerdaPerfil - 6, yEscala, esquerdaPerfil, yEscala);
      pdf.text(`${i.toFixed(1)} m`, esquerdaPerfil - 25, yEscala + 2);
    }

    // 2. Desenho das Camadas de Solo
    layers.forEach((l) => {
      const de = parseFloat(l.de);
      const ate = parseFloat(l.ate);

      const altura = (ate - de) * escala;
      const yCamada = topo + de * escala;

      const [r, g, b] = gerarCor(l.tipo);

      pdf.setFillColor(r, g, b);
      pdf.rect(esquerdaPerfil, yCamada, larguraPerfil, altura, "F");

      const tipo = l.tipo.toLowerCase();

      // Texturas (Mantidas iguais à sua lógica original)
      if (tipo.includes("brita")) {
        const espacamento = 3; const raio = 0.6; pdf.setDrawColor(0);
        for (let yDot = yCamada + 2; yDot < yCamada + altura; yDot += espacamento) {
          for (let xDot = esquerdaPerfil + 2; xDot < esquerdaPerfil + larguraPerfil; xDot += espacamento) {
            pdf.circle(xDot, yDot, raio);
          }
        }
      }

      if (tipo.includes("rachão") || tipo.includes("rachao")) {
        const espacamento = 4; const raio = 1; pdf.setDrawColor(0);
        for (let yDot = yCamada + 2; yDot < yCamada + altura; yDot += espacamento) {
          for (let xDot = esquerdaPerfil + 2; xDot < esquerdaPerfil + larguraPerfil; xDot += espacamento) {
            pdf.circle(xDot, yDot, raio);
          }
        }
      }

      if (tipo.includes("siltosa")) {
        const espacamento = 2; const tamanhoX = 0.33; pdf.setDrawColor(0);
        for (let yDot = yCamada + 1; yDot < yCamada + altura; yDot += espacamento) {
          for (let xDot = esquerdaPerfil + 1; xDot < esquerdaPerfil + larguraPerfil; xDot += espacamento) {
            pdf.line(xDot - tamanhoX, yDot - tamanhoX, xDot + tamanhoX, yDot + tamanhoX);
            pdf.line(xDot - tamanhoX, yDot + tamanhoX, xDot + tamanhoX, yDot - tamanhoX);
          }
        }
      }

      if (tipo.includes("areia") || tipo.includes("arenoso") || tipo.includes("arenosa")) {
        let espacamento = 1; let raio = 0.15;
        if (tipo.includes("fina")) { espacamento = 1; raio = 0.1; }
        if (tipo.includes("grossa")) { espacamento = 1; raio = 0.3; }
        pdf.setFillColor(0, 0, 0);
        for (let yDot = yCamada + 1; yDot < yCamada + altura; yDot += espacamento) {
          for (let xDot = esquerdaPerfil + 1; xDot < esquerdaPerfil + larguraPerfil; xDot += espacamento) {
            pdf.circle(xDot, yDot, raio, "F");
          }
        }
      }

      // 🔥 NOVO: ANOTAÇÕES DE VOC (Lado Direito)
      if (l.leitura_voc && l.leitura_voc.trim() !== "") {
        const yCenter = yCamada + (altura / 2);
        
        // Linha de chamada
        pdf.setDrawColor(180);
        pdf.setLineWidth(0.3);
        pdf.line(direitaPerfil, yCenter, direitaPerfil + 4, yCenter);

        // Texto VOC
        pdf.setFontSize(8);
        pdf.setTextColor(60, 60, 60);
        pdf.setFont("helvetica", "bold");
        pdf.text(`[${l.de} a ${l.ate}m]`, direitaPerfil + 6, yCenter - 1);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...brandGreen);
        pdf.text(`VOC: ${l.leitura_voc} ppm`, direitaPerfil + 6, yCenter + 3);
      }
    });

    // Borda do perfil completo
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.5);
    pdf.rect(esquerdaPerfil, topo, larguraPerfil, alturaMax);

    // 3. Legenda (Empurrada mais pra direita para dar espaço ao VOC)
    let yLegenda = topo;
    pdf.setFontSize(8);
    pdf.setTextColor(80);

    layers.forEach((l) => {
      const de = parseFloat(l.de);
      const ate = parseFloat(l.ate);
      const [r, g, b] = gerarCor(l.tipo);

      // Afastado +55 do perfil para caber as anotações do VOC
      const xLegenda = direitaPerfil + 45; 
      const tamanhoLegenda = 6;

      pdf.setFillColor(r, g, b);
      pdf.setDrawColor(150);
      pdf.setLineWidth(0.2);
      pdf.rect(xLegenda, yLegenda, tamanhoLegenda, tamanhoLegenda, "FD");

      pdf.text(`${de} a ${ate}m : ${l.tipo}`, xLegenda + 9, yLegenda + 4.5);

      yLegenda += 10;
    });

    // 4. Tubo de PVC e Filtros (Lógica Mantida Integralmente)
    const larguraTubo = 12;
    const esquerdaTubo = centro - larguraTubo / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(50);
    pdf.setLineWidth(0.3);
    pdf.rect(esquerdaTubo, topo, larguraTubo, alturaMax, "FD");

    const topoFiltro = parseFloat(data.secao_filtrante_topo);
    const baseFiltro = parseFloat(data.secao_filtrante_base);

    if (!isNaN(topoFiltro) && !isNaN(baseFiltro)) {
      const yTopoFiltro = topo + topoFiltro * escala;
      const yBaseFiltro = topo + baseFiltro * escala;
      const alturaFiltro = yBaseFiltro - yTopoFiltro;

      pdf.rect(esquerdaTubo, yTopoFiltro, larguraTubo, alturaFiltro);
      for (let i = 3; i < alturaFiltro; i += 3) {
        pdf.line(esquerdaTubo + 0.5, yTopoFiltro + i, esquerdaTubo + larguraTubo - 0.5, yTopoFiltro + i);
      }
    }

    const topoPrefiltro = parseFloat(data.pre_filtro);

    if (!isNaN(topoPrefiltro)) {
      const larguraPrefiltro = larguraPerfil * 0.07;
      const yInicioPrefiltro = topo + topoPrefiltro * escala;
      const alturaPrefiltro = (profundidadeTotal - topoPrefiltro) * escala;
      const esquerdaPrefiltro = esquerdaTubo - larguraPrefiltro;
      const direitaPrefiltro = esquerdaTubo + larguraTubo;

      // Areia acima do pré-filtro
      pdf.setFillColor(245, 222, 179);
      pdf.rect(esquerdaPrefiltro, topo, larguraPrefiltro, yInicioPrefiltro - topo, "F");
      pdf.rect(direitaPrefiltro, topo, larguraPrefiltro, yInicioPrefiltro - topo, "F");

      pdf.setDrawColor(0);
      pdf.setLineWidth(0.2);
      pdf.rect(esquerdaPrefiltro, topo, larguraPrefiltro, yInicioPrefiltro - topo);
      pdf.rect(direitaPrefiltro, topo, larguraPrefiltro, yInicioPrefiltro - topo);

      // Pré-filtro
      pdf.setFillColor(210, 180, 140);
      pdf.rect(esquerdaPrefiltro, yInicioPrefiltro, larguraPrefiltro, alturaPrefiltro, "F");
      pdf.rect(direitaPrefiltro, yInicioPrefiltro, larguraPrefiltro, alturaPrefiltro, "F");
      pdf.rect(esquerdaPrefiltro, yInicioPrefiltro, larguraPrefiltro, alturaPrefiltro);
      pdf.rect(direitaPrefiltro, yInicioPrefiltro, larguraPrefiltro, alturaPrefiltro);

      // Textura pré-filtro
      pdf.setFillColor(0, 0, 0);
      const espacamentoPF = 2.4;
      const raioBase = 0.25;

      for (let yDot = yInicioPrefiltro + 1; yDot < yInicioPrefiltro + alturaPrefiltro; yDot += espacamentoPF) {
        for (let xDot = esquerdaPrefiltro + 0.8; xDot < esquerdaPrefiltro + larguraPrefiltro - 0.8; xDot += espacamentoPF) {
          const jitterX = (Math.random() - 0.5) * 0.6;
          const jitterY = (Math.random() - 0.5) * 0.6;
          const raio = raioBase + (Math.random() - 0.5) * 0.1;
          pdf.circle(xDot + jitterX, yDot + jitterY, raio, "F");
        }
        for (let xDot = direitaPrefiltro + 0.8; xDot < direitaPrefiltro + larguraPrefiltro - 0.8; xDot += espacamentoPF) {
          const jitterX = (Math.random() - 0.5) * 0.6;
          const jitterY = (Math.random() - 0.5) * 0.6;
          const raio = raioBase + (Math.random() - 0.5) * 0.1;
          pdf.circle(xDot + jitterX, yDot + jitterY, raio, "F");
        }
      }
    }

    // 5. Nível da Água
    if (data.nivel_agua) {
      const nivel = Number(String(data.nivel_agua).replace(",", "."));
      if (!isNaN(nivel)) {
        const yNivel = topo + nivel * escala;
        pdf.setDrawColor(135, 206, 235);
        pdf.setLineWidth(0.7);
        pdf.line(esquerdaPerfil - 10, yNivel, direitaPerfil + 10, yNivel);
        const xTri = esquerdaPerfil - 12;
        pdf.setFillColor(135, 206, 235);
        pdf.triangle(xTri, yNivel, xTri - 3, yNivel - 2, xTri - 3, yNivel + 2, "F");
      }
    }

    // 6. Cotas de Diâmetro
    const yCota1 = topo + alturaMax + 10;
    const yCota2 = topo + alturaMax + 20;

    pdf.setDrawColor(0);
    pdf.setLineWidth(0.3);
    pdf.setTextColor(60);

    const diametroPoco = data.diametro_poco ?? "-";
    const esquerdaCotaPoco = esquerdaTubo;
    const direitaCotaPoco = esquerdaTubo + larguraTubo;
    pdf.line(esquerdaCotaPoco, topo + alturaMax, esquerdaCotaPoco, yCota1);
    pdf.line(direitaCotaPoco, topo + alturaMax, direitaCotaPoco, yCota1);
    pdf.line(esquerdaCotaPoco, yCota1, direitaCotaPoco, yCota1);
    pdf.setFontSize(8);
    pdf.text(`Ø ${diametroPoco} (Poço)`, (esquerdaCotaPoco + direitaCotaPoco) / 2, yCota1 + 4, { align: "center" });

    const diametroSondagem = data.diametro_sondagem ?? "-";
    const esquerdaCotaSondagem = esquerdaPerfil;
    const direitaCotaSondagem = direitaPerfil;
    pdf.line(esquerdaCotaSondagem, topo + alturaMax, esquerdaCotaSondagem, yCota2);
    pdf.line(direitaCotaSondagem, topo + alturaMax, direitaCotaSondagem, yCota2);
    pdf.line(esquerdaCotaSondagem, yCota2, direitaCotaSondagem, yCota2);
    pdf.text(`Ø ${diametroSondagem} (Furo)`, (esquerdaCotaSondagem + direitaCotaSondagem) / 2, yCota2 + 4, { align: "center" });

    pdf.save(`Perfil_Sondagem_${data.nome_sondagem}.pdf`);
  }

  if (loading) return <AdminShell><p className="p-10">Carregando...</p></AdminShell>;
  if (!data) return <AdminShell><p className="p-10">Perfil não encontrado.</p></AdminShell>;

  return (
    <AdminShell>
      <div className="bg-gray-100 min-h-screen pb-12">
        
        {/* HEADER */}
        <div className="bg-[#391e2a] text-white px-10 py-8 shadow-md">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold">Visualização do Perfil</h1>
              <p className="opacity-80 mt-1">Sondagem: {data.nome_sondagem}</p>
            </div>
            <Button onClick={gerarPDF} className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold px-8 h-12 shadow-lg">
              Baixar Perfil Técnico (PDF)
            </Button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 space-y-8 px-6">
          
          <div className="grid md:grid-cols-3 gap-6">
            <Section title="Dados da Sondagem">
              <Grid>
                <Info label="Sondagem" value={data.nome_sondagem} />
                <Info label="Tipo" value={data.tipo_sondagem} />
                <Info label="Data" value={data.data} />
                <Info label="Hora" value={data.hora} />
                <Info label="Nível d’água" value={data.nivel_agua ? `${data.nivel_agua} m` : "-"} />
                <Info label="Profundidade Total" value={`${data.profundidade_total} m`} />
              </Grid>
            </Section>

            <Section title="Dados de Instalação">
              <Grid>
                <Info label="Ø Sondagem" value={data.diametro_sondagem} />
                <Info label="Ø Poço" value={data.diametro_poco} />
                <Info label="Pré-filtro" value={data.pre_filtro ? `${data.pre_filtro} m` : "-"} />
                <Info label="Seção Filtrante" value={`${data.secao_filtrante_topo ?? "-"} a ${data.secao_filtrante_base ?? "-"} m`} />
              </Grid>
            </Section>

            <Section title="Geolocalização">
              <Grid>
                <Info label="Coord. X" value={data.coord_x} />
                <Info label="Coord. Y" value={data.coord_y} />
              </Grid>
            </Section>
          </div>

          <Section title="Camadas Estratigráficas">
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm border-collapse text-left bg-white">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">De (m)</th>
                    <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">Até (m)</th>
                    <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">Tipo de Solo</th>
                    <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">Coloração</th>
                    <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">VOC (ppm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {layers.map((layer, index) => (
                    <tr key={index} className="hover:bg-gray-50/50 transition">
                      <td className="p-4 text-gray-700">{layer.de}</td>
                      <td className="p-4 text-gray-700">{layer.ate}</td>
                      <td className="p-4 font-medium text-[#391e2a]">{layer.tipo}</td>
                      <td className="p-4 text-gray-600">{layer.coloracao || "-"}</td>
                      <td className="p-4 text-[#80b02d] font-bold">{layer.leitura_voc || "-"}</td>
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
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 h-full">
      <h2 className="text-sm font-extrabold text-[#391e2a] uppercase tracking-wider mb-5">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Grid({ children }: any) {
  return <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-sm">{children}</div>;
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold text-gray-400 tracking-wide uppercase mb-1">{label}</span>
      <span className="font-semibold text-gray-800">{value || "-"}</span>
    </div>
  );
}