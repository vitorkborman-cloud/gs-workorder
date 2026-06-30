import webpush from "npm:web-push@3.6.7";

// Edge Function: verifica alarmes novos na API HI Tecnologia e envia push notifications
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

async function sbPost(path: string, body: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...sbHeaders(), "Prefer": "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify(body),
  });
  return r;
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
    body: JSON.stringify({ email: user, password }),
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
      return new Response(JSON.stringify({ skipped: "Credenciais HI Tecnologia não configuradas ainda" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const devices: any[] = await sbGet("telemetry_devices?select=*");
    const results: any[] = [];

    for (const device of devices) {
      const hitecUrl = `${HITEC_BASE_URL}/alarms?configurationId=${device.configuration_id}&limit=50`;
      const alarmResp = await fetch(hitecUrl, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!alarmResp.ok) {
        results.push({ device: device.name, error: `HTTP ${alarmResp.status}` });
        continue;
      }

      const alarmData = await alarmResp.json();
      const alarms: any[] = Array.isArray(alarmData) ? alarmData : (alarmData.results || alarmData.alarms || []);

      for (const alarm of alarms) {
        const hitecId = String(alarm.id || alarm.alarm_id || alarm.code || JSON.stringify(alarm));
        const description = alarm.description || alarm.mensagem || alarm.message || alarm.nome || "Alarme disparado";
        const severity = alarm.severity || alarm.prioridade || alarm.priority || "warning";
        const triggeredAt = alarm.triggered_at || alarm.data || alarm.timestamp || new Date().toISOString();

        const insertResp = await sbPost("telemetry_alarms", {
          device_id: device.id,
          hitec_alarm_id: hitecId,
          description,
          severity,
          triggered_at: triggeredAt,
          notified: false,
        });

        if (insertResp.status === 201) {
          const subs: any[] = await sbGet("push_subscriptions?select=*");

          const pushPayload = JSON.stringify({
            title: `⚠️ Alarme — ${device.name}`,
            body: description,
            tag: `alarm-${hitecId}`,
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
            } catch (_) { /* ignora falha de push individual */ }
          }

          await fetch(
            `${SUPABASE_URL}/rest/v1/telemetry_alarms?device_id=eq.${device.id}&hitec_alarm_id=eq.${encodeURIComponent(hitecId)}`,
            { method: "PATCH", headers: sbHeaders(), body: JSON.stringify({ notified: true }) }
          );

          results.push({ device: device.name, alarm: description, pushed: pushCount });
        }
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
