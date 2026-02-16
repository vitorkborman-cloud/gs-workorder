"use client";

import { useRouter } from "next/navigation";

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
};

export default function MobileShell({
  title,
  subtitle,
  backHref,
  children,
}: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg)]">

      {/* HEADER */}
      <div className="bg-[var(--purple)] text-white px-4 py-4 shadow-md">
        <div className="max-w-xl mx-auto">

          {/* LINHA SUPERIOR */}
          <div className="flex items-center gap-3">

            {backHref && (
              <button
                onClick={() => router.push(backHref)}
                className="
                  w-9 h-9 rounded-full
                  bg-white/15 hover:bg-white/25
                  flex items-center justify-center
                  text-lg font-bold
                "
              >
                ←
              </button>
            )}

            <div>
              <h1 className="text-lg font-semibold leading-tight">
                {title}
              </h1>

              {subtitle && (
                <p className="text-xs opacity-80 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="max-w-xl mx-auto p-4 pb-10">
        {children}
      </div>
    </div>
  );
}
