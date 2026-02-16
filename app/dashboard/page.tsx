"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { isMobileDevice } from "../../lib/isMobile";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isMobileDevice()) {
      router.replace("/mobile");
      return;
    }

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setEmail(data.user.email ?? "");
      setLoading(false);
    }

    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2b1720] flex items-center justify-center text-white">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#2b1720] text-white flex">

      {/* SIDEBAR */}
      <aside className="w-72 bg-[#391e2a] border-r border-white/10 p-6 hidden md:block">

        <div className="mb-10">
          <img src="/logo.png" className="h-8 brightness-0 invert mb-3"/>
          <div className="text-xs text-white/60">Painel administrativo</div>
        </div>

        <nav className="space-y-2">
          <a href="/dashboard" className="block rounded-xl px-4 py-3 bg-black/30 border border-white/10">
            Dashboard
          </a>

          <a href="/projetos" className="block rounded-xl px-4 py-3 hover:bg-black/30 border border-white/10">
            Projetos
          </a>
        </nav>

        <div className="mt-10 pt-6 border-t border-white/10 text-xs text-white/70">
          <div className="font-semibold text-white">{email}</div>

          <button
            onClick={handleLogout}
            className="mt-4 w-full rounded-xl bg-red-600 py-2 font-bold hover:bg-red-500 transition"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <main className="flex-1 p-8">

        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          <div className="rounded-2xl bg-[#391e2a] border border-white/10 p-5">
            <div className="text-sm text-white/70">Acesso rápido</div>
            <div className="text-lg font-bold mt-1">Projetos</div>
            <p className="text-sm text-white/70 mt-2">
              Crie e gerencie Work Orders
            </p>
            <a
              href="/projetos"
              className="inline-block mt-4 rounded-xl bg-[#80b02d] text-black px-4 py-2 font-bold hover:brightness-110 transition"
            >
              Abrir
            </a>
          </div>

          <div className="rounded-2xl bg-[#391e2a] border border-white/10 p-5">
            <div className="text-sm text-white/70">Campo</div>
            <div className="text-lg font-bold mt-1">Aplicativo Mobile</div>
            <p className="text-sm text-white/70 mt-2">
              Uso em campo para execução das atividades
            </p>
          </div>

        </div>

      </main>
    </div>
  );
}
