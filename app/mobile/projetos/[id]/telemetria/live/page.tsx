"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function LiveView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const projectId = params.id as string;
  const configId = searchParams.get("configId");
  const name = searchParams.get("name") ?? "Equipamento";

  if (!configId) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        Equipamento não identificado.
      </div>
    );
  }

  const portalUrl = `https://app.telemetria.hitecnologia.com.br/dashboard/equipment/${configId}`;

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {/* Barra de volta */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-3 bg-[#391e2a]/90 backdrop-blur-sm">
        <button
          onClick={() => router.back()}
          className="text-white/80 active:text-white"
          aria-label="Voltar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate">{name}</p>
          <p className="text-white/50 text-[10px]">Visualização ao vivo</p>
        </div>
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/60 active:text-white"
          aria-label="Abrir no navegador"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* iframe fullscreen */}
      <iframe
        src={portalUrl}
        className="w-full h-full border-0 pt-[52px]"
        title={name}
        allow="fullscreen"
      />
    </div>
  );
}

export default function TelemetriaLivePage() {
  return (
    <Suspense>
      <LiveView />
    </Suspense>
  );
}
