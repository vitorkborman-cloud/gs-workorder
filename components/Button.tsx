type Props = {
  text: string;
  onClick?: () => void;
  type?: "button" | "submit";
};

export default function Button({
  text,
  onClick,
  type = "button",
}: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="w-full rounded-xl bg-gradient-to-r from-[var(--green)] to-[#6a9c22]
                 text-white font-extrabold py-3 tracking-wide
                 hover:opacity-90 active:scale-[0.98] transition"
    >
      {text}
    </button>
  );
}
