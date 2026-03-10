"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import MobileShell from "../../components/layout/MobileShell";

type Project = {
  id: string;
  name: string;
};

export default function MobileHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const router = useRouter();

  async function loadProjects() {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setProjects(data);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <MobileShell title="Projetos" subtitle="Selecione um projeto para continuar">

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-16 text-gray-400">

          <div className="text-4xl mb-3">📁</div>

          <p className="text-sm">
            Nenhum projeto disponível
          </p>

        </div>
      ) : (

        <div className="space-y-4">

          {projects.map((project) => (

            <button
              key={project.id}
              onClick={() => router.push(`/mobile/projetos/${project.id}`)}
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
              flex
              items-center
              justify-between
              "
            >

              <div>

                <div className="font-semibold text-base tracking-tight">
                  {project.name}
                </div>

                <div className="text-xs opacity-80 mt-1">
                  Abrir projeto
                </div>

              </div>

              <div className="text-white/80 text-lg">
                →
              </div>

            </button>

          ))}

        </div>

      )}

    </MobileShell>
  );
}