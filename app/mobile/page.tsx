"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AppShell from "../../components/AppShell";
import Card from "../../components/Card";

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
    <AppShell>
      <h1 className="text-xl font-bold text-[var(--purple)] mb-4">
        Projetos
      </h1>

      <div className="space-y-3">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() =>
              router.push(`/mobile/projetos/${project.id}`)
            }
            className="cursor-pointer"
          >
            <Card title={project.name} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
