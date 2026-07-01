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
      const prevAlarmCount = prevReading?.number_active_alarms ?? 0;

      // Atualiza status e leitura no banco
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
            connector_status: conn.connector_status?.name,
            last_activity_at: lastActivity,
          },
        }),
      });

      // Se o número de alarmes aumentou, envia push
      if (numAlarms > prevAlarmCount) {
        const newCount = numAlarms - prevAlarmCount;
        const subs: any[] = await sbGet("push_subscriptions?select=*");

        const pushPayload = JSON.stringify({
          title: `⚠️ Alarme — ${device.name}`,
          body: `${newCount} novo${newCount > 1 ? "s" : ""} alarme${newCount > 1 ? "s" : ""} ativo${newCount > 1 ? "s" : ""} (total: ${numAlarms})`,
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

        results.push({ device: device.name, status, newAlarms: newCount, totalAlarms: numAlarms, pushed: pushCount });
      } else {
        results.push({ device: device.name, status, alarms: numAlarms });
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
