
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // Atenção ao atalho @/lib/supabase

// Ícones minimalistas para o menu
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Folder: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  FolderOpen: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>,
};

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    fetchProjects();

    // Atualiza a sidebar em tempo real se um projeto for criado/deletado
    const channel = supabase
      .channel('realtime-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchProjects();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchProjects() {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .order("name", { ascending: true });

    if (data) setProjects(data);
  }

  return (
    <div className="min-h-screen flex bg-[#f3f4f6]">

      {/* SIDEBAR */}
      <aside className="w-64 bg-[#391e2a] text-white flex flex-col fixed h-screen z-50 shadow-xl">

        {/* LOGO */}
        <div className="h-14 flex items-center justify-center border-b border-white/10 px-4 shrink-0 bg-[#391e2a]">
          <Image
            src="/logo.png"
            alt="Greensoil"
            width={140}
            height={40}
            className="object-contain brightness-0 invert"
            priority
          />
        </div>

        {/* MENU COM SCROLL INVISÍVEL */}
        <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          
          <div className="space-y-1 mb-6">
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                pathname === "/dashboard" || pathname === "/"
                  ? "bg-white/10 text-white font-bold"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icons.Dashboard />
              Visão Geral
            </Link>
          </div>

          <div className="mb-2 px-4">
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
              Projetos Ativos
            </span>
          </div>

          <div className="space-y-1">
            {projects.length === 0 ? (
              <p className="px-4 text-xs text-white/30 italic mt-2">Nenhum projeto...</p>
            ) : (
              projects.map((p) => {
                const isActive = pathname.includes(`/projetos/${p.id}`);
                return (
                  <Link
                    key={p.id}
                    href={`/projetos/${p.id}`}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm ${
                      isActive
                        ? "bg-[#80b02d] text-white font-bold shadow-md"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {isActive ? <Icons.FolderOpen /> : <Icons.Folder />}
                    <span className="truncate">{p.name}</span>
                  </Link>
                );
              })
            )}
          </div>
        </nav>

        {/* FOOTER */}
        <div className="p-4 border-t border-white/10 shrink-0 bg-[#391e2a]">
          <button className="w-full bg-white/10 hover:bg-red-500/80 hover:text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
            Sair do sistema
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL (COM MARGEM PARA A SIDEBAR FIXA) */}
      <div className="flex-1 flex flex-col ml-64 min-w-0">

        {/* HEADER */}
        <header className="h-14 flex items-center px-6 border-b border-black/10 bg-[#4b2634] text-white fixed w-[calc(100%-16rem)] z-40 shadow-sm">
          <span className="font-semibold tracking-wide text-sm opacity-90">
            Painel administrativo
          </span>
        </header>

        {/* PAGE */}
        <main className="flex-1 p-8 mt-14 overflow-x-hidden">
          {children}
        </main>

      </div>

      {/* Estilo CSS para deixar a barra de rolagem da Sidebar invisível/elegante */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}