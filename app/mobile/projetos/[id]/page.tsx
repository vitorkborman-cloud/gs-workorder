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
      <div className="space-y-4">

        {/* WORK ORDERS */}
        <button
          onClick={() =>
            router.push(`/mobile/projetos/${projectId}/work-orders`)
          }
          className="
            w-full rounded-2xl p-5
            bg-[var(--green)] text-white
            shadow-md active:scale-[0.97] transition
          "
        >
          <div className="text-lg font-semibold">
            Work Orders
          </div>
          <div className="text-sm opacity-90 mt-1">
            Preencher checklist da visita
          </div>
        </button>

        {/* PERFIL DESCRITIVO */}
        <button
          onClick={() =>
            router.push(`/mobile/projetos/${projectId}/solo`)
          }
          className="
            w-full rounded-2xl p-5
            bg-[var(--purple)] text-white
            shadow-md active:scale-[0.97] transition
          "
        >
          <div className="text-lg font-semibold">
            Perfil descritivo
          </div>
          <div className="text-sm opacity-90 mt-1">
            Registrar sondagem de solo
          </div>
        </button>

      </div>
    </MobileShell>
  );
}
