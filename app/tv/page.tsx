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
  status: string;
  last_reading: any;
  last_checked_at: string | null;
};

type ProjectGroup = {
  project: { id: string; name: string };
  devices: TelemetryDevice[];
};

type ActiveAlarm = {
  refId: string;
  name: string;
  level: string;
  deviceName: string;
  activatedAt: string | null;
};

const STAGE_MS = 10_000;
const SLOW_REFRESH_MS = 2 * 60_000;

const LEVEL_PT: Record<string, string> = {
  critical: "Crítico",
  base_high: "Alto",
  base_medium: "Médio",
  base_low: "Baixo",
  warning: "Aviso",
  info: "Info",
};

const LEVEL_COLOR: Record<string, string> = {
  critical: "bg-red-500/15 text-red-300 border-red-500/30",
  base_high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  base_medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  base_low: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

const STAGE_LABELS = ["Sistema", "Alarmes", "Dados"];

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

function statusPill(status: string) {
  if (status === "online") return "bg-green-500/15 text-green-300 border-green-500/30";
  if (status === "offline") return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-gray-500/15 text-gray-300 border-gray-500/30";
}

function statusLabel(status: string) {
  if (status === "online") return "● Online";
  if (status === "offline") return "● Offline";
  return "— Sem dados";
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

// ─── Sub-telas ─────────────────────────────────────────────────────────────

function SistemaScreen({ devices }: { devices: TelemetryDevice[] }) {
  const online = devices.filter((d) => d.status === "online").length;
  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-8 flex items-center gap-4">
        <span className="text-lg font-bold text-white/60 uppercase tracking-widest">Sistema</span>
        <span className="text-sm font-semibold bg-white/10 text-white/70 px-3 py-1 rounded-full">
          {online}/{devices.length} online
        </span>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-6">
        {devices.map((d) => (
          <div key={d.id} className="bg-white/5 border border-white/10 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-2xl text-white">{d.name}</p>
              <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${statusPill(d.status)}`}>
                {statusLabel(d.status)}
              </span>
            </div>
            {d.last_reading?.number_active_alarms > 0 && (
              <div className="text-amber-300 font-semibold text-base mb-2">
                ⚠️ {d.last_reading.number_active_alarms} alarme{d.last_reading.number_active_alarms > 1 ? "s" : ""} ativo{d.last_reading.number_active_alarms > 1 ? "s" : ""}
              </div>
            )}
            <p className="text-white/40 text-sm">Última atividade: {formatDateTime(d.last_reading?.last_activity_at ?? null)}</p>
            <p className="text-white/30 text-xs mt-1">Checado: {formatDateTime(d.last_checked_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlarmesScreen({ alarms, loading }: { alarms: ActiveAlarm[] | undefined; loading: boolean }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-8">
        <span className="text-lg font-bold text-white/60 uppercase tracking-widest">Alarmes</span>
      </div>
      {loading && !alarms ? (
        <div className="flex-1 flex items-center justify-center text-white/40 text-xl animate-pulse">
          Carregando alarmes...
        </div>
      ) : !alarms || alarms.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-green-300">
          <span className="text-6xl">✓</span>
          <p className="text-2xl font-bold">Nenhum alarme ativo</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alarms.map((a, i) => (
            <div key={`${a.refId}-${i}`} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-8 py-6">
              <div>
                <p className="font-bold text-2xl text-white">{a.name || "Alarme"}</p>
                <p className="text-white/40 text-base mt-1">{a.deviceName}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white/40 text-sm">{formatDateTime(a.activatedAt)}</span>
                <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${LEVEL_COLOR[a.level] ?? "bg-white/10 text-white/70 border-white/20"}`}>
                  {LEVEL_PT[a.level] ?? a.level ?? "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DadosScreen({ devices }: { devices: TelemetryDevice[] }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-8">
        <span className="text-lg font-bold text-white/60 uppercase tracking-widest">Dados</span>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-6">
        {devices.map((d) => (
          <div key={d.id} className="bg-white/5 border border-white/10 rounded-3xl p-8">
            <p className="font-bold text-2xl text-white mb-5">{d.name}</p>
            <div className="space-y-3 text-base">
              <div className="flex justify-between">
                <span className="text-white/40">Status do conector</span>
                <span className="text-white font-semibold">{d.last_reading?.connector_status ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Conectado</span>
                <span className="text-white font-semibold">{d.last_reading?.is_connected ? "Sim" : "Não"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Alarmes ativos</span>
                <span className="text-white font-semibold">{d.last_reading?.number_active_alarms ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Última atividade</span>
                <span className="text-white font-semibold">{formatDateTime(d.last_reading?.last_activity_at ?? null)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────

export default function TvModePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [now, setNow] = useState(new Date());
  const [alarmsByProject, setAlarmsByProject] = useState<Record<string, ActiveAlarm[]>>({});
  const [loadingAlarms, setLoadingAlarms] = useState<Record<string, boolean>>({});

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
  const stage = stepIndex % 3;
  const current = groups[projectIndex];

  useEffect(() => {
    if (!current || stage !== 1) return;
    let cancelled = false;
    const pid = current.project.id;
    setLoadingAlarms((prev) => ({ ...prev, [pid]: true }));

    (async () => {
      const perDevice = await Promise.all(
        current.devices.map(async (d) => {
          const { data, error } = await supabase.functions.invoke(
            `telemetria?action=alarmes&configId=${d.configuration_id}`,
            { method: "GET" }
          );
          if (error || !Array.isArray(data)) return [];
          const configIdNum = Number(d.configuration_id);
          return data
            .filter(
              (a: any) =>
                a.alarm_current_state?.state === true &&
                a.data?.device?.connector?.id === configIdNum
            )
            .map((a: any) => ({
              refId: a.reference_id ?? String(a.id),
              name: a.name ?? "",
              level: a.level ?? "",
              deviceName: d.name,
              activatedAt: a.alarm_current_state?.datetime_last_activation ?? null,
            }));
        })
      );
      if (cancelled) return;
      setAlarmsByProject((prev) => ({ ...prev, [pid]: perDevice.flat() }));
      setLoadingAlarms((prev) => ({ ...prev, [pid]: false }));
    })();

    return () => {
      cancelled = true;
    };
  }, [stage, current]);

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
          <div className="flex items-center justify-between mb-10 shrink-0">
            <div>
              <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-1">
                Telemetria — Greensoil
              </p>
              <h1 className="text-5xl font-black tracking-tight">{current?.project.name}</h1>
            </div>
            <div className="text-4xl font-black text-white/70 tabular-nums">{clockLabel}</div>
          </div>

          {/* Conteúdo do estágio */}
          {stage === 0 && current && <SistemaScreen devices={current.devices} />}
          {stage === 1 && current && (
            <AlarmesScreen
              alarms={alarmsByProject[current.project.id]}
              loading={!!loadingAlarms[current.project.id]}
            />
          )}
          {stage === 2 && current && <DadosScreen devices={current.devices} />}

          {/* Rodapé: posição + progresso */}
          <div className="mt-10 shrink-0">
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
