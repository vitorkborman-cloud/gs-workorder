"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Ícones SVG minimalistas
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Folder: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  FolderOpen: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    fetchProjects();

    // 🔥 MAGIA NEGRA: Escuta o banco de dados em tempo real!
    // Se um projeto for criado, alterado ou deletado, a sidebar atualiza sozinha.
    const channel = supabase
      .channel('realtime-projects')
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
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans text-gray-800">

      {/* ================= TOPBAR (FIXA) ================= */}
      <header className="h-16 bg-[#391e2a] text-white flex items-center justify-between px-6 fixed top-0 w-full z-50 shadow-md">
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Greensoil Logo"
            className="h-7 brightness-0 invert opacity-90"
          />
          <div className="h-6 w-px bg-white/20 mx-2"></div> {/* Separador */}
          <span className="font-bold tracking-wider text-sm uppercase text-white/90">
            Work Order System
          </span>
        </div>

        {/* Perfil Placeholder */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-white leading-tight">Admin Greensoil</p>
            <p className="text-xs text-[#80b02d] font-semibold">Engenharia</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-[#80b02d] flex items-center justify-center text-white font-bold shadow-inner">
            GS
          </div>
        </div>
      </header>

      {/* ================= CORPO DA PÁGINA ================= */}
      <div className="flex flex-1 pt-16">

        {/* ================= SIDEBAR (FIXA E ROLÁVEL) ================= */}
        <aside className="w-72 bg-white border-r border-gray-200 fixed left-0 top-16 h-[calc(100vh-4rem)] flex flex-col z-40 hidden md:flex shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          
          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            
            {/* Menu Principal */}
            <div>
              <h3 className="px-3 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
                Menu Principal
              </h3>
              <nav className="space-y-1">
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold ${
                    pathname === "/dashboard"
                      ? "bg-[#391e2a]/5 text-[#391e2a]"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span className={pathname === "/dashboard" ? "text-[#80b02d]" : "text-gray-400"}><Icons.Dashboard /></span>
                  Visão Geral
                </Link>
              </nav>
            </div>

            {/* Lista de Projetos (Dinâmica) */}
            <div>
              <div className="px-3 flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                  Portfólio de Projetos
                </h3>
                <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {projects.length}
                </span>
              </div>
              
              <nav className="space-y-1">
                {projects.length === 0 ? (
                  <p className="px-3 text-xs text-gray-400 italic">Nenhum projeto encontrado.</p>
                ) : (
                  projects.map((project) => {
                    const isActive = pathname.includes(`/projetos/${project.id}`);
                    
                    return (
                      <Link
                        key={project.id}
                        href={`/projetos/${project.id}`}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm ${
                          isActive
                            ? "bg-[#80b02d]/10 text-[#80b02d] font-bold"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium"
                        }`}
                      >
                        <span className={`${isActive ? "text-[#80b02d]" : "text-gray-400"}`}>
                          {isActive ? <Icons.FolderOpen /> : <Icons.Folder />}
                        </span>
                        <span className="truncate">{project.name}</span>
                      </Link>
                    );
                  })
                )}
              </nav>
            </div>

          </div>

          {/* Rodapé da Sidebar (Logout) */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
              <Icons.Logout />
              Sair do Sistema
            </button>
          </div>
        </aside>

        {/* ================= ÁREA DE CONTEÚDO PRINCIPAL ================= */}
        {/* A margem esquerda (md:ml-72) compensa a largura da sidebar fixa */}
        <main className="flex-1 md:ml-72 p-6 md:p-10 w-full overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}