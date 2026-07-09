"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isMobileDevice } from "@/lib/isMobile";

type TelemetryDevice = {
  id: string;
  project_id: string;
  name: string;
  configuration_id: string;
  dados_id: string | null;
  status: string;
  last_reading: any;
  last_checked_at: string | null;
};

type ProjectGroup = {
  project: { id: string; name: string };
  devices: TelemetryDevice[];
};

type DeviceUrls = {
  device: TelemetryDevice;
  sistemaUrl: string;
  dadosUrl: string | null;
};

const STAGE_MS = 10_000;
const SLOW_REFRESH_MS = 2 * 60_000;
const HITEC_BASE = "https://app.telemetria.hitecnologia.com.br";

// A tela de Alarmes é a mesma URL da tela Sistema, só que rolada mais pra
// baixo. Como o iframe é de outro domínio, não dá pra chamar scrollTo() nele
// — em vez disso, o iframe é renderizado bem mais alto que o container
// (IFRAME_TALL_HEIGHT_PX) e deslocado pra cima em ALARMS_OFFSET_PX, revelando
// a tabela de alarmes. Esses dois números são um chute inicial — ajuste
// olhando o resultado real na tela.
const ALARMS_OFFSET_PX = 1700;
const IFRAME_TALL_HEIGHT_PX = 3600;

const STAGE_LABELS = ["Sistema", "Dados", "Alarmes"];

async function loadGroups(): Promise<ProjectGroup[]> {
  const { data: devices } = await supabase
    .from("telemetry_devices")
    .select("*")
    .order("name");
  if (!devices?.length) return [];

  const projectIds = [...new Set(devices.map((d) => d.project_id))];
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .in("id", projectIds)
    .order("name");

  const byProject = new Map<string, TelemetryDevice[]>();
  devices.forEach((d) => byProject.set(d.project_id, [...(byProject.get(d.project_id) ?? []), d]));

  return (projects ?? [])
    .filter((p) => byProject.has(p.id))
    .map((p) => ({ project: p, devices: byProject.get(p.id)! }));
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

// ─── Sub-telas ─────────────────────────────────────────────────────────────

function IframeGrid({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div
      className="flex-1 min-h-0 grid gap-6"
      style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}
    >
      {children}
    </div>
  );
}

function SistemaScreen({ urls }: { urls: DeviceUrls[] }) {
  return (
    <IframeGrid count={urls.length}>
      {urls.map(({ device, sistemaUrl }) => (
        <div key={device.id} className="relative h-full rounded-3xl overflow-hidden border border-white/10 bg-white">
          <iframe
            src={sistemaUrl}
            title={`${device.name} — Sistema`}
            className="w-full h-full border-0"
            scrolling="no"
          />
        </div>
      ))}
    </IframeGrid>
  );
}

function AlarmesScreen({ urls }: { urls: DeviceUrls[] }) {
  return (
    <IframeGrid count={urls.length}>
      {urls.map(({ device, sistemaUrl }) => (
        <div key={device.id} className="relative h-full rounded-3xl overflow-hidden border border-white/10 bg-white">
          <iframe
            src={sistemaUrl}
            title={`${device.name} — Alarmes`}
            className="absolute left-0 w-full border-0"
            style={{ top: -ALARMS_OFFSET_PX, height: IFRAME_TALL_HEIGHT_PX }}
            scrolling="no"
          />
        </div>
      ))}
    </IframeGrid>
  );
}

function DadosFallbackCard({ device }: { device: TelemetryDevice }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 h-full">
      <p className="font-bold text-2xl text-white mb-5">{device.name}</p>
      <p className="text-white/40 text-sm mb-5">Tela "Dados do Sistema" não configurada para este equipamento.</p>
      <div className="space-y-3 text-base">
        <div className="flex justify-between">
          <span className="text-white/40">Status do conector</span>
          <span className="text-white font-semibold">{device.last_reading?.connector_status ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Conectado</span>
          <span className="text-white font-semibold">{device.last_reading?.is_connected ? "Sim" : "Não"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Alarmes ativos</span>
          <span className="text-white font-semibold">{device.last_reading?.number_active_alarms ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Última atividade</span>
          <span className="text-white font-semibold">{formatDateTime(device.last_reading?.last_activity_at ?? null)}</span>
        </div>
      </div>
    </div>
  );
}

function DadosScreen({ urls }: { urls: DeviceUrls[] }) {
  return (
    <IframeGrid count={urls.length}>
      {urls.map(({ device, dadosUrl }) =>
        dadosUrl ? (
          <div key={device.id} className="relative h-full rounded-3xl overflow-hidden border border-white/10 bg-white">
            <iframe src={dadosUrl} title={`${device.name} — Dados`} className="w-full h-full border-0" scrolling="no" />
          </div>
        ) : (
          <DadosFallbackCard key={device.id} device={device} />
        )
      )}
    </IframeGrid>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────

export default function TvModePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (isMobileDevice()) {
      router.replace("/dashboard");
      return;
    }
    setReady(true);
    loadGroups().then(setGroups);
    const slow = setInterval(() => loadGroups().then(setGroups), SLOW_REFRESH_MS);
    return () => clearInterval(slow);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const tick = setInterval(() => setStepIndex((i) => i + 1), STAGE_MS);
    return () => clearInterval(tick);
  }, [ready]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const projectCount = groups.length;
  const projectIndex = projectCount ? Math.floor(stepIndex / 3) % projectCount : 0;
  const stage = stepIndex % 3; // 0 = Sistema, 1 = Dados, 2 = Alarmes
  const current = groups[projectIndex];

  // Recalculado só quando o projeto muda (não a cada tick do relógio), pra
  // não ficar recarregando os iframes a cada segundo.
  const urls: DeviceUrls[] = useMemo(() => {
    if (!current) return [];
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const range = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
    return current.devices.map((d) => ({
      device: d,
      sistemaUrl: `${HITEC_BASE}/dashboard/equipment/${d.configuration_id}`,
      dadosUrl: d.dados_id ? `${HITEC_BASE}/dashboard/equipment/${d.configuration_id}/${d.dados_id}?${range}` : null,
    }));
  }, [current]);

  const clockLabel = useMemo(
    () => now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    [now]
  );

  if (!ready) return null;

  return (
    <div className="w-screen h-screen bg-[#0b0f14] text-white flex flex-col p-12 overflow-hidden">
      {projectCount === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-2xl text-white/40 font-medium">Nenhum projeto com telemetria configurada.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-8 shrink-0">
            <div>
              <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-1">
                Telemetria — Greensoil
              </p>
              <h1 className="text-5xl font-black tracking-tight">{current?.project.name}</h1>
            </div>
            <div className="text-4xl font-black text-white/70 tabular-nums">{clockLabel}</div>
          </div>

          {/* Conteúdo do estágio */}
          {stage === 0 && <SistemaScreen urls={urls} />}
          {stage === 1 && <DadosScreen urls={urls} />}
          {stage === 2 && <AlarmesScreen urls={urls} />}

          {/* Rodapé: posição + progresso */}
          <div className="mt-8 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/40 font-semibold text-sm">
                Projeto {projectIndex + 1} de {projectCount}
              </p>
              <p className="text-white/40 font-semibold text-sm">{STAGE_LABELS[stage]}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STAGE_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`h-1.5 rounded-full transition-colors ${i === stage ? "bg-[#80b02d]" : "bg-white/10"}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
