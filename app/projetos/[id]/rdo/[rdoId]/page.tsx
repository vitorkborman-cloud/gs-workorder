"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type RDO = any;

export default function RdoViewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const rdoId = params.rdoId as string;

  const [rdo, setRdo] = useState<RDO | null>(null);
  const [projectName, setProjectName] = useState("");

  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    load();
  }, []);

async function gerarPDF() {
  const pdf = new jsPDF("p", "mm", "a4");

  let y = 10;

  // 🔹 LOGO
  pdf.addImage("/logo.png", "PNG", 10, y, 30, 15);

  // 🔹 TÍTULO
  pdf.setFontSize(14);
  pdf.text("Relatório Diário de Obra", 10, y + 20);

  // 🔹 PROJETO / DATA
  pdf.setFontSize(10);
  pdf.text(`Projeto: ${projectName}`, 200, y + 10, { align: "right" });
  pdf.text(`Data: ${rdo.data}`, 200, y + 15, { align: "right" });

  y += 30;

  // 🔹 LINHA VERDE
  pdf.setDrawColor(128, 176, 45);
  pdf.setLineWidth(1);
  pdf.line(10, y, 200, y);

  y += 10;

  // 🔹 CLIMA
  autoTable(pdf, {
    startY: y,
    head: [["Período", "Tempo", "Condição", "Razão"]],
    body: rdo.clima?.map((c: any) => [
      c.periodo,
      c.tempo,
      c.condicao,
      c.razao || "-"
    ]) || [],
    styles: { fontSize: 9 },
    headStyles: {
      fillColor: [57, 30, 42], // roxo
      textColor: 255
    }
  });

  y = (pdf as any).lastAutoTable.finalY + 5;

  // 🔹 ENVOLVIDOS
  autoTable(pdf, {
    startY: y,
    head: [["Empresa", "N° colaboradores", "Função"]],
    body: rdo.envolvidos?.map((e: any) => [
      e.empresa,
      e.colaboradores,
      e.funcao
    ]) || [],
    styles: { fontSize: 9 },
    headStyles: {
      fillColor: [57, 30, 42],
      textColor: 255
    }
  });

  y = (pdf as any).lastAutoTable.finalY + 5;

  // 🔹 ATIVIDADES
  autoTable(pdf, {
    startY: y,
    head: [["Atividade", "Empresa", "Status", "Obs"]],
    body: rdo.atividades?.map((a: any) => [
      a.atividade,
      a.empresa,
      a.status,
      a.obs || "-"
    ]) || [],
    styles: { fontSize: 9 },
    headStyles: {
      fillColor: [57, 30, 42],
      textColor: 255
    }
  });

  y = (pdf as any).lastAutoTable.finalY + 5;

  // 🔹 COMENTÁRIOS
  pdf.setFontSize(12);
  pdf.text("Comentários", 10, y);
  y += 6;

  pdf.setFontSize(10);
  pdf.text(rdo.comentarios || "-", 10, y, {
    maxWidth: 180
  });

  pdf.save(`RDO_${projectName}.pdf`);
}

  async function load() {
    const { data } = await supabase
      .from("rdo_reports")
      .select("*")
      .eq("id", rdoId)
      .single();

    if (data) setRdo(data);

    const { data: proj } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    if (proj) setProjectName(proj.name);
  }

  if (!rdo) {
    return (
      <AdminShell>
        <p className="p-10">Carregando...</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="space-y-6">

        {/* HEADER */}
        <div style={{ height: "4px", backgroundColor: "#80b02d", marginTop: "10px" }} />
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">RDO</h1>
            <p className="text-sm text-gray-500">
              {projectName}
            </p>
          </div>

          <Button onClick={gerarPDF}>
  Baixar PDF
</Button>
        </div>

        {/* CONTEÚDO */}
<div
  ref={pdfRef}
  className="bg-white text-black p-10 rounded-xl shadow space-y-6"
  style={{ width: "794px" }} // 🔥 ESSENCIAL
>

          {/* CABEÇALHO */}
          <div className="border-b pb-4">
  <table className="w-full">
    <tbody>
      <tr>
        <td style={{ verticalAlign: "top" }}>
          <img src="/logo.png" style={{ height: "50px", marginBottom: "5px" }} />
          <p style={{ margin: 0 }}>Relatório Diário de Obra</p>
        </td>

        <td style={{ textAlign: "right", verticalAlign: "top" }}>
          <p style={{ margin: 0 }}>
            <b>Projeto:</b> {projectName}
          </p>
          <p style={{ margin: 0 }}>
            <b>Data:</b> {rdo.data}
          </p>
        </td>
      </tr>
    </tbody>
  </table>
</div>

          {/* HORÁRIOS */}
          <div className="grid grid-cols-2 border p-3">
            <p><b>Hora início:</b> {rdo.inicio}</p>
            <p><b>Hora fim:</b> {rdo.fim}</p>
          </div>

          {/* CLIMA */}
          <div>
            <h3 style={{ color: "#391e2a", fontWeight: 600, marginBottom: "8px" }}>Condições Climáticas</h3>

            <table className="w-full border">
              <thead>
                <tr style={{ backgroundColor: "#391e2a", color: "#ffffff" }}>
                  <th className="border p-1">Período</th>
                  <th className="border p-1">Tempo</th>
                  <th className="border p-1">Condição</th>
                  <th className="border p-1">Razão</th>
                </tr>
              </thead>

              <tbody>
                {rdo.clima?.map((c: any, i: number) => (
                  <tr key={i}>
                    <td className="border p-1">{c.periodo}</td>
                    <td className="border p-1">{c.tempo}</td>
                    <td className="border p-1">{c.condicao}</td>
                    <td className="border p-1">{c.razao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ENVOLVIDOS */}
<table className="w-full border">
  <thead>
    <tr style={{ backgroundColor: "#391e2a", color: "#ffffff" }}>
      <th className="border p-1">Empresa</th>
      <th className="border p-1">N° colaboradores</th>
      <th className="border p-1">Função</th>
    </tr>
  </thead>

  <tbody>
    {rdo.envolvidos?.map((e: any, i: number) => (
      <tr key={i}>
        <td className="border p-1">{e.empresa}</td>
        <td className="border p-1">{e.colaboradores}</td>
        <td className="border p-1">{e.funcao}</td>
      </tr>
    ))}
  </tbody>
</table>

          {/* ATIVIDADES */}
<table className="w-full border">
  <thead>
    <tr style={{ backgroundColor: "#391e2a", color: "#ffffff" }}>
      <th className="border p-1">Atividade</th>
      <th className="border p-1">Empresa responsável</th>
      <th className="border p-1">Status</th>
      <th className="border p-1">Observação</th>
    </tr>
  </thead>

  <tbody>
    {rdo.atividades?.map((a: any, i: number) => (
      <tr key={i}>
        <td className="border p-1">{a.atividade}</td>
        <td className="border p-1">{a.empresa}</td>
        <td className="border p-1">{a.status}</td>
        <td className="border p-1">{a.obs}</td>
      </tr>
    ))}
  </tbody>
</table>

          {/* SHEQ */}
<table className="w-full border">
  <thead>
    <tr style={{ backgroundColor: "#391e2a", color: "#ffffff" }}>
      <th className="border p-1">Ocorrências</th>
      <th className="border p-1">Registro</th>
      <th className="border p-1">Observações</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td className="border p-1"><b>Incidente</b></td>
      <td className="border p-1">{rdo.sheq?.incidente || "-"}</td>
      <td className="border p-1">{rdo.sheq?.incidenteObs || "-"}</td>
    </tr>

    <tr>
      <td className="border p-1"><b>Vazamento</b></td>
      <td className="border p-1">{rdo.sheq?.vazamento || "-"}</td>
      <td className="border p-1">{rdo.sheq?.vazamentoObs || "-"}</td>
    </tr>
  </tbody>
</table>

          {/* COMENTÁRIOS */}
          <div>
            <h3 style={{ color: "#391e2a", fontWeight: 600, marginBottom: "8px" }}>Comentários</h3>
            <div className="border p-3 min-h-[80px]">
              {rdo.comentarios}
            </div>
          </div>

          {/* FOTOS */}
          <div>
            <h3 style={{ color: "#391e2a", fontWeight: 600, marginBottom: "8px" }}>Registro Fotográfico</h3>

            <div className="grid grid-cols-2 gap-4">
              {rdo.fotos?.map((f: any, i: number) => (
                <div key={i}>
                  {f.preview && (
                    <img src={f.preview} className="w-full border" />
                  )}
                  <p className="text-xs">{f.legenda}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ASSINATURAS */}
          <div>
            <h3 style={{ color: "#391e2a", fontWeight: 600, marginBottom: "8px" }}>Assinaturas</h3>

            <div className="grid grid-cols-2 gap-6">
              {rdo.assinaturas?.map((a: any, i: number) => (
                <div key={i} className="text-center">
                  <p>{a.empresa}</p>

                  {a.assinatura && (
                    <img src={a.assinatura} className="h-16 mx-auto border" />
                  )}

                  <div className="border-t mt-2 pt-1 text-xs">
                    Assinatura
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </AdminShell>
  );
}