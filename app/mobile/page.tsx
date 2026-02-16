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
        <div className="text-center text-gray-500 mt-10">
          Nenhum projeto disponível
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => router.push(`/mobile/projetos/${project.id}`)}
              className="
                w-full text-left p-4 rounded-2xl
                bg-[var(--green)] text-white
                shadow-sm active:scale-[0.98]
                transition-transform
              "
            >
              <div className="font-semibold text-base">
                {project.name}
              </div>
              <div className="text-xs opacity-90 mt-1">
                Abrir projeto
              </div>
            </button>
          ))}
        </div>
      )}

    </MobileShell>
  );
}
