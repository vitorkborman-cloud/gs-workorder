"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { isMobileDevice } from "../../lib/isMobile";

import AdminShell from "../../components/layout/AdminShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../../components/ui/dialog";
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

    const sortedProjects =
      p?.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
      ) || [];

    setProjects(sortedProjects);
    setTotalProjects(sortedProjects.length);

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

  const progress = totalActivities === 0
  ? 0
  : Math.round((doneActivities / totalActivities) * 100);

const curveData = [
  { name: "Início", planejado: 0, executado: 0 },
  { name: "Planejado", planejado: 100, executado: progress }
];

  return (
    <AdminShell>
      <div className="space-y-8">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Painel</h1>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>

              <Button className="bg-gradient-to-r from-[#391e2a] to-[#80b02d] hover:opacity-90 text-white font-semibold px-6 shadow-lg">
                Novo Projeto
              </Button>

            </DialogTrigger>

            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Criar projeto</DialogTitle>
              </DialogHeader>

              <div className="space-y-2">
                <Label>Nome do projeto</Label>

                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <DialogFooter>

                <Button
                  onClick={createProject}
                  className="bg-gradient-to-r from-[#391e2a] to-[#80b02d] text-white"
                >
                  Criar
                </Button>

              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* CARDS KPI */}
        <div className="grid md:grid-cols-3 gap-6">

          <Card className="border-0 shadow-lg bg-gradient-to-br from-[#391e2a] to-[#5c3046] text-white rounded-2xl hover:scale-[1.02] transition">
            <CardContent className="p-6">
              <p className="text-sm opacity-80">Projetos</p>
              <p className="text-4xl font-bold mt-2">{totalProjects}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-[#80b02d] to-[#5e8420] text-white rounded-2xl hover:scale-[1.02] transition">
            <CardContent className="p-6">
              <p className="text-sm opacity-80">Atividades</p>
              <p className="text-4xl font-bold mt-2">{totalActivities}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-[#391e2a] to-[#80b02d] text-white rounded-2xl hover:scale-[1.02] transition">
            <CardContent className="p-6">
              <p className="text-sm opacity-80">Concluídas</p>
              <p className="text-4xl font-bold mt-2">{doneActivities}</p>
            </CardContent>
          </Card>

        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">

  <h2 className="text-lg font-semibold mb-4">
    Curva S do Projeto
  </h2>

  <div style={{ width: "100%", height: 300 }}>

    <ResponsiveContainer>

      <LineChart data={curveData}>

        <CartesianGrid strokeDasharray="3 3" />

        <XAxis dataKey="name" />

        <YAxis />

        <Tooltip />

        <Line
          type="monotone"
          dataKey="planejado"
          stroke="#80b02d"
          strokeWidth={3}
          dot={false}
        />

        <Line
          type="monotone"
          dataKey="executado"
          stroke="#391e2a"
          strokeWidth={3}
        />

      </LineChart>

    </ResponsiveContainer>

  </div>

</div>

        {/* ÁREA PROJETOS */}
        <div className="bg-gradient-to-br from-[#391e2a] to-[#2a1420] rounded-3xl p-8 shadow-inner space-y-6">

          <h2 className="text-white text-lg font-semibold tracking-wide">
            Projetos
          </h2>

          <div className="grid md:grid-cols-3 xl:grid-cols-4 gap-6">

            {projects.map((project) => (
              <div key={project.id} className="relative group">

                {/* BOTÃO DELETE */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id, project.name);
                  }}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold shadow hover:bg-red-700 opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>

                {/* CARD PROJETO */}
                <button
                  onClick={() => router.push(`/projetos/${project.id}`)}
                  className="
                  w-full
                  bg-gradient-to-br
                  from-[#80b02d]
                  to-[#5e8420]
                  text-white
                  font-semibold
                  rounded-2xl
                  p-6
                  text-left
                  shadow-xl
                  hover:shadow-2xl
                  hover:-translate-y-1
                  transition
                "
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