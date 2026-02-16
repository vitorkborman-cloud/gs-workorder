export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#eef1f5] flex justify-center">

      {/* TELA DO APP */}
      <div className="w-full max-w-md min-h-screen bg-white shadow-xl">

        {/* HEADER */}
        <div className="bg-[var(--purple)] text-white p-4 text-center font-bold text-lg tracking-wide">
          GS Work Order
        </div>

        {/* CONTEÚDO */}
        <div className="p-4 space-y-4">
          {children}
        </div>

      </div>

    </div>
  );
}
