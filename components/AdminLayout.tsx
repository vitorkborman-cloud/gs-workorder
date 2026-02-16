"use client";

export default function AdminLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#eef1f5] flex">

      {/* SIDEBAR */}
      <aside className="w-72 bg-[var(--purple)] text-white p-6 flex flex-col rounded-r-3xl shadow-xl">

        {/* LOGO */}
        <div className="mb-10 flex items-center gap-3">
          <img
            src="/logo.png"
            className="h-10 w-auto object-contain"
          />
          <span className="font-extrabold text-lg tracking-wide">
            GS Work Order
          </span>
        </div>

        {/* CARDS DA SIDEBAR */}
        <div className="space-y-4">
          {sidebar}
        </div>

        {/* RODAPÉ */}
        <div className="mt-auto text-xs opacity-70 pt-8">
          Sistema de campo
        </div>
      </aside>

      {/* CONTEÚDO */}
      <main className="flex-1 p-10">
        <div className="bg-white rounded-3xl shadow-lg p-8 min-h-[calc(100vh-80px)]">
          {children}
        </div>
      </main>

    </div>
  );
}
