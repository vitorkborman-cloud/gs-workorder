"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import MobileShell from "../../../../../components/layout/MobileShell";

type Doc = {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
};

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
  const t = (type || "").toLowerCase();
  if (t.includes("pdf")) return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
  if (t.includes("image") || t.includes("png") || t.includes("jpg")) return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default function DocumentosMobilePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("project_documents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (data) setDocs(data);
    setLoading(false);
  }

  async function handleDownload(doc: Doc) {
    setDownloading(doc.id);
    try {
      const response = await fetch(doc.file_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // fallback: abre no navegador
      window.open(doc.file_url, "_blank");
    } finally {
      setDownloading(null);
    }
  }

  if (loading) return (
    <MobileShell title="Documentos" backHref={`/mobile/projetos/${projectId}`}>
      <div className="p-10 text-center text-gray-400 animate-pulse">Carregando documentos...</div>
    </MobileShell>
  );

  return (
    <MobileShell
      title="Documentos"
      subtitle="Arquivos e referências do projeto"
      backHref={`/mobile/projetos/${projectId}`}
    >
      <div className="space-y-3 pb-6">
        {docs.length === 0 && (
          <div className="text-center mt-16 space-y-3 text-gray-400">
            <svg className="w-14 h-14 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="font-medium text-sm">Nenhum documento disponível.</p>
            <p className="text-xs">Os arquivos anexados pelo desktop aparecerão aqui.</p>
          </div>
        )}

        {docs.map((doc) => (
          <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                <FileIcon type={doc.file_type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#391e2a] text-sm leading-snug break-words">{doc.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex border-t border-gray-100">
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold text-gray-500 hover:bg-gray-50 transition border-r border-gray-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Visualizar
              </a>
              <button
                onClick={() => handleDownload(doc)}
                disabled={downloading === doc.id}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition active:scale-95 disabled:opacity-50"
              >
                {downloading === doc.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {downloading === doc.id ? "Baixando..." : "Baixar arquivo"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}
