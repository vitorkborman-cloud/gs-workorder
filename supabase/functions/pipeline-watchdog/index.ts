import webpush from "npm:web-push@3.6.7";

// Vigia INDEPENDENTE do check-alarms — roda numa agenda pg_cron própria
// (ver migrations/0007_pipeline_watchdog.sql), não encadeada com ele.
//
// O check-alarms já registra cada execução em cron_run_log e alerta sozinho
// quando RODA e FALHA repetidamente (login HI Tecnologia, erro de código —
// ver logRunAndCheckHealth em check-alarms/index.ts). Isso não cobre um
// cenário: o cron parar de CHAMAR o check-alarms de vez (pg_cron
// desabilitado, projeto Supabase pausado, etc.) — nesse caso não existe
// nenhuma execução nova pra registrar o próprio problema. Este watchdog
// existe só pra isso: se não aparece nenhum log novo por tempo suficiente,
// avisa por conta própria.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

// 5x o intervalo normal do check-alarms (2 min) sem nenhum log — folga
// suficiente pra não disparar por uma execução isolada demorando um pouco.
const STALE_AFTER_MS = 10 * 60 * 1000;
// Durante uma queda longa, não repete o alerta a cada disparo do watchdog
// (20 min) — só reavisa depois de 1h ainda parado.
const REALERT_AFTER_MS = 60 * 60 * 1000;

// Janelas de manutenção avisadas com antecedência pela própria HI Tecnologia
// (mesma lista de check-alarms/index.ts — manter as duas em sincronia). Nosso
// próprio cron continua rodando/logando normalmente durante esses períodos
// (ver check-alarms), então isto é só uma proteção extra caso algo mais
// inesperado também afete a checagem nesse intervalo.
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

Deno.serve(async () => {
  try {
    webpush.setVapidDetails("mailto:ti@greensoil.com.br", VAPID_PUBLIC, VAPID_PRIVATE);

    const lastRun: any[] = await sbGet("cron_run_log?select=run_at&order=run_at.desc&limit=1");
    const lastRunAt = lastRun?.[0]?.run_at ? new Date(lastRun[0].run_at).getTime() : 0;
    const ageMs = Date.now() - lastRunAt;

    if (lastRunAt && ageMs <= STALE_AFTER_MS) {
      return new Response(JSON.stringify({ ok: true, ageMinutes: Math.round(ageMs / 60000) }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (isInMaintenanceWindow()) {
      return new Response(JSON.stringify({ ok: true, suppressed: "known maintenance window" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const lastAlert: any[] = await sbGet(
      "cron_run_log?select=run_at&status=eq.watchdog_alert&order=run_at.desc&limit=1"
    );
    const lastAlertAt = lastAlert?.[0]?.run_at ? new Date(lastAlert[0].run_at).getTime() : 0;
    if (Date.now() - lastAlertAt < REALERT_AFTER_MS) {
      return new Response(JSON.stringify({ ok: true, alreadyAlerted: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const ageMinutes = Math.round(ageMs / 60000);
    const detail = lastRunAt
      ? `Nenhuma verificação de alarme rodou nos últimos ${ageMinutes} min`
      : "Nenhuma verificação de alarme foi registrada ainda (cron_run_log vazio)";

    const subs: any[] = await sbGet("push_subscriptions?select=*");
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "⚠️ Monitoramento de alarmes parado",
            body: detail,
            tag: "pipeline-health",
            data: { url: "/mobile" },
          })
        );
      } catch {
        // Assinatura ruim: a limpeza normal do check-alarms cuida disso.
      }
    }

    await fetch(`${SUPABASE_URL}/rest/v1/cron_run_log`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ status: "watchdog_alert", detail }),
    });

    return new Response(JSON.stringify({ ok: true, alerted: true, detail }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
