"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminLayout from "../../components/AdminLayout";
import Button from "../../components/Button";
import { isMobileDevice } from "../../lib/isMobile";

export default function DashboardPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [doneActivities, setDoneActivities] = useState(0);

  useEffect(() => {
    if (isMobileDevice()) {
      router.replace("/mobile");
      return;
    }

    load();
  }, []);

  async function load() {
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name")
      .order("created_at", { ascending: true });

    setProjects(projectsData || []);

    const { data: activities } = await supabase
      .from("activities")
      .select("status");

    if (activities) {
      setTotalActivities(activities.length);
      setDoneActivities(
        activities.filter((a) => a.status === "concluído").length
      );
    }
  }

  async function createProject() {
    const name = prompt("Nome do projeto:");
    if (!name) return;

    await supabase.from("projects").insert({ name });
    load();
  }

  return (
    <AdminLayout>

      {/* TÍTULO */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">
          Projetos
        </h1>

        <Button text="Novo Projeto" onClick={createProject} />
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">Atividades programadas</p>
          <p className="text-2xl font-bold">{totalActivities}</p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">Atividades realizadas</p>
          <p className="text-2xl font-bold text-[var(--green)]">
            {doneActivities}
          </p>
        </div>
      </div>

      {/* LISTA DE PROJETOS */}
      <div className="grid grid-cols-3 gap-4">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => router.push(`/projetos/${project.id}`)}
            className="bg-white border rounded-xl p-4 text-left hover:shadow-md hover:border-[var(--green)] transition"
          >
            <p className="font-medium text-gray-800">
              {project.name}
            </p>
          </button>
        ))}
      </div>

    </AdminLayout>
  );
}
