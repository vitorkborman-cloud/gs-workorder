type Props = {
  title: string;
  children?: React.ReactNode;
};

export default function Card({ title, children }: Props) {
  return (
    <div className="bg-[var(--green)] rounded-xl p-4 shadow-sm">
      <h2 className="text-black font-extrabold text-sm mb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}
