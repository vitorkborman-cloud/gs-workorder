type Props = {
  label: string;
  value: number;
};

export default function MetricCard({ label, value }: Props) {
  return (
    <div className="bg-[var(--green)] rounded-xl p-4">
      <p className="text-xs font-bold text-black mb-1">
        {label}
      </p>
      <p className="text-2xl font-extrabold text-black">
        {value}
      </p>
    </div>
  );
}
