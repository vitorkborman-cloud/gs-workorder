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

export default function MobileHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");

  const router = useRouter();

  async function loadProjects() {
    const { data: p } = await supabase
      .from("projects")
      .select("*");

    if (p) {
      const sorted = p.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
      );

      setProjects(sorted);
    }
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

                    <div className="font-semibold text-base">
                      {project.name}
                    </div>

                    <div className="text-lg opacity-80">
                      →
                    </div>

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