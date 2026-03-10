"use client";

import { useRouter, useParams } from "next/navigation";
import MobileShell from "../../../../components/layout/MobileShell";

export default function MobileProjetoPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  return (
    <MobileShell
      title="Módulos do Projeto"
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
          <div className="flex items-center justify-between">

            <div>
              <div className="text-lg font-semibold tracking-tight">
                Work Orders
              </div>

              <div className="text-sm opacity-90 mt-1">
                Preencher checklist da visita
              </div>
            </div>

            <div className="text-xl opacity-80">
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
          <div className="flex items-center justify-between">

            <div>
              <div className="text-lg font-semibold tracking-tight">
                Perfil descritivo
              </div>

              <div className="text-sm opacity-90 mt-1">
                Registrar sondagem de solo
              </div>
            </div>

            <div className="text-xl opacity-80">
              ⛏️
            </div>

          </div>
        </button>

        {/* MONITORAMENTO FÍSICO-QUÍMICO */}
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
          <div className="flex items-center justify-between">

            <div>
              <div className="text-lg font-semibold tracking-tight">
                Físico-químicos
              </div>

              <div className="text-sm opacity-90 mt-1">
                Registrar parâmetros de água
              </div>
            </div>

            <div className="text-xl opacity-80">
              🧪
            </div>

          </div>
        </button>

      </div>
    </MobileShell>
  );
}