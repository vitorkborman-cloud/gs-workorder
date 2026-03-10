"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import MobileShell from "../../components/layout/MobileShell";

type Project = {
  id: string;
  name: string;
  favorite?: boolean;
};

type Activity = {
  project_id: string;
  status: string;
};

export default function MobileHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [search, setSearch] = useState("");

  const router = useRouter();

  async function loadProjects() {
    const { data: p } = await supabase
      .from("projects")
      .select("*");

    const { data: a } = await supabase
      .from("activities")
      .select("project_id,status");

    if (p) {
      const sorted = p.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
      );

      setProjects(sorted);
    }

    if (a) setActivities(a);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  function toggleFavorite(id: string) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, favorite: !p.favorite } : p
      )
    );
  }

function getProjectStats(projectId: string) {

  const acts = activities.filter(
    (a: any) =>
      a.project_id === projectId ||
      a.project === projectId ||
      a.projectId === projectId
  );

  const total = acts.length;

  const done = acts.filter(
    (a: any) =>
      a.status === "concluído" ||
      a.status === "concluido" ||
      a.status === "done"
  ).length;

  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  return { total, done, progress };
}

  const filteredProjects = projects
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    });

  return (
    <MobileShell
      title="Projetos"
      subtitle="Selecione um projeto para continuar"
    >

      {/* BUSCA */}
      <div className="mb-4">
        <input
          placeholder="Buscar projeto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="
          w-full
          p-3
          rounded-xl
          border
          border-gray-200
          text-sm
          outline-none
          focus:ring-2
          focus:ring-[var(--green)]
          "
        />
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-16 text-gray-400">

          <div className="text-4xl mb-3">📁</div>

          <p className="text-sm">
            Nenhum projeto encontrado
          </p>

        </div>
      ) : (

        <div className="space-y-4">

          {filteredProjects.map((project) => {
            const stats = getProjectStats(project.id);

            return (
              <div key={project.id} className="relative">

                {/* FAVORITE */}
                <button
                  onClick={() => toggleFavorite(project.id)}
                  className="
                  absolute
                  right-3
                  top-3
                  text-yellow-400
                  text-lg
                  z-10
                  "
                >
                  {project.favorite ? "★" : "☆"}
                </button>

                <button
                  onClick={() =>
                    router.push(`/mobile/projetos/${project.id}`)
                  }
                  className="
                  w-full
                  text-left
                  p-5
                  rounded-2xl
                  bg-gradient-to-br
                  from-[var(--green)]
                  to-[#5e8420]
                  text-white
                  shadow-lg
                  active:scale-[0.97]
                  transition-all
                  duration-200
                  "
                >

                  <div className="flex items-center justify-between">

                    <div>

                      <div className="font-semibold text-base">
                        {project.name}
                      </div>

                      <div className="text-xs opacity-80 mt-1">
                        {stats.done} de {stats.total} atividades concluídas
                      </div>

                    </div>

                    <div className="text-lg opacity-80">
                      →
                    </div>

                  </div>

                  {/* PROGRESS BAR */}

                  <div className="mt-3 h-2 w-full bg-white/30 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-white transition-all"
                      style={{ width: `${stats.progress}%` }}
                    />

                  </div>

                </button>
              </div>
            );
          })}
        </div>
      )}
    </MobileShell>
  );
}