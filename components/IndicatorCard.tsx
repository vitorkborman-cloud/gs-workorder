type Props = {
  title: string;
  value: number;
  subtitle?: string;
};

export default function IndicatorCard({
  title,
  value,
  subtitle,
}: Props) {
  return (
    <div className="bg-[var(--purple)] rounded-2xl p-6 text-white relative overflow-hidden">
      <p className="text-sm opacity-90 mb-2">{title}</p>

      <p className="text-3xl font-extrabold mb-1">
        {value.toLocaleString("pt-BR")}
      </p>

      {subtitle && (
        <p className="text-xs opacity-80">{subtitle}</p>
      )}

      {/* onda decorativa */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-white/10 rounded-t-full" />
    </div>
  );
}
