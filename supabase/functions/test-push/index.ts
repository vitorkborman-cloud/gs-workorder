// Edge Function de teste: envia push notification para todos os dispositivos cadastrados
// sem precisar das credenciais HI Tecnologia.
// Chamada via: POST /functions/v1/test-push (requer auth)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  const privateKeyBytes = base64urlToUint8Array(VAPID_PRIVATE);
  const publicKeyBytes = base64urlToUint8Array(VAPID_PUBLIC);

  const ephemeralKey = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const ephemeralPublicRaw = await crypto.subtle.exportKey("raw", ephemeralKey.publicKey);

  const subscriberPublicKey = await crypto.subtle.importKey(
    "raw",
    base64urlToUint8Array(sub.p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPublicKey },
    ephemeralKey.privateKey,
    256
  );

  const authSecret = base64urlToUint8Array(sub.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();

  const ikm = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveBits"]);

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

  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: encoder.encode("Content-Encoding: aes128gcm\0") },
    prkKey,
    128
  );
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: encoder.encode("Content-Encoding: nonce\0") },
    prkKey,
    96
  );

  const cek = await crypto.subtle.importKey("raw", cekBits, "AES-GCM", false, ["encrypt"]);

  const plaintext = encoder.encode(JSON.stringify(payload));
  const paddedPlaintext = new Uint8Array(plaintext.length + 2);
  paddedPlaintext.set(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBits },
    cek,
    paddedPlaintext
  );

  const recordSize = new DataView(new ArrayBuffer(4));
  recordSize.setUint32(0, 4096, false);

  const body = new Uint8Array([
    ...salt,
    ...new Uint8Array(recordSize.buffer),
    ephemeralPublicRaw.byteLength,
    ...new Uint8Array(ephemeralPublicRaw),
    ...new Uint8Array(ciphertext),
  ]);

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const reqBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const title = reqBody.title || "⚠️ Teste — Equipamento Marelli SP";
    const body = reqBody.body || "Alarme de nível crítico detectado (teste simulado)";

    const subs: any[] = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`,
      {
        headers: {
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    ).then((r) => r.json());

    if (!Array.isArray(subs) || subs.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, message: "Nenhum dispositivo cadastrado. Abra o mobile e aceite a permissão de notificação primeiro." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { endpoint: string; status: number }[] = [];
    for (const sub of subs) {
      const status = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title, body, tag: "test-alarm", data: { url: "/mobile" } }
      );
      results.push({ endpoint: sub.endpoint.slice(0, 40) + "...", status });
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
