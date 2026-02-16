"use client";

import Image from "next/image";
import { ReactNode } from "react";

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#f3f4f6]">

      {/* SIDEBAR */}
      <aside className="w-64 bg-[#391e2a] text-white flex flex-col">

        {/* LOGO */}
        <div className="h-16 flex items-center justify-center border-b border-white/10 px-4">
          <Image
            src="/logo.png"
            alt="Greensoil"
            width={140}
            height={40}
            className="object-contain brightness-0 invert"
            priority
          />
        </div>

        {/* MENU */}
        <nav className="flex-1 p-4 space-y-2">
          <a
            href="/dashboard"
            className="block px-4 py-2 rounded-lg hover:bg-white/10 transition"
          >
            Projetos
          </a>
        </nav>

        {/* FOOTER */}
        <div className="p-4 border-t border-white/10">
          <button className="w-full bg-white/10 hover:bg-white/20 rounded-lg py-2 text-sm transition">
            Sair
          </button>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <div className="flex-1 flex flex-col">

        {/* HEADER */}
        <header className="h-14 flex items-center px-6 border-b border-black/10 bg-[#4b2634] text-white">
          <span className="font-semibold tracking-wide">
            Painel administrativo
          </span>
        </header>

        {/* PAGE */}
        <main className="flex-1 p-8">
          {children}
        </main>

      </div>
    </div>
  );
}
