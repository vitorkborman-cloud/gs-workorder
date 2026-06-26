"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import MobileShell from "../../../../components/layout/MobileShell";

const modules = [
  {
    key: "work-orders",
    label: "Work Orders",
    description: "Checklists e visitas de campo",
    color: "#80b02d",
    bg: "from-[#80b02d] to-[#5e8420]",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "solo",
    label: "Perfil Descritivo",
    description: "Sondagem e estratigrafia de solo",
    color: "#391e2a",
    bg: "from-[#391e2a] to-[#2a1420]",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    key: "fisico-quimicos",
    label: "Físico-Químicos",
    description: "Amostragem de água subterrânea",
    color: "#2f7ea1",
    bg: "from-[#2f7ea1] to-[#1f5c78]",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    key: "manutencoes",
    label: "Manutenções Preventivas",
    description: "Controle de equipamentos",
    color: "#b06a2d",
    bg: "from-[#b06a2d] to-[#7a4a1e]",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "documentos",
    label: "Documentos",
    description: "Arquivos e referências do projeto",
    color: "#6366f1",
    bg: "from-[#6366f1] to-[#4f46e5]",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "rdo",
    label: "Relatório Diário de Obra",
    description: "Atividades e fotos do dia",
    color: "#4b5563",
    bg: "from-[#4b5563] to-[#374151]",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
  },
];

export default function MobileProjetoPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("projects").select("name").eq("id", projectId).single()
      .then(({ data }) => { if (data) setProjectName(data.name); setLoading(false); });
  }, []);

  return (
    <MobileShell
      title={loading ? "Carregando..." : projectName}
      subtitle="Selecione o módulo desejado"
      backHref="/mobile"
    >
      <div className="space-y-3 pb-4">
        {modules.map((mod, i) => (
          <button
            key={mod.key}
            onClick={() => router.push(`/mobile/projetos/${projectId}/${mod.key}`)}
            className="w-full text-left active:scale-[0.97] transition-all duration-150"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">

              {/* Ícone colorido */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white"
                style={{ background: `linear-gradient(135deg, ${mod.color}ee, ${mod.color}99)` }}
              >
                {mod.icon}
              </div>

              {/* Texto */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#391e2a] text-[15px] leading-tight">
                  {mod.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {mod.description}
                </p>
              </div>

              {/* Seta */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${mod.color}18` }}
              >
                <svg className="w-4 h-4" style={{ color: mod.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </div>

            </div>
          </button>
        ))}
      </div>
    </MobileShell>
  );
}
