"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isMobileDevice } from "@/lib/isMobile";

type TelemetryDevice = {
  id: string;
  project_id: string;
  name: string;
  configuration_id: string;
  reference_id: string;
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

type ActiveAlarm = {
  refId: string;
  name: string;
  level: string;
  deviceName: string;
  activatedAt: string | null;
};

// Tempo fixo de cada slide na tela (igual pra todos: Sistema, Dados e o
// resumo de alarmes no fim do ciclo).
// (Já tentamos esperar o iframe "carregar 100%" via evento onLoad em vez de
// tempo fixo, mas esse evento dispara assim que o HTML inicial chega — o
// dashboard em si (JS de outro domínio) ainda demora bem mais pra desenhar
// os dados, e não dá pra enxergar isso de fora por causa de CORS. Por isso
// usamos tempo fixo.)
const STAGE_MS = 30_000;
const SLOW_REFRESH_MS = 2 * 60_000;
const HITEC_BASE = "https://app.telemetria.hitecnologia.com.br";

// O portal da HI Tecnologia não é responsivo: cada painel é desenhado pra uma
// largura "natural" fixa (alguns equipamentos têm 2 sistemas lado a lado, bem
// mais largos que uma tela cheia) e não reflui quando o container é menor —
// só corta o conteúdo. Por isso o iframe é sempre renderizado nesse tamanho
// natural e depois encolhido com transform:scale() pra caber no espaço
// disponível, sem cortar nada. Ajuste esses valores se o conteúdo ainda
// aparecer cortado (aumente) ou muito pequeno pra ler (diminua).
const NATURAL_WIDTH = 2800;
const NATURAL_HEIGHT = 1400;

const STAGE_LABELS = ["Sistema", "Dados"];

// Alguns equipamentos não precisam passar por todos os estágios (ex.: a tela
// "Sistema" já traz os alarmes embutidos, sem precisar de um estágio
// separado). Chave = reference_id do equipamento na HI Tecnologia. Valor =
// quais índices de STAGE_LABELS mostrar, na ordem. Sem entrada aqui = todos.
const CUSTOM_STAGES: Record<string, number[]> = {
  "40313": [0], // Ecopro — só a tela Sistema
};

function stagesForProject(group: ProjectGroup): number[] {
  for (const d of group.devices) {
    if (CUSTOM_STAGES[d.reference_id]) return CUSTOM_STAGES[d.reference_id];
  }
  return [0, 1];
}

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

// Um "step" do ciclo do Modo TV é ou uma tela de projeto (Sistema/Dados) ou,
// uma vez por ciclo completo, o resumo compilado de alarmes de todos os
// projetos.
type Step =
  | { kind: "project"; projectIndex: number; stage: number }
  | { kind: "alarmsSummary" };

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

// Busca os alarmes ativos de UM equipamento (mesmo filtro usado pelo cron de
// notificações em supabase/functions/check-alarms).
async function fetchDeviceAlarms(d: TelemetryDevice): Promise<ActiveAlarm[]> {
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
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

// ─── Sub-telas ─────────────────────────────────────────────────────────────

function IframeGrid({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div className="flex-1 min-h-0 grid gap-6" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {children}
    </div>
  );
}

// Renderiza o iframe no tamanho "natural" da página (NATURAL_WIDTH) e
// encolhe com transform:scale() até caber na largura real do container,
// medida via ResizeObserver.
function ScaledFrame({ src, title }: { src: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / NATURAL_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-white">
      <iframe
        src={src}
        title={title}
        scrolling="no"
        className="border-0"
        style={{
          width: NATURAL_WIDTH,
          height: NATURAL_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}

function SistemaScreen({ urls }: { urls: DeviceUrls[] }) {
  return (
    <IframeGrid count={urls.length}>
      {urls.map(({ device, sistemaUrl }) => (
        <ScaledFrame key={device.id} src={sistemaUrl} title={`${device.name} — Sistema`} />
      ))}
    </IframeGrid>
  );
}

function DadosFallbackCard({ device }: { device: TelemetryDevice }) {
  return (
    <div className="bg-white/5 rounded-3xl border border-white/10 p-8 h-full overflow-y-auto">
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
          <ScaledFrame key={device.id} src={dadosUrl} title={`${device.name} — Dados`} />
        ) : (
          <DadosFallbackCard key={device.id} device={device} />
        )
      )}
    </IframeGrid>
  );
}

// Slide único, no fim do ciclo, com o compilado de alarmes de TODOS os
// projetos — um cartão por equipamento, "referencia, Projeto:" seguido da
// lista de alarmes ativos ou "Sem alarmes".
function AlarmsSummaryScreen({
  groups,
  allAlarms,
  loading,
}: {
  groups: ProjectGroup[];
  allAlarms: Record<string, ActiveAlarm[]>;
  loading: boolean;
}) {
  const entries = groups.flatMap((g) => g.devices.map((d) => ({ device: d, project: g.project })));
  const hasAnyData = Object.keys(allAlarms).length > 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {loading && !hasAnyData ? (
        <div className="h-full flex items-center justify-center text-white/40 text-xl animate-pulse">
          Carregando alarmes de todos os projetos...
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {entries.map(({ device, project }) => {
            const alarms = allAlarms[device.id] ?? [];
            return (
              <div key={device.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <p className="text-sm font-bold text-white/50 mb-3 uppercase tracking-wide">
                  {project.name}:
                </p>
                {alarms.length === 0 ? (
                  <p className="text-green-300 font-semibold flex items-center gap-2 text-lg">
                    <span>✓</span> Sem alarmes
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {alarms.map((a, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="text-white font-semibold">{a.name || "Alarme"}</span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${LEVEL_COLOR[a.level] ?? "bg-white/10 text-white/70 border-white/20"}`}>
                          {LEVEL_PT[a.level] ?? a.level ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  const [allAlarms, setAllAlarms] = useState<Record<string, ActiveAlarm[]>>({});
  const [loadingAllAlarms, setLoadingAllAlarms] = useState(false);

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

  // Esconde a barra de abas/endereço do navegador (Fullscreen API real, tipo
  // apresentação do PowerPoint). Só funciona a partir de um clique do
  // usuário — navegadores bloqueiam isso automático por segurança. O
  // cabeçalho/rodapé desta página continuam aparecendo normalmente; só o
  // chrome do navegador em si é escondido.
  function enterPresentation() {
    document.documentElement.requestFullscreen().catch(() => {});
  }

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // Sequência do ciclo: uma tela por (projeto, estágio), e no final um único
  // slide extra com o resumo compilado de alarmes de todos os projetos.
  const steps: Step[] = useMemo(() => {
    const projectSteps: Step[] = groups.flatMap((g, projectIndex) =>
      stagesForProject(g).map((stage) => ({ kind: "project" as const, projectIndex, stage }))
    );
    if (projectSteps.length === 0) return [];
    return [...projectSteps, { kind: "alarmsSummary" as const }];
  }, [groups]);

  const projectCount = groups.length;
  const activeStep = steps.length ? steps[stepIndex % steps.length] : null;
  const isAlarmsSummary = activeStep?.kind === "alarmsSummary";
  const projectIndex = activeStep?.kind === "project" ? activeStep.projectIndex : 0;
  const stage = activeStep?.kind === "project" ? activeStep.stage : 0; // 0 = Sistema, 1 = Dados
  const current = groups[projectIndex];

  // Avança pro próximo slide num tempo fixo, igual pra todos os tipos de slide.
  useEffect(() => {
    if (!ready || !steps.length) return;
    const t = setTimeout(() => setStepIndex((i) => i + 1), STAGE_MS);
    return () => clearTimeout(t);
  }, [ready, stepIndex, steps.length]);

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

  // Busca os alarmes ativos de TODOS os projetos de uma vez, só quando entra
  // no slide de resumo (não a cada segundo, e não nos outros slides).
  useEffect(() => {
    if (!isAlarmsSummary || groups.length === 0) return;
    let cancelled = false;
    setLoadingAllAlarms(true);

    (async () => {
      const allDevices = groups.flatMap((g) => g.devices);
      const perDevice = await Promise.all(
        allDevices.map(async (d) => [d.id, await fetchDeviceAlarms(d)] as const)
      );
      if (cancelled) return;
      setAllAlarms(Object.fromEntries(perDevice));
      setLoadingAllAlarms(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAlarmsSummary, groups]);

  const clockLabel = useMemo(
    () => now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    [now]
  );

  if (!ready) return null;

  return (
    <div className="w-screen h-screen bg-[#0b0f14] text-white flex flex-col p-4 overflow-hidden">
      {projectCount === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-2xl text-white/40 font-medium">Nenhum projeto com telemetria configurada.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-black tracking-tight">
                {isAlarmsSummary ? "Resumo de Alarmes" : current?.project.name}
              </h1>
              {!isAlarmsSummary && (
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
                  {STAGE_LABELS[stage]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <p className="text-xs font-semibold text-white/40">
                {isAlarmsSummary ? "Todos os projetos" : `Projeto ${projectIndex + 1} de ${projectCount}`}
              </p>
              <div className="text-xl font-black text-white/70 tabular-nums">{clockLabel}</div>
              <button
                onClick={enterPresentation}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 text-white/60 hover:bg-white/10 hover:text-white transition"
                title="Entrar em tela cheia (esconde a barra do navegador)"
              >
                Apresentar
              </button>
            </div>
          </div>

          {/* Conteúdo do estágio */}
          {!isAlarmsSummary && stage === 0 && <SistemaScreen urls={urls} />}
          {!isAlarmsSummary && stage === 1 && <DadosScreen urls={urls} />}
          {isAlarmsSummary && (
            <AlarmsSummaryScreen groups={groups} allAlarms={allAlarms} loading={loadingAllAlarms} />
          )}

          {/* Rodapé: progresso do estágio (2 pontos p/ Sistema/Dados) ou uma
              barra única destacada no slide de resumo de alarmes */}
          <div className="mt-3 shrink-0 grid grid-cols-2 gap-2">
            {isAlarmsSummary ? (
              <div className="col-span-2 h-1.5 rounded-full bg-[#80b02d]" />
            ) : (
              STAGE_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`h-1.5 rounded-full transition-colors ${i === stage ? "bg-[#80b02d]" : "bg-white/10"}`}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
