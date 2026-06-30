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

// ── Web Push ───────────────────────────────────────────────────────────────────

function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const binary = atob(base64);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; tag?: string; data?: unknown }
) {
  // Importa chaves VAPID
  const privateKeyBytes = base64urlToUint8Array(VAPID_PRIVATE);
  const publicKeyBytes = base64urlToUint8Array(VAPID_PUBLIC);

  const vapidPrivKey = await crypto.subtle.importKey(
    "raw",
    privateKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"]
  );

  // Gera chave efêmera para criptografia do payload
  const ephemeralKey = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const ephemeralPublicRaw = await crypto.subtle.exportKey("raw", ephemeralKey.publicKey);

  // Decodifica chaves do subscriber
  const subscriberPublicKey = await crypto.subtle.importKey(
    "raw",
    base64urlToUint8Array(sub.p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Deriva shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPublicKey },
    ephemeralKey.privateKey,
    256
  );

  const authSecret = base64urlToUint8Array(sub.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF para gerar chave de criptografia (RFC 8188 / draft-ietf-webpush-encryption-08)
  const encoder = new TextEncoder();

  const ikm = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveBits"]);

  // PRK
  const prkInfo = new Uint8Array([
    ...encoder.encode("WebPush: info\0"),
    ...base64urlToUint8Array(sub.p256dh),
    ...new Uint8Array(ephemeralPublicRaw),
  ]);
  const prk = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: prkInfo },
    ikm,
    256
  );

  const prkKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);

  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");

  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    prkKey,
    128
  );
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    prkKey,
    96
  );

  const cek = await crypto.subtle.importKey("raw", cekBits, "AES-GCM", false, ["encrypt"]);

  // Monta payload (com padding de 2 bytes para comprimento)
  const plaintext = encoder.encode(JSON.stringify(payload));
  const paddedPlaintext = new Uint8Array(plaintext.length + 2);
  paddedPlaintext.set(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBits },
    cek,
    paddedPlaintext
  );

  // Monta body: salt (16) + record_size (4) + keylen (1) + ephemeral_public (65) + ciphertext
  const recordSize = new DataView(new ArrayBuffer(4));
  recordSize.setUint32(0, 4096, false);

  const body = new Uint8Array([
    ...salt,
    ...new Uint8Array(recordSize.buffer),
    ephemeralPublicRaw.byteLength,
    ...new Uint8Array(ephemeralPublicRaw),
    ...new Uint8Array(ciphertext),
  ]);

  // VAPID JWT
  const endpoint = new URL(sub.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;
  const now = Math.floor(Date.now() / 1000);

  const jwtHeader = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwtPayload = btoa(JSON.stringify({ aud: audience, exp: now + 43200, sub: "mailto:ti@greensoil.com.br" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const sigInput = encoder.encode(`${jwtHeader}.${jwtPayload}`);

  const vapidSignKey = await crypto.subtle.importKey(
    "raw",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, vapidSignKey, sigInput);
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${jwtHeader}.${jwtPayload}.${sig}`;
  const vapidPublicB64 = btoa(String.fromCharCode(...publicKeyBytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Authorization": `vapid t=${jwt},k=${vapidPublicB64}`,
    },
    body,
  });

  return r.status;
}

// ── Handler principal ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = await getHitecToken();
    if (!token) {
      return new Response(JSON.stringify({ skipped: "Credenciais HI Tecnologia não configuradas ainda" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca todos os dispositivos cadastrados
    const devices: any[] = await sbGet("telemetry_devices?select=*");
    const results: any[] = [];

    for (const device of devices) {
      // Busca alarmes ativos no HI Tecnologia
      const hitecUrl = `${HITEC_BASE_URL}/alarms?configurationId=${device.configuration_id}&limit=50`;
      const alarmResp = await fetch(hitecUrl, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!alarmResp.ok) {
        results.push({ device: device.name, error: `HTTP ${alarmResp.status}` });
        continue;
      }

      const alarmData = await alarmResp.json();
      // Suporta tanto array direto quanto { results: [...] }
      const alarms: any[] = Array.isArray(alarmData) ? alarmData : (alarmData.results || alarmData.alarms || []);

      for (const alarm of alarms) {
        const hitecId = String(alarm.id || alarm.alarm_id || alarm.code || JSON.stringify(alarm));
        const description = alarm.description || alarm.mensagem || alarm.message || alarm.nome || "Alarme disparado";
        const severity = alarm.severity || alarm.prioridade || alarm.priority || "warning";
        const triggeredAt = alarm.triggered_at || alarm.data || alarm.timestamp || new Date().toISOString();

        // Insere na tabela (ignora duplicatas pelo unique constraint)
        const insertResp = await sbPost("telemetry_alarms", {
          device_id: device.id,
          hitec_alarm_id: hitecId,
          description,
          severity,
          triggered_at: triggeredAt,
          notified: false,
        });

        // Se inseriu (201 = novo alarme), envia push para todos os dispositivos
        if (insertResp.status === 201) {
          const subs: any[] = await sbGet("push_subscriptions?select=*");

          const pushPayload = {
            title: `⚠️ Alarme — ${device.name}`,
            body: description,
            tag: `alarm-${hitecId}`,
            data: { url: "/mobile", deviceId: device.id },
          };

          let pushCount = 0;
          for (const sub of subs) {
            try {
              await sendPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, pushPayload);
              pushCount++;
            } catch (_) { /* ignora falha de push individual */ }
          }

          // Marca como notificado
          await fetch(`${SUPABASE_URL}/rest/v1/telemetry_alarms?device_id=eq.${device.id}&hitec_alarm_id=eq.${encodeURIComponent(hitecId)}`, {
            method: "PATCH",
            headers: sbHeaders(),
            body: JSON.stringify({ notified: true }),
          });

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
