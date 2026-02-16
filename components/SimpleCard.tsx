export default function SimpleCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="bg-white/10 border border-white/15 rounded-lg px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide opacity-80">
        {title}
      </p>
      <p className="text-xl font-semibold leading-tight">
        {value}
      </p>
    </div>
  );
}
