// Controle de documentos (numeração SHEQ + versão) exibido no cabeçalho dos
// PDFs/Excel gerados pelo sistema. Fonte única — sempre que um desses
// documentos for alterado (layout, conteúdo, cálculo), a versão sobe +1
// AQUI, e uma linha correspondente deve ser adicionada em
// docs/CONTROLE_DOCUMENTOS.md descrevendo a mudança.

export type DocControl = { sheq: string; versao: number };

export const DOC_CONTROL = {
  rdo:             { sheq: "151", versao: 2 },
  fichaAmostragem: { sheq: "152", versao: 0 },
  excelAmostragem: { sheq: "153", versao: 0 },
  fichaSolo:       { sheq: "154", versao: 1 },
} as const satisfies Record<string, DocControl>;

export function formatDocControl(doc: DocControl): string {
  return `SHEQ n° ${doc.sheq}   |   Versão V ${String(doc.versao).padStart(2, "0")}`;
}
