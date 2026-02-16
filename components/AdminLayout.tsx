"use client";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col">

      {/* TOPBAR */}
      <header className="h-14 bg-[var(--purple)] text-white flex items-center px-6 shadow-sm">
        <img
          src="/logo.png"
          className="h-6 brightness-0 invert mr-3"
        />
        <span className="font-semibold tracking-wide">
          GS Work Order
        </span>
      </header>

      <div className="flex flex-1">

        {/* SIDEBAR */}
        <aside className="w-52 bg-white border-r border-gray-200 p-4">
          <nav className="space-y-2 text-sm">
            <div className="font-semibold text-gray-400 uppercase text-xs mb-2">
              Navegação
            </div>

            <button className="w-full text-left px-3 py-2 rounded-lg bg-gray-100 font-medium">
              Projetos
            </button>
          </nav>
        </aside>

        {/* CONTEÚDO */}
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
