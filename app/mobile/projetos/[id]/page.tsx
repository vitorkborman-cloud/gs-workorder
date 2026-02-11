"use client";

import { useRouter, useParams } from "next/navigation";
import AppShell from "../../../../components/AppShell";
import Card from "../../../../components/Card";

export default function MobileProjetoPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  return (
    <AppShell>
      <div className="space-y-4">
        <Card
          title="Work Orders"
        >
          <button
            onClick={() =>
              router.push(`/mobile/projetos/${projectId}/work-orders`)
            }
            className="w-full bg-[var(--green)] text-white font-bold py-3 rounded-xl"
          >
            Acessar
          </button>
        </Card>

        <Card
          title="Descrição de Solo"
        >
          <button
            onClick={() =>
              router.push(`/mobile/projetos/${projectId}/solo`)
            }
            className="w-full bg-[var(--purple)] text-white font-bold py-3 rounded-xl"
          >
            Acessar
          </button>
        </Card>
      </div>
    </AppShell>
  );
}
