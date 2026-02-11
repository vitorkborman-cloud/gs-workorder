"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import AppShell from "../../../../components/AppShell";
import Card from "../../../../components/Card";

export default function SoloDesktopPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("soil_descriptions")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (data) setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-[var(--purple)] mb-6">
        Descrições de Solo
      </h1>

      {loading ? (
        <p>Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhuma descrição cadastrada.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="cursor-pointer"
              onClick={() =>
                router.push(
                  `/projetos/${projectId}/solo/${item.id}`
                )
              }
            >
              <Card title={item.nome_sondagem || "Sem nome"}>
                <p className="text-sm text-gray-500">
                  Data: {item.data || "-"}
                </p>
              </Card>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
