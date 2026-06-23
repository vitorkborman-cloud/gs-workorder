"use client";

import { useRouter } from "next/navigation";

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export default function MobileShell({ title, subtitle, backHref, children, actions }: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f4f5f7]">

      {/* HEADER */}
      <div className="bg-[#391e2a] px-4 pt-5 pb-6 shadow-lg relative overflow-hidden">
        {/* Detalhe decorativo */}
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative max-w-xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {backHref && (
                <button
                  onClick={() => router.push(backHref)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition shrink-0 active:scale-90"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              <div className="min-w-0">
                <h1 className="text-white font-bold text-lg leading-tight truncate">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-white/50 text-xs mt-0.5 font-medium truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {actions && (
              <div className="shrink-0">{actions}</div>
            )}
          </div>
        </div>
      </div>

      {/* CONTEÚDO — sobe levemente sobre o header */}
      <div className="max-w-xl mx-auto px-4 -mt-3 pb-10">
        <div className="bg-[#f4f5f7] rounded-t-3xl pt-4 min-h-screen">
          {children}
        </div>
      </div>

    </div>
  );
}
