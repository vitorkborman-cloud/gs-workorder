"use client";

export default function AdminLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-[#f3f4f6]">

      {/* SIDEBAR */}
      <aside className="w-60 bg-[var(--purple)] text-white flex flex-col">

        {/* LOGO */}
        <div className="h-16 flex items-center justify-center border-b border-white/10">
          <img
            src="/logo.png"
            className="h-7 object-contain brightness-0 invert"
          />
        </div>

        {/* MÉTRICAS */}
        <div className="p-4 space-y-3 text-white">
          {sidebar}
        </div>

      </aside>

      {/* CONTEÚDO */}
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {children}
        </div>
      </main>

    </div>
  );
}
