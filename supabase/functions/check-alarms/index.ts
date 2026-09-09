import webpush from "npm:web-push@3.6.7";

// Edge Function: verifica mudanças de alarme via /connectors/ e envia push notifications
// Chamada a cada 10 minutos direto pelo pg_cron do próprio Supabase (job
// 'check-telemetry-alarms', ver scripts/push_subscriptions.sql e
// supabase/migrations/0012_check_alarms_10min_roundrobin.sql) via
// net.http_post. Status de conexão é checado pra todos os equipamentos
// toda rodada; o endpoint de alarmes (mais restrito na API da HI
// Tecnologia) é revezado, um equipamento por rodada — ver
// ROUND_INTERVAL_MIN mais abaixo.
//
// Existiu uma rota Next.js (app/api/cron/check-alarms) chamada por um
// serviço externo (cron-job.org) a cada 2 minutos, de antes do pg_cron
// direto — foi removida em 2026-09-09 porque os dois gatilhos rodando
// juntos duplicavam as chamadas (checagem de fato a cada ~2 min em vez de
// 15, disparando alertas de falha/normalização em rajada). Se algum
// serviço externo de cron ainda estiver configurado pra chamar aquela URL,
// cancele-o — a rota não existe mais.

const HITEC_BASE_URL = "https://api.telemetria.hitecnologia.com.br/rest/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Helpers Supabase REST ──────────────────────────────────────────────────────

function sbHeaders() {
  return {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  };
}

async function sbGet(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  return r.json();
}

// ── Login HI Tecnologia ────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getHitecToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const user = Deno.env.get("HITEC_API_USER");
  const password = Deno.env.get("HITEC_API_PASSWORD");
  if (!user || !password) return null;

  const r = await fetch(`${HITEC_BASE_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user, password: btoa(password) }),
  });
  if (!r.ok) return null;

  const d = await r.json();
  const token = d.token || d.access_token || d.accessToken || d.access || d.key;
  if (!token) return null;

  cachedToken = token;
  tokenExpiresAt = Date.now() + 25 * 60 * 1000;
  return token;
}

// ── Mapa de níveis de alarme ────────────────────────────────────────────────────

const LEVEL_PT: Record<string, string> = {
  critical: "Crítico",
  base_high: "Alto",
  base_medium: "Médio",
  base_low: "Baixo",
  warning: "Aviso",
  info: "Info",
};

// ── Busca alarmes ativos do conector ───────────────────────────────────────────

interface ActiveAlarm {
  refId: string;
  name: string;
  level: string;
  connectorName: string;
  activatedAt: string | null;
  state: boolean;
}

interface AlarmEvent extends ActiveAlarm {
  historyId: string;
}

// Busca TODOS os alarmes cadastrados no conector (ativos ou não). É importante
// não filtrar só os ativos: um alarme pode ativar e voltar ao normal entre duas
// checagens deste equipamento (só acontece na sua vez do revezamento, ~80
// min de intervalo com 8 equipamentos) e ainda assim precisa ser detectado.
async function fetchAllAlarms(configId: string, token: string): Promise<ActiveAlarm[]> {
  try {
    const r = await fetch(`${HITEC_BASE_URL}/alarms/?configurationId=${configId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!r.ok) return [];

    const alarms: any[] = await r.json();
    if (!Array.isArray(alarms)) return [];

    const configIdNum = Number(configId);
    return alarms
      .filter((a) => a.data?.device?.connector?.id === configIdNum)
      .map((a) => ({
        refId: a.reference_id ?? String(a.id),
        name: a.name ?? "",
        level: a.level ?? "",
        connectorName: a.data?.device?.connector?.name ?? "",
        activatedAt: a.alarm_current_state?.datetime_last_activation ?? null,
        state: a.alarm_current_state?.state === true,
      }));
  } catch {
    return [];
  }
}

// Registra no histórico os eventos de alarme (device + refId + activated_at).
// A constraint UNIQUE da tabela garante que só volta na resposta (return=representation)
// o que for genuinamente novo — isso substitui a antiga comparação em memória contra
// o último snapshot, que perdia alarmes que já tivessem voltado ao normal.
async function insertNewAlarmEvents(deviceId: string, alarms: ActiveAlarm[]): Promise<AlarmEvent[]> {
  const rows = alarms
    .filter((a) => a.activatedAt)
    .map((a) => ({
      device_id: deviceId,
      alarm_ref_id: a.refId,
      alarm_name: a.name,
      level: a.level,
      activated_at: a.activatedAt,
    }));
  if (rows.length === 0) return [];

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/alarm_history?on_conflict=device_id,alarm_ref_id,activated_at`,
    {
      method: "POST",
      headers: { ...sbHeaders(), "Prefer": "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(rows),
    }
  );
  if (!r.ok) return [];

  const inserted: any[] = await r.json();
  const historyIdByRefId = new Map(inserted.map((row: any) => [row.alarm_ref_id as string, row.id as string]));
  return alarms
    .filter((a) => historyIdByRefId.has(a.refId))
    .map((a) => ({ ...a, historyId: historyIdByRefId.get(a.refId)! }));
}

async function markNotified(historyIds: string[]) {
  if (historyIds.length === 0) return;
  await fetch(`${SUPABASE_URL}/rest/v1/alarm_history?id=in.(${historyIds.join(",")})`, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ notified: true }),
  });
}

// Alarmes muito antigos (ex: backlog na primeira execução após o deploy desta
// tabela) são registrados no histórico mas não disparam push — só notificamos
// ativações recentes de fato. A janela precisa ser MAIOR que o ciclo
// completo do revezamento de alarmes (devices.length × ROUND_INTERVAL_MIN) —
// senão um alarme genuinamente novo, mas ativado pouco antes da vez do seu
// equipamento ser checado, seria classificado como "backlog" por engano e
// nunca dispararia push. Por isso o valor é calculado no handler (onde já
// se sabe quantos equipamentos existem), não fixo aqui.
function isRecentActivation(iso: string | null, windowMs: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < windowMs;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(d.getUTCHours() - 3).padStart(2, "0"); // BRT = UTC-3
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm} às ${hh}:${min}`;
}

function formatAlarmDesc(active: ActiveAlarm[]): string {
  if (active.length === 0) return "Alarme ativo";
  const first = active[0];
  const levelLabel = LEVEL_PT[first.level] ?? first.level;
  let desc = "";
  if (first.connectorName) desc += `${first.connectorName} — `;
  desc += first.name;
  if (levelLabel) desc += ` — Nível: ${levelLabel}`;
  const time = formatTime(first.activatedAt);
  if (time) desc += ` — ${time}`;
  if (active.length > 1) desc += ` (+${active.length - 1} mais)`;
  return desc;
}

// Intervalo real entre execuções — usado pro texto das mensagens de alerta
// ("~X min") E pra calcular de quem é a vez de checar alarmes (ver
// alarmsCheckDeviceId no handler principal). Mantenha em sincronia com o
// agendamento pg_cron de fato (job 'check-telemetry-alarms' — ver
// supabase/migrations/0012_check_alarms_10min_roundrobin.sql).
const ROUND_INTERVAL_MIN = 10;

// O endpoint de alarmes (`/alarms/`) da HI Tecnologia é categorizado como
// "Histórico de Dados, Alarmes e Eventos" pelo portal deles: limite de
// 288 requisições/dia NA CONTA INTEIRA (não por equipamento) e 1/minuto —
// ou seja, no máximo 1 requisição a cada 5 min, em média. Com 8
// equipamentos, checar o alarme de todos numa mesma rodada estoura esse
// limite tanto no burst (8 GETs quase juntos) quanto no total diário. Por
// isso só o status de conexão (`/connectors/`, endpoint bem mais permissivo
// — 1.440/dia) é checado pra todos a cada rodada; o endpoint de alarmes é
// revezado, um equipamento por rodada, dando ~80 min de ciclo completo por
// equipamento com rodadas de 10 min (144 alarmes/dia, folgado dentro dos
// 288 permitidos).

// ── Saúde do pipeline: log de execuções + alerta em caso de falha sustentada ───
// O pipeline falha de forma silenciosa (HTTP 200 mesmo sem checar nada) sempre que
// getHitecToken() não consegue logar na API HI Tecnologia, ou quando ocorre uma
// exceção não tratada. Sem isso, uma parada de vários dias só é percebida por
// acaso. Aqui gravamos cada execução e, se houver falhas seguidas por tempo
// suficiente, avisamos por push quem tem subscription — e avisamos de novo
// quando normalizar.
const FAILURE_ALERT_THRESHOLD = 2; // ~20 min de falhas seguidas (execução a cada 10 min, desde a redução de frequência por limite de API da HI Tecnologia)

// Janelas de manutenção avisadas com antecedência pela própria HI Tecnologia
// (banner no portal deles). Durante esses períodos, falha ao consultar a API
// é esperada e não deve gerar o alerta de "pipeline quebrado" — o run
// continua sendo registrado normalmente em cron_run_log, só o push é
// suprimido. Para uma nova manutenção futura, adicione outra linha aqui (e no
// mesmo array em pipeline-watchdog/index.ts) e faça o redeploy.
const KNOWN_MAINTENANCE_WINDOWS: [string, string][] = [
  ["2026-08-13T05:00:00-03:00", "2026-08-13T09:00:00-03:00"], // aviso da plataforma HI Tecnologia
];

function isInMaintenanceWindow(): boolean {
  const now = Date.now();
  return KNOWN_MAINTENANCE_WINDOWS.some(([start, end]) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return now >= s && now <= e;
  });
}

async function sendAlertPush(subs: any[], title: string, body: string) {
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, tag: "pipeline-health", data: { url: "/mobile" } })
      );
    } catch {
      // Assinatura ruim: a limpeza normal (410/404) já cuida disso na execução seguinte.
    }
  }
}

async function logRunAndCheckHealth(status: "ok" | "skipped" | "error", detail: string | undefined, subs: any[]) {
  await fetch(`${SUPABASE_URL}/rest/v1/cron_run_log`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({ status, detail: detail ?? null }),
  }).catch(() => {});

  // Mantém a tabela pequena: descarta logs com mais de 30 dias.
  fetch(
    `${SUPABASE_URL}/rest/v1/cron_run_log?run_at=lt.${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`,
    { method: "DELETE", headers: sbHeaders() }
  ).catch(() => {});

  const recent: any[] = await sbGet(
    `cron_run_log?select=status&order=run_at.desc&limit=${FAILURE_ALERT_THRESHOLD + 1}`
  ).catch(() => []);
  if (!Array.isArray(recent)) return;

  // Falha esperada (manutenção avisada) — o run já foi registrado acima, só
  // não alerta por push nem conta pra streak de "pipeline quebrado".
  if (isInMaintenanceWindow()) return;

  let streak = 0;
  for (const row of recent) {
    if (row.status === "ok") break;
    streak++;
  }

  if (status !== "ok" && streak === FAILURE_ALERT_THRESHOLD) {
    await sendAlertPush(
      subs,
      "⚠️ Monitoramento de alarmes falhando",
      `${FAILURE_ALERT_THRESHOLD} verificações seguidas falharam (~${FAILURE_ALERT_THRESHOLD * ROUND_INTERVAL_MIN} min). Causa: ${detail ?? status}`
    );
  } else if (status === "ok") {
    const previousStreak = recent.slice(1).filter((r) => r.status !== "ok").length;
    if (previousStreak >= FAILURE_ALERT_THRESHOLD) {
      await sendAlertPush(
        subs,
        "✅ Monitoramento de alarmes normalizado",
        "As verificações voltaram a funcionar normalmente."
      );
    }
  }
}

// ── Saúde POR DISPOSITIVO: alerta quando um equipamento específico fica sem
// resposta, mesmo com o pipeline inteiro funcionando normalmente pros outros ──
// Achado real: um dispositivo ficou ~4h travado (HTTP 429 da HI Tecnologia
// específico daquele conector) sem nenhum alerta, porque o alerta de pipeline
// só dispara quando TODOS os dispositivos falham. Usa duas colunas na própria
// telemetry_devices (consecutive_failures/failure_alerted) em vez de uma
// tabela de log separada — mais simples, e o estado já mora junto do
// dispositivo que ele descreve.
const DEVICE_FAILURE_THRESHOLD = 2; // ~20 min de falhas seguidas (mesma janela do pipeline, ver comentário acima)

async function handleDeviceFailure(device: any, errorDetail: string, subs: any[]) {
  const newCount = (device.consecutive_failures ?? 0) + 1;
  const alreadyAlerted = device.failure_alerted === true;
  // >= (não ===): se a manutenção suprimir o alerta bem no momento em que
  // cruzaria o limite, a próxima falha ainda precisa conseguir alertar,
  // mesmo que a contagem já tenha passado do limite exato.
  const crossedThreshold = newCount >= DEVICE_FAILURE_THRESHOLD && !alreadyAlerted;
  const shouldAlert = crossedThreshold && !isInMaintenanceWindow();

  await fetch(`${SUPABASE_URL}/rest/v1/telemetry_devices?id=eq.${device.id}`, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({
      consecutive_failures: newCount,
      failure_alerted: alreadyAlerted || shouldAlert,
    }),
  }).catch(() => {});

  if (shouldAlert) {
    await sendAlertPush(
      subs,
      `⚠️ ${device.name} sem resposta`,
      `${DEVICE_FAILURE_THRESHOLD}+ verificações seguidas falharam (~${DEVICE_FAILURE_THRESHOLD * ROUND_INTERVAL_MIN} min ou mais). Última causa: ${errorDetail}`
    );
  }
}

async function handleDeviceRecovery(device: any, subs: any[]) {
  if (!device.failure_alerted) return; // não tinha alertado — nada pra normalizar
  await sendAlertPush(
    subs,
    `✅ ${device.name} normalizado`,
    "O dispositivo voltou a responder normalmente."
  );
}

// ── Handler principal ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    webpush.setVapidDetails("mailto:ti@greensoil.com.br", VAPID_PUBLIC, VAPID_PRIVATE);

    const subs: any[] = await sbGet("push_subscriptions?select=*");

    const token = await getHitecToken();
    if (!token) {
      const detail = "Credenciais HI Tecnologia não configuradas ou login falhou";
      await logRunAndCheckHealth("skipped", detail, subs);
      return new Response(JSON.stringify({ skipped: detail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca dispositivos e preferências. Ordem estável (por id) é essencial
    // pro revezamento do endpoint de alarmes fazer sentido rodada a rodada.
    const devices: any[] = await sbGet("telemetry_devices?select=*&order=id");
    const results: any[] = [];

    // De quem é a vez de checar alarmes nesta rodada — derivado do relógio,
    // não de estado salvo (a function não guarda memória entre execuções).
    // A cada ROUND_INTERVAL_MIN minutos o índice avança 1, ciclando pelos
    // equipamentos na mesma ordem da query acima.
    const roundIndex = Math.floor(Date.now() / (ROUND_INTERVAL_MIN * 60 * 1000));
    const alarmsCheckDeviceId = devices.length > 0 ? devices[roundIndex % devices.length].id : null;

    // Janela de "ativação recente" pra decidir se um alarme dispara push —
    // 1.5x o ciclo completo do revezamento, com piso de 15 min (caso haja
    // só 1 equipamento, onde o revezamento não atrasa nada).
    const notifyWindowMs = Math.max(15, devices.length * ROUND_INTERVAL_MIN * 1.5) * 60 * 1000;

    // Carrega preferências de todos os usuários com subscription
    const userIds = [...new Set(subs.filter((s: any) => s.user_id).map((s: any) => s.user_id as string))];
    const prefsByUser: Record<string, string[]> = {};
    if (userIds.length > 0) {
      const rows: any[] = await sbGet(
        `notification_preferences?user_id=in.(${userIds.join(",")})&select=user_id,disabled_alarm_ids`
      );
      for (const p of rows) prefsByUser[p.user_id] = p.disabled_alarm_ids ?? [];
    }

    const expiredIds: string[] = [];

    for (const device of devices) {
      // Busca status atual do conector na API HI Tecnologia
      const connResp = await fetch(`${HITEC_BASE_URL}/connectors/${device.configuration_id}/`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!connResp.ok) {
        results.push({ device: device.name, error: `HTTP ${connResp.status}` });
        await handleDeviceFailure(device, `HTTP ${connResp.status}`, subs);
        continue;
      }

      // Volta a responder depois de ter alertado por falha — avisa que normalizou.
      await handleDeviceRecovery(device, subs);

      const conn = await connResp.json();
      const isConnected = conn.is_connected ?? false;
      const hasActiveAlarms = conn.has_active_alarms ?? false;
      const numAlarms = conn.number_active_alarms ?? 0;
      const lastActivity = conn.last_activity_at ?? null;
      const status = isConnected ? "online" : "offline";

      // Endpoint de alarmes só é chamado pro equipamento da vez nesta
      // rodada (ver ROUND_INTERVAL_MIN acima) — pros demais, atualiza só o
      // status de conexão, sem tocar no histórico/notificação de alarme.
      const isAlarmsTurn = device.id === alarmsCheckDeviceId;

      // Fora da vez do alarme, preserva a última lista de IDs conhecida em
      // vez de zerar — a checagem de conector não sabe quais alarmes estão
      // ativos, só o endpoint de alarmes sabe (por isso não perguntamos toda
      // rodada).
      let currentIds: string[] = device.last_reading?.active_alarm_ids ?? [];
      let newAlarms: AlarmEvent[] = [];
      let newEventsCount = 0;

      if (isAlarmsTurn) {
        // Busca TODOS os alarmes do conector (ativos ou não) — necessário para não
        // perder alarmes que ativaram e voltaram ao normal entre duas checagens.
        const allAlarms: ActiveAlarm[] = await fetchAllAlarms(device.configuration_id, token);
        const currentActive = allAlarms.filter((a) => a.state);
        currentIds = currentActive.map((a) => a.refId);

        // Registra no histórico; a tabela devolve só os eventos genuinamente novos.
        const newEvents = await insertNewAlarmEvents(device.id, allAlarms);
        newEventsCount = newEvents.length;
        // Eventos antigos (backlog) ficam só no histórico, sem gerar notificação.
        newAlarms = newEvents.filter((a) => isRecentActivation(a.activatedAt, notifyWindowMs));
      }

      // Atualiza status e leitura no banco — todo round, pra todo mundo.
      // Quando não é a vez do alarme, mantém os IDs de alarme já conhecidos
      // (currentIds acima cai no fallback do último last_reading salvo).
      await fetch(`${SUPABASE_URL}/rest/v1/telemetry_devices?id=eq.${device.id}`, {
        method: "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify({
          status,
          last_checked_at: new Date().toISOString(),
          last_reading: {
            is_connected: isConnected,
            has_active_alarms: hasActiveAlarms,
            number_active_alarms: numAlarms,
            active_alarm_ids: currentIds,
            connector_status: conn.connector_status?.name,
            last_activity_at: lastActivity,
          },
          consecutive_failures: 0,
          failure_alerted: false,
        }),
      });

      if (!isAlarmsTurn) {
        results.push({ device: device.name, status, alarmsCheckedThisRound: false });
        continue;
      }

      // Envia push apenas para alarmes realmente novos
      if (newAlarms.length > 0) {
        let pushCount = 0;
        for (const sub of subs) {
          // Filtra alarmes que este usuário não silenciou
          const disabledAlarms = sub.user_id ? (prefsByUser[sub.user_id] ?? []) : [];
          const alarmsForUser = newAlarms.filter((a) => !disabledAlarms.includes(a.refId));
          if (alarmsForUser.length === 0) continue;

          const userPayload = JSON.stringify({
            title: `⚠️ Alarme — ${device.name}`,
            body: formatAlarmDesc(alarmsForUser),
            tag: `alarm-${device.id}`,
            data: { url: "/mobile", deviceId: device.id },
          });

          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              userPayload
            );
            pushCount++;
          } catch (pushErr: any) {
            const status = pushErr?.statusCode ?? pushErr?.status;
            if (status === 410 || status === 404) {
              if (!expiredIds.includes(sub.id)) expiredIds.push(sub.id);
            } else {
              console.error(`Push falhou para ${sub.endpoint.slice(-20)}:`, String(pushErr));
            }
          }
        }

        if (pushCount > 0) await markNotified(newAlarms.map((a) => a.historyId));

        results.push({
          device: device.name,
          status,
          newAlarms: newAlarms.map((a) => a.name),
          pushed: pushCount,
          loggedOnly: newEventsCount - newAlarms.length,
        });
      } else {
        results.push({ device: device.name, status, alarms: numAlarms, activeIds: currentIds, loggedOnly: newEventsCount });
      }
    }

    // Limpar subscriptions expiradas
    for (const expiredId of expiredIds) {
      await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${expiredId}`, {
        method: "DELETE",
        headers: sbHeaders(),
      });
      console.log(`Subscription expirada removida: ${expiredId}`);
    }

    // Se TODOS os dispositivos falharam ao consultar a API HI Tecnologia, trata
    // como falha do pipeline (mesmo padrão silencioso do token, só que mais adiante).
    const allDevicesFailed = devices.length > 0 && results.every((r) => r.error);
    await logRunAndCheckHealth(
      allDevicesFailed ? "error" : "ok",
      allDevicesFailed ? "Todos os dispositivos falharam ao consultar a API HI Tecnologia" : undefined,
      subs
    );

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    try {
      const subs: any[] = await sbGet("push_subscriptions?select=*");
      await logRunAndCheckHealth("error", String(err), subs);
    } catch {
      // Se nem isso funcionar, a próxima execução ok/skipped ainda vai registrar o histórico.
    }
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
