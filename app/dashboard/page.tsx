"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminLayout from "../../components/AdminLayout";
import SimpleCard from "../../components/SimpleCard";
import Button from "../../components/Button";
import { isMobileDevice } from "../../lib/isMobile";

export default function DashboardPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [doneActivities, setDoneActivities] = useState(0);

  useEffect(() => {
    // se for celular → manda para o app
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
    <AdminLayout
      sidebar={
        <div className="space-y-4 text-white">
          <SimpleCard
            title="Nº atividades programadas"
            value={totalActivities}
          />

          <SimpleCard
            title="Nº atividades realizadas"
            value={doneActivities}
          />
        </div>
      }
    >
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Projetos
        </h1>

        <Button text="Novo Projeto" onClick={createProject} />
      </div>

      {/* CARDS DE PROJETOS */}
      <div className="grid grid-cols-3 gap-5">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => router.push(`/projetos/${project.id}`)}
            className="
              text-left
              bg-white
              border border-gray-200
              rounded-xl
              p-5
              shadow-sm
              hover:shadow-md
              hover:border-[var(--green)]
              transition-all
              group
            "
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800 group-hover:text-[var(--green)]">
                {project.name}
              </span>

              <span className="text-sm text-gray-400 group-hover:text-[var(--green)]">
                Abrir →
              </span>
            </div>
          </button>
        ))}
      </div>
    </AdminLayout>
  );
}
