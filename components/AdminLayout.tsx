"use client";

export default function AdminLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f3f4f6]">

      <div className="flex min-h-screen">

        {/* SIDEBAR */}
        <aside className="w-72 bg-[var(--purple)] p-6">
          {sidebar}
        </aside>

        {/* CONTEÚDO */}
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

      </div>

    </div>
  );
}
