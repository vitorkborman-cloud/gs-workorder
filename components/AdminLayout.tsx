"use client";

export default function AdminLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f6f7f9] p-6">
      <div className="flex gap-6">
        {/* SIDEBAR */}
        <aside className="w-72 bg-[var(--purple)] rounded-2xl p-6">
          {sidebar}
        </aside>

        {/* CONTEÚDO */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
