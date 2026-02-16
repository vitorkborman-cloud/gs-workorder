export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <div className="p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}
