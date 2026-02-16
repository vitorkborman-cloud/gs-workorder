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
      <aside className="w-72 bg-[var(--purple)] text-white flex flex-col px-6 py-8">

        {/* LOGO */}
        <div className="mb-10 flex items-center justify-center">
          <img
            src="/logo.png"
            className="h-10 object-contain brightness-0 invert"
          />
        </div>

        {/* CONTEÚDO DA SIDEBAR */}
        <div className="space-y-4 text-white">
          {sidebar}
        </div>

      </aside>

      {/* CONTEÚDO */}
      <main className="flex-1 p-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {children}
        </div>
      </main>

    </div>
  );
}
