type Props = {
  title: string;
  value?: number;
  onClick?: () => void;
};

export default function SimpleCard({
  title,
  value,
  onClick,
}: Props) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-5 font-extrabold ${
        onClick
          ? "cursor-pointer hover:opacity-90"
          : ""
      }`}
    >
      <p className="text-sm">{title}</p>
      {value !== undefined && (
        <p className="text-3xl mt-2">{value}</p>
      )}
    </div>
  );
}
