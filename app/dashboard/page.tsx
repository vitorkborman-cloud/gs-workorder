"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { isMobileDevice } from "../../lib/isMobile";

import AdminShell from "../../components/layout/AdminShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export default function DashboardPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const [totalProjects, setTotalProjects] = useState(0);
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
    const { data: p } = await supabase.from("projects").select("*");
    setProjects(p || []);
    setTotalProjects(p?.length || 0);

    const { data: a } = await supabase.from("activities").select("status");
    if (a) {
      setTotalActivities(a.length);
      setDoneActivities(a.filter((x) => x.status === "concluído").length);
    }
  }

  async function createProject() {
    if (!name) return;
    await supabase.from("projects").insert({ name });
    setName("");
    setOpen(false);
    load();
  }

  async function deleteProject(id: string, name: string) {
    const ok = confirm(`Excluir o projeto "${name}" permanentemente?`);
    if (!ok) return;

    await supabase.from("projects").delete().eq("id", id);
    load();
  }

  return (
    <AdminShell>
      <div className="space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Painel</h1>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:opacity-90 text-white font-semibold">
                Novo Projeto
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar projeto</DialogTitle>
              </DialogHeader>

              <div className="space-y-2">
                <Label>Nome do projeto</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <DialogFooter>
                <Button onClick={createProject} className="bg-primary text-white">
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* CARDS */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-primary text-white border-0 shadow-md">
            <CardContent className="p-6">
              <p className="text-sm opacity-80">Projetos</p>
              <p className="text-3xl font-bold mt-2">{totalProjects}</p>
            </CardContent>
          </Card>

          <Card className="bg-primary text-white border-0 shadow-md">
            <CardContent className="p-6">
              <p className="text-sm opacity-80">Atividades</p>
              <p className="text-3xl font-bold mt-2">{totalActivities}</p>
            </CardContent>
          </Card>

          <Card className="bg-primary text-white border-0 shadow-md">
            <CardContent className="p-6">
              <p className="text-sm opacity-80">Concluídas</p>
              <p className="text-3xl font-bold mt-2">{doneActivities}</p>
            </CardContent>
          </Card>
        </div>

        {/* LOUSA ROXA */}
        <div className="bg-secondary rounded-2xl p-6 space-y-4 shadow-inner">
          <h2 className="text-white text-lg font-semibold">Projetos</h2>

          <div className="grid md:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div key={project.id} className="relative">

                {/* BOTÃO X */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id, project.name);
                  }}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold shadow hover:bg-red-700 z-10"
                >
                  ✕
                </button>

                {/* CARD DO PROJETO */}
                <button
                  onClick={() => router.push(`/projetos/${project.id}`)}
                  className="w-full bg-primary text-white font-semibold rounded-xl p-6 text-left shadow hover:scale-[1.02] transition"
                >
                  {project.name}
                </button>

              </div>
            ))}
          </div>
        </div>

      </div>
    </AdminShell>
  );
}
