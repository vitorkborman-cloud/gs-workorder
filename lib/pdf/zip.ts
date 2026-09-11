import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { jsPDF } from "jspdf";

type PdfSource = jsPDF | Uint8Array | ArrayBuffer;

function paraArrayBuffer(source: PdfSource): ArrayBuffer {
  if (typeof (source as jsPDF).output === "function") {
    return (source as jsPDF).output("arraybuffer") as ArrayBuffer;
  }
  return source as ArrayBuffer;
}

// Nome de arquivo seguro pra dentro do zip - troca tudo que nao e
// letra/numero/espaco/hifen/underscore por "_", sem acento (evita
// problema de encoding em alguns descompactadores).
export function nomeArquivoSeguro(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9 _-]/g, "_")
      .trim() || "arquivo"
  );
}

// Baixa varios PDFs como arquivos SEPARADOS dentro de um unico .zip - ao
// contrario de mergePdfSources (que cola tudo num PDF so), aqui cada item
// continua sendo o proprio arquivo, so empacotado junto pra nao abrir N
// dialogos de download do navegador de uma vez. Cada item pode ser um
// jsPDF direto (ex. um Perfil Descritivo) ou bytes ja mesclados (ex. um
// RDO + seus proprios anexos, que ja formam um unico arquivo por RDO).
export async function baixarPdfsComoZip(arquivos: { nome: string; fonte: PdfSource }[], nomeZip: string) {
  const zip = new JSZip();
  const nomesUsados = new Map<string, number>();

  for (const { nome, fonte } of arquivos) {
    const base = nomeArquivoSeguro(nome);
    const contagem = nomesUsados.get(base) || 0;
    nomesUsados.set(base, contagem + 1);
    const nomeFinal = contagem === 0 ? `${base}.pdf` : `${base}_${contagem + 1}.pdf`;
    zip.file(nomeFinal, paraArrayBuffer(fonte));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, nomeZip);
}
