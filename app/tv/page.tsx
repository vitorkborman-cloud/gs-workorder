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

const STAGE_MS = 10_000;
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

const STAGE_LABELS = ["Sistema", "Dados", "Alarmes"];

// Alguns equipamentos não precisam passar por todos os 3 estágios (ex.: a
// tela "Sistema" já traz os alarmes embutidos, sem precisar de um estágio
// separado). Chave = reference_id do equipamento na HI Tecnologia. Valor =
// quais índices de STAGE_LABELS mostrar, na ordem. Sem entrada aqui = todos.
const CUSTOM_STAGES: Record<string, number[]> = {
  "40313": [0], // Ecopro — só a tela Sistema
};

function stagesForProject(group: ProjectGroup): number[] {
  for (const d of group.devices) {
    if (CUSTOM_STAGES[d.reference_id]) return CUSTOM_STAGES[d.reference_id];
  }
  return [0, 1, 2];
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

function IframeGrid({ children, count, chrome }: { children: React.ReactNode; count: number; chrome: boolean }) {
  return (
    <div
      className={`flex-1 min-h-0 grid ${chrome ? "gap-6" : "gap-0"}`}
      style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}
    >
      {children}
    </div>
  );
}

// Renderiza o iframe no tamanho "natural" da página (NATURAL_WIDTH) e
// encolhe com transform:scale() até caber na largura real do container,
// medida via ResizeObserver. Com chrome=false, remove a borda/cantos
// arredondados pra ficar full-bleed.
function ScaledFrame({ src, title, chrome }: { src: string; title: string; chrome: boolean }) {
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
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-white ${chrome ? "rounded-3xl border border-white/10" : ""}`}
    >
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

function SistemaScreen({ urls, chrome }: { urls: DeviceUrls[]; chrome: boolean }) {
  return (
    <IframeGrid count={urls.length} chrome={chrome}>
      {urls.map(({ device, sistemaUrl }) => (
        <ScaledFrame key={device.id} src={sistemaUrl} title={`${device.name} — Sistema`} chrome={chrome} />
      ))}
    </IframeGrid>
  );
}

// O layout interno da tela "Sistema" muda de equipamento pra equipamento
// (em alguns a lista de alarmes já aparece do lado do P&ID, em outros fica
// só numa tabela de histórico bem mais abaixo, em posições diferentes) —
// não dá pra simular scroll de um jeito que funcione igual pra todos. Por
// isso essa tela busca os alarmes ativos ao vivo via edge function, com o
// mesmo filtro usado pelo cron de notificações (supabase/functions/check-alarms).
function AlarmesScreen({ alarms, loading }: { alarms: ActiveAlarm[] | undefined; loading: boolean }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
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
        <div className="space-y-4 overflow-y-auto">
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

function DadosFallbackCard({ device, chrome }: { device: TelemetryDevice; chrome: boolean }) {
  return (
    <div className={`bg-white/5 p-8 h-full overflow-y-auto ${chrome ? "rounded-3xl border border-white/10" : ""}`}>
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

function DadosScreen({ urls, chrome }: { urls: DeviceUrls[]; chrome: boolean }) {
  return (
    <IframeGrid count={urls.length} chrome={chrome}>
      {urls.map(({ device, dadosUrl }) =>
        dadosUrl ? (
          <ScaledFrame key={device.id} src={dadosUrl} title={`${device.name} — Dados`} chrome={chrome} />
        ) : (
          <DadosFallbackCard key={device.id} device={device} chrome={chrome} />
        )
      )}
    </IframeGrid>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────

export default function TvModePage() {
  const router = useRouter();
  const [chrome, setChrome] = useState(true);

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

  // Esconde a barra de abas/endereço do navegador (Fullscreen API real, tipo
  // apresentação do PowerPoint). Só funciona a partir de um clique do
  // usuário — navegadores bloqueiam isso automático por segurança. Ao sair
  // do modo tela cheia (Esc, ou o próprio navegador), o cabeçalho/rodapé
  // desta página voltam a aparecer.
  async function enterPresentation() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Se o navegador recusar (ex.: já em fullscreen, ou sem suporte),
      // ainda assim escondemos o chrome da própria página.
    }
    setChrome(false);
  }

  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) setChrome(true);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // Alguns projetos mostram menos de 3 estágios (CUSTOM_STAGES) — a
  // sequência exibida é a "achatada" de todos os (projeto, estágio) pra
  // percorrer, não um simples projectIndex*3 + stage.
  const steps = useMemo(
    () => groups.flatMap((g, projectIndex) => stagesForProject(g).map((stage) => ({ projectIndex, stage }))),
    [groups]
  );

  const projectCount = groups.length;
  const activeStep = steps.length ? steps[stepIndex % steps.length] : null;
  const projectIndex = activeStep?.projectIndex ?? 0;
  const stage = activeStep?.stage ?? 0; // 0 = Sistema, 1 = Dados, 2 = Alarmes
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

  // Busca os alarmes ativos só do projeto exibido no momento, só quando entra
  // no estágio Alarmes — evita bater na API da HI Tecnologia pra todos os
  // projetos de uma vez.
  useEffect(() => {
    if (!current || stage !== 2) return;
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
    <div className={`w-screen h-screen bg-[#0b0f14] text-white flex flex-col overflow-hidden ${chrome ? "p-4" : ""}`}>
      {projectCount === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-2xl text-white/40 font-medium">Nenhum projeto com telemetria configurada.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          {chrome && (
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl font-black tracking-tight">{current?.project.name}</h1>
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
                  {STAGE_LABELS[stage]}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-xs font-semibold text-white/40">
                  Projeto {projectIndex + 1} de {projectCount}
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
          )}

          {/* Conteúdo do estágio */}
          {stage === 0 && <SistemaScreen urls={urls} chrome={chrome} />}
          {stage === 1 && <DadosScreen urls={urls} chrome={chrome} />}
          {stage === 2 && (
            <AlarmesScreen
              alarms={current ? alarmsByProject[current.project.id] : undefined}
              loading={current ? !!loadingAlarms[current.project.id] : false}
            />
          )}

          {/* Rodapé: progresso do estágio */}
          {chrome && (
            <div className="mt-3 shrink-0 grid grid-cols-3 gap-2">
              {STAGE_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`h-1.5 rounded-full transition-colors ${i === stage ? "bg-[#80b02d]" : "bg-white/10"}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
