"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import MobileShell from "../../../../components/layout/MobileShell";

export default function MobileProjetoPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("Projeto");

  useEffect(() => {
    loadProject();
  }, []);

  async function loadProject() {
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    if (data) {
      setProjectName(data.name);
    }
  }

  return (
    <MobileShell
      title={projectName}
      subtitle="Escolha o que deseja preencher em campo"
      backHref="/mobile"
    >
      <div className="space-y-5">

        {/* WORK ORDERS */}
        <button
          onClick={() =>
            router.push(`/mobile/projetos/${projectId}/work-orders`)
          }
          className="
            w-full
            rounded-2xl
            p-5
            bg-gradient-to-br
            from-[var(--green)]
            to-[#5e8420]
            text-white
            shadow-lg
            active:scale-[0.96]
            transition
          "
        >
          <div className="grid grid-cols-[1fr_auto] items-center">

            <div className="text-left">
              <div className="text-lg font-semibold tracking-tight">
                Work Orders
              </div>

              <div className="text-sm opacity-90 mt-1">
                Preencher checklist da visita
              </div>
            </div>

            <div className="text-xl opacity-80 pl-4">
              📋
            </div>

          </div>
        </button>

        {/* PERFIL DESCRITIVO */}
        <button
          onClick={() =>
            router.push(`/mobile/projetos/${projectId}/solo`)
          }
          className="
            w-full
            rounded-2xl
            p-5
            bg-gradient-to-br
            from-[var(--purple)]
            to-[#2a1420]
            text-white
            shadow-lg
            active:scale-[0.96]
            transition
          "
        >
          <div className="grid grid-cols-[1fr_auto] items-center">

            <div className="text-left">
              <div className="text-lg font-semibold tracking-tight">
                Perfil descritivo
              </div>

              <div className="text-sm opacity-90 mt-1">
                Registrar sondagem de solo
              </div>
            </div>

            <div className="text-xl opacity-80 pl-4">
              ⛏️
            </div>

          </div>
        </button>

        {/* FÍSICO-QUÍMICOS */}
        <button
          onClick={() =>
            router.push(`/mobile/projetos/${projectId}/fisico-quimicos`)
          }
          className="
            w-full
            rounded-2xl
            p-5
            bg-gradient-to-br
            from-[#2f7ea1]
            to-[#1f5c78]
            text-white
            shadow-lg
            active:scale-[0.96]
            transition
          "
        >
          <div className="grid grid-cols-[1fr_auto] items-center">

            <div className="text-left">
              <div className="text-lg font-semibold tracking-tight">
                Físico-químicos
              </div>

              <div className="text-sm opacity-90 mt-1">
                Ficha de amostragem
              </div>
            </div>

            <div className="text-xl opacity-80 pl-4">
              🧪
            </div>

          </div>
        </button>

        {/* RELATÓRIO DIÁRIO DE OBRA */}
<button
  onClick={() =>
    router.push(`/mobile/projetos/${projectId}/rdo`)
  }
  className="
    w-full
    rounded-2xl
    p-5
    bg-gray-200
    text-gray-900
    border border-gray-300
    shadow-sm
    active:scale-[0.96]
    transition
  "
>
  <div className="grid grid-cols-[1fr_auto] items-center">

    <div className="text-left">
      <div className="text-lg font-semibold tracking-tight">
        Relatório Diário de Obra
      </div>

      <div className="text-sm text-gray-600 mt-1">
        Registrar atividades e fotos do dia
      </div>
    </div>

    <div className="text-xl opacity-70 pl-4">
      🏗️
    </div>

  </div>
</button>

      </div>
    </MobileShell>
  );
}