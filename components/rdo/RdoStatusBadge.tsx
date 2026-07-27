const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  programado: { label: "Programado", className: "bg-amber-100 text-amber-700" },
  rascunho: { label: "Em preenchimento", className: "bg-blue-100 text-blue-700" },
  finalizado: { label: "Finalizado", className: "bg-green-100 text-green-700" },
};

export function RdoStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status || "—", className: "bg-gray-100 text-gray-500" };
  return (
    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
