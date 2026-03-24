"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
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

// ================= ÍCONES PREMIUM =================
const Icons = {
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Folder: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  Activity: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Check: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  ArrowRight: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
};

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

  const progress = totalActivities === 0 ? 0 : Math.round((doneActivities / totalActivities) * 100);

  const curveData = [
    { name: "Início", planejado: 0, executado: 0 },
    { name: "Planejado", planejado: 100, executado: progress }
  ];

  return (
    <AdminShell>
      <div className="space-y-10 pb-12 max-w-7xl mx-auto px-4">

        {/* ================= HEADER ================= */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-[#391e2a]">
              Visão Geral
            </h1>
            <p className="text-gray-500 font-medium mt-2">
              Acompanhe o desempenho e o portfólio de projetos da Greensoil.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold px-6 h-12 rounded-xl shadow-[0_8px_30px_rgb(128,176,45,0.3)] transition-all hover:-translate-y-1 flex items-center gap-2">
                <Icons.Plus /> Novo Projeto
              </Button>
            </DialogTrigger>

            <DialogContent className="rounded-3xl border-0 shadow-2xl sm:max-w-md p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[#391e2a]">Criar novo projeto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 my-4">
                <Label className="text-gray-500 font-bold uppercase tracking-wider text-xs">Nome do projeto</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: 40xxx, ..."
                  className="h-12 border-gray-200 focus:border-[#80b02d] focus:ring-[#80b02d] rounded-xl bg-gray-50"
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={createProject}
                  className="w-full bg-[#391e2a] hover:bg-[#2a161f] text-white h-12 rounded-xl font-bold text-md"
                >
                  Confirmar e Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* ================= CARDS KPI PREMIUM ================= */}
        <div className="grid md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
          
          <Card className="border-0 shadow-sm rounded-3xl bg-white overflow-hidden relative group hover:shadow-md transition-all">
            <CardContent className="p-8">
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-[#391e2a] mb-6 group-hover:scale-110 transition-transform">
                <Icons.Folder />
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Projetos Ativos</p>
              <p className="text-5xl font-black text-[#391e2a] mt-2">{totalProjects}</p>
            </CardContent>
            <div className="h-1.5 w-full bg-gradient-to-r from-[#391e2a] to-purple-800 absolute bottom-0 left-0 opacity-80" />
          </Card>

          <Card className="border-0 shadow-sm rounded-3xl bg-white overflow-hidden relative group hover:shadow-md transition-all">
            <CardContent className="p-8">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-600 mb-6 group-hover:scale-110 transition-transform">
                <Icons.Activity />
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total de Atividades</p>
              <p className="text-5xl font-black text-gray-800 mt-2">{totalActivities}</p>
            </CardContent>
            <div className="h-1.5 w-full bg-gray-200 absolute bottom-0 left-0" />
          </Card>

          <Card className="border-0 shadow-sm rounded-3xl bg-white overflow-hidden relative group hover:shadow-md transition-all">
            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-[#80b02d] group-hover:scale-110 transition-transform">
                  <Icons.Check />
                </div>
                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                  {progress}% Concluído
                </div>
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Ativ. Finalizadas</p>
              <p className="text-5xl font-black text-[#80b02d] mt-2">{doneActivities}</p>
              
              {/* Barra de progresso visualizada no card */}
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-6 overflow-hidden absolute bottom-0 left-0">
                <div className="bg-[#80b02d] h-full transition-all duration-1000" style={{ width: `${progress}%` }} />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ================= GRÁFICO (CURVA S) ================= */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#391e2a] flex items-center gap-2">
              <span className="w-2 h-6 bg-[#80b02d] rounded-full inline-block"></span>
              Curva S de Progresso
            </h2>
            <p className="text-sm text-gray-500 mt-1 ml-4">
              Comparativo físico entre planejamento esperado e execução real
            </p>
          </div>

          <div style={{ width: "100%", height: 350 }}>
            <ResponsiveContainer>
              <LineChart data={curveData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12 }} 
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                  itemStyle={{ color: '#391e2a' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                
                <Line
                  name="Avanço Planejado (%)"
                  type="monotone"
                  dataKey="planejado"
                  stroke="#E5E7EB"
                  strokeWidth={4}
                  dot={{ r: 6, fill: '#E5E7EB', strokeWidth: 0 }}
                  activeDot={{ r: 8 }}
                />
                <Line
                  name="Avanço Executado (%)"
                  type="monotone"
                  dataKey="executado"
                  stroke="#80b02d"
                  strokeWidth={4}
                  dot={{ r: 6, fill: '#80b02d', strokeWidth: 0 }}
                  activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ================= PORTFÓLIO DE PROJETOS ================= */}
        <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 pt-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-[#391e2a] tracking-tight">
              Portfólio de Projetos
            </h2>
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
              {projects.length} Registros
            </span>
          </div>

          <div className="grid md:grid-cols-3 xl:grid-cols-4 gap-5">
            {projects.map((project) => (
              <div key={project.id} className="relative group h-full">
                
                {/* BOTÃO DELETE SUTIL NO HOVER */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id, project.name);
                  }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-xs shadow-sm hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10"
                  title="Excluir projeto"
                >
                  <Icons.Trash />
                </button>

                {/* CARD DO PROJETO ESTILO "PASTA" */}
                <button
                  onClick={() => router.push(`/projetos/${project.id}`)}
                  className="
                    w-full h-full min-h-[140px]
                    bg-white border border-gray-200
                    text-left rounded-3xl p-6
                    flex flex-col justify-between
                    shadow-sm hover:shadow-xl hover:border-[#80b02d]/30
                    hover:-translate-y-1 transition-all duration-300
                  "
                >
                  <div className="bg-[#391e2a]/5 w-10 h-10 rounded-xl flex items-center justify-center text-[#391e2a] mb-4">
                    <Icons.Folder />
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-gray-800 text-base leading-tight line-clamp-2">
                      {project.name}
                    </h3>
                  </div>

                  <div className="mt-4 flex items-center text-xs font-bold text-[#80b02d] opacity-0 group-hover:opacity-100 transition-opacity transform -translate-x-2 group-hover:translate-x-0 duration-300">
                    Acessar painel <span className="ml-1"><Icons.ArrowRight /></span>
                  </div>
                </button>
              </div>
            ))}

            {/* CARD PARA ADICIONAR NOVO (Extra UX) */}
            <button
              onClick={() => setOpen(true)}
              className="
                w-full h-full min-h-[140px]
                bg-transparent border-2 border-dashed border-gray-300
                text-gray-400 rounded-3xl p-6
                flex flex-col items-center justify-center
                hover:border-[#80b02d] hover:text-[#80b02d] hover:bg-[#80b02d]/5
                transition-all duration-300
              "
            >
              <Icons.Plus />
              <span className="font-bold text-sm mt-2">Criar Projeto</span>
            </button>

          </div>
        </div>

      </div>
    </AdminShell>
  );
}