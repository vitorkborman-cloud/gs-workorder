"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MobileShell from "@/components/layout/MobileShell";

export default function RdoPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [projectName, setProjectName] = useState("");
  const [activities, setActivities] = useState<string[]>([]);
  const [newActivity, setNewActivity] = useState("");

  useEffect(() => {
    loadProject();
  }, []);

  async function loadProject() {
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    if (data) setProjectName(data.name);
  }

  function addActivity() {
    if (!newActivity) return;
    setActivities([...activities, newActivity]);
    setNewActivity("");
  }

  return (
    <MobileShell
      title={projectName}
      subtitle="Relatório Diário de Obra"
      backHref={`/mobile/projetos/${projectId}`}
    >
      <div className="space-y-6">

        {/* TÍTULO */}
        <div className="text-lg font-semibold">
          Novo Relatório
        </div>

        {/* ATIVIDADES */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">

          <div className="font-medium">
            Atividades
          </div>

          {activities.map((act, i) => (
            <div
              key={i}
              className="bg-gray-100 rounded-xl p-3 text-sm"
            >
              {act}
            </div>
          ))}

          <div className="flex gap-2">
            <input
              value={newActivity}
              onChange={(e) => setNewActivity(e.target.value)}
              placeholder="Descreva a atividade"
              className="flex-1 border rounded-xl px-3 py-2 text-sm"
            />

            <button
              onClick={addActivity}
              className="bg-[#80b02d] text-white px-4 rounded-xl"
            >
              +
            </button>
          </div>

        </div>

      </div>
    </MobileShell>
  );
}