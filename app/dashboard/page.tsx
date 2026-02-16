"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminLayout from "../../components/AdminLayout";
import SimpleCard from "../../components/SimpleCard";
import Button from "../../components/Button";

export default function DashboardPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [doneActivities, setDoneActivities] = useState(0);

  async function load() {
    // Projetos
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name")
      .order("created_at", { ascending: true });

    setProjects(projectsData || []);

    // Todas as atividades
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

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminLayout
      sidebar={
        <div className="space-y-4 text-black">
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
      {/* TOPO */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">
          Projetos
        </h1>

        <Button text="Novo Projeto" onClick={createProject} />
      </div>

      {/* CARDS DE PROJETOS */}
      <div className="grid grid-cols-3 gap-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-[var(--green)] rounded-2xl p-6 cursor-pointer hover:opacity-90"
            onClick={() => router.push(`/projetos/${project.id}`)}
          >
            <p className="font-extrabold text-black text-lg">
              {project.name}
            </p>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
