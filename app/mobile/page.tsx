"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import MobileShell from "../../components/layout/MobileShell";

// ================= ÍCONES INLINE (Design Premium) =================
const Icons = {
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  MapPin: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Star: ({ filled }: { filled?: boolean }) => (
    <svg className={`w-6 h-6 transition-all duration-300 ${filled ? "text-yellow-400 fill-yellow-400 scale-110" : "text-gray-300 fill-transparent hover:text-yellow-400"}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  ChevronRight: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>,
  FolderOpen: () => <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
};

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
    // ATENÇÃO: Isso muda só na tela. Depois lembre de salvar essa preferência no banco se necessário!
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
      <div className="px-1 pb-6 space-y-6">
        
        {/* BUSCA COM DESIGN MODERNO */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#80b02d] transition-colors">
            <Icons.Search />
          </div>
          <input
            placeholder="Buscar projeto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-[#391e2a] outline-none focus:ring-2 focus:ring-[#80b02d]/50 focus:border-[#80b02d] transition-all placeholder:text-gray-300"
          />
        </div>

        {/* LISTAGEM DE PROJETOS */}
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-gray-300 space-y-4 animate-in fade-in zoom-in duration-300">
            <Icons.FolderOpen />
            <p className="text-sm font-medium text-gray-400">
              Nenhum projeto encontrado.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProjects.map((project, index) => {
              
              // Efeito de cascata na animação
              const animationDelay = `${index * 50}ms`;

              return (
                <div
                  key={project.id}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                  style={{ animationDelay }}
                >
                  <button
                    onClick={() => router.push(`/mobile/projetos/${project.id}`)}
                    className="group relative w-full text-left bg-white rounded-3xl p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100/80 active:scale-[0.97] transition-all duration-200 flex items-center justify-between overflow-hidden"
                  >
                    
                    {/* BARRINHA LATERAL (Detalhe sutil) */}
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#80b02d] to-[#608522] opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex items-center gap-4 w-full pr-2">
                      
                      {/* ÍCONE DO PROJETO (Avatar) */}
                      <div className="w-12 h-12 rounded-2xl bg-[#80b02d]/10 text-[#80b02d] flex items-center justify-center shrink-0 shadow-inner">
                        <Icons.MapPin />
                      </div>

                      {/* TEXTO DO PROJETO */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[#391e2a] text-[15px] truncate">
                          {project.name}
                        </h3>
                        <p className="text-xs text-gray-400 font-medium mt-0.5 tracking-wide uppercase">
                          Acessar painel
                        </p>
                      </div>

                      {/* AÇÕES (Estrela + Seta) */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div
                          onClick={(e) => {
                            e.stopPropagation(); // Impede que o clique na estrela abra o projeto
                            toggleFavorite(project.id);
                          }}
                          className="p-2 -m-2 z-10"
                        >
                          <Icons.Star filled={project.favorite} />
                        </div>

                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#80b02d] group-hover:text-white transition-colors shadow-sm ml-1">
                          <Icons.ChevronRight />
                        </div>
                      </div>

                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MobileShell>
  );
}