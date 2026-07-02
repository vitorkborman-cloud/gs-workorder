import webpush from "npm:web-push@3.6.7";

// Edge Function: verifica mudanças de alarme via /connectors/ e envia push notifications
// Chamada pelo pg_cron a cada 2 minutos via HTTP POST

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
}

async function fetchActiveAlarms(configId: string, token: string): Promise<ActiveAlarm[]> {
  try {
    const r = await fetch(`${HITEC_BASE_URL}/alarms/?configurationId=${configId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!r.ok) return [];

    const alarms: any[] = await r.json();
    if (!Array.isArray(alarms)) return [];

    const configIdNum = Number(configId);
    return alarms
      .filter((a) =>
        a.alarm_current_state?.state === true &&
        a.data?.device?.connector?.id === configIdNum
      )
      .map((a) => ({
        refId: a.reference_id ?? String(a.id),
        name: a.name ?? "",
        level: a.level ?? "",
        connectorName: a.data?.device?.connector?.name ?? "",
        activatedAt: a.alarm_current_state?.datetime_last_activation ?? null,
      }));
  } catch {
    return [];
  }
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

// ── Handler principal ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    webpush.setVapidDetails("mailto:ti@greensoil.com.br", VAPID_PUBLIC, VAPID_PRIVATE);

    const token = await getHitecToken();
    if (!token) {
      return new Response(JSON.stringify({ skipped: "Credenciais HI Tecnologia não configuradas" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca todos os dispositivos cadastrados no nosso banco
    const devices: any[] = await sbGet("telemetry_devices?select=*");
    const results: any[] = [];

    for (const device of devices) {
      // Busca status atual do conector na API HI Tecnologia
      const connResp = await fetch(`${HITEC_BASE_URL}/connectors/${device.configuration_id}/`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!connResp.ok) {
        results.push({ device: device.name, error: `HTTP ${connResp.status}` });
        continue;
      }

      const conn = await connResp.json();
      const isConnected = conn.is_connected ?? false;
      const hasActiveAlarms = conn.has_active_alarms ?? false;
      const numAlarms = conn.number_active_alarms ?? 0;
      const lastActivity = conn.last_activity_at ?? null;
      const status = isConnected ? "online" : "offline";

      // Leitura anterior salva no banco
      const prevReading = device.last_reading as any;
      const prevActiveIds: string[] = prevReading?.active_alarm_ids ?? [];

      // Busca alarmes ativos agora (quando há pelo menos 1)
      const currentActive: ActiveAlarm[] = numAlarms > 0
        ? await fetchActiveAlarms(device.configuration_id, token)
        : [];

      const currentIds = currentActive.map((a) => a.refId);

      // Alarmes que não estavam na lista anterior
      const newAlarms = currentActive.filter((a) => !prevActiveIds.includes(a.refId));

      // Atualiza status, leitura e IDs de alarmes no banco
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
        }),
      });

      // Envia push apenas para alarmes realmente novos
      if (newAlarms.length > 0) {
        const subs: any[] = await sbGet("push_subscriptions?select=*");
        const body = formatAlarmDesc(newAlarms);

        const pushPayload = JSON.stringify({
          title: `⚠️ Alarme — ${device.name}`,
          body,
          tag: `alarm-${device.id}`,
          data: { url: "/mobile", deviceId: device.id },
        });

        let pushCount = 0;
        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              pushPayload
            );
            pushCount++;
          } catch (_) { /* ignora falha individual */ }
        }

        results.push({ device: device.name, status, newAlarms: newAlarms.map((a) => a.name), pushed: pushCount });
      } else {
        results.push({ device: device.name, status, alarms: numAlarms, activeIds: currentIds });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
