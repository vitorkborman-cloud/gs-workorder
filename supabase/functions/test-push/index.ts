import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    webpush.setVapidDetails("mailto:ti@greensoil.com.br", VAPID_PUBLIC, VAPID_PRIVATE);

    const reqBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const title = reqBody.title || "⚠️ Teste — Equipamento Marelli SP";
    const body = reqBody.body || "Alarme de nível crítico detectado (teste simulado)";

    const subs: any[] = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`,
      { headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` } }
    ).then((r) => r.json());

    if (!Array.isArray(subs) || subs.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, message: "Nenhum dispositivo cadastrado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { status: string }[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, tag: "test-alarm", data: { url: "/mobile" } })
        );
        results.push({ status: "ok" });
      } catch (e: any) {
        results.push({ status: "erro: " + e.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
