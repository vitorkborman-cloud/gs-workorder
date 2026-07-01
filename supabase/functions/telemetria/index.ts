// Edge Function: proxy seguro para a API REST do Portal de Telemetria (HI Tecnologia)
// Endpoints confirmados:
//   GET /rest/v1/connectors/{id}/  → status, is_connected, has_active_alarms, last_activity_at
//   GET /rest/v1/alarms/?configurationId={id} → definições de alarmes do conector

const HITEC_BASE_URL = "https://api.telemetria.hitecnologia.com.br/rest/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const user = Deno.env.get("HITEC_API_USER");
  const password = Deno.env.get("HITEC_API_PASSWORD");
  if (!user || !password) throw new Error("HITEC_API_USER ou HITEC_API_PASSWORD não configurados");

  const loginResp = await fetch(`${HITEC_BASE_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user, password: btoa(password) }),
  });

  if (!loginResp.ok) {
    const text = await loginResp.text();
    throw new Error(`Falha no login HI Tecnologia (status ${loginResp.status}): ${text}`);
  }

  const d = await loginResp.json();
  const token = d.token || d.access_token || d.accessToken || d.access || d.key;
  if (!token) throw new Error(`Login OK mas token não encontrado: ${JSON.stringify(d)}`);

  cachedToken = token;
  tokenExpiresAt = Date.now() + 25 * 60 * 1000;
  return token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action"); // "dados" | "alarmes"
    const configId = url.searchParams.get("configId");

    if (!action || !configId) {
      return new Response(JSON.stringify({ error: "Parâmetros 'action' e 'configId' são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getToken();
    const authH = { "Authorization": `Bearer ${token}` };

    let hitecUrl = "";
    if (action === "dados") {
      // Retorna status e info do conector (online/offline, alarmes ativos, última atividade)
      hitecUrl = `${HITEC_BASE_URL}/connectors/${configId}/`;
    } else if (action === "alarmes") {
      // Retorna definições de alarmes associados ao conector
      hitecUrl = `${HITEC_BASE_URL}/alarms/?configurationId=${configId}`;
    } else {
      return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch(hitecUrl, { headers: authH });
    const data = await resp.text();

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: `HI Tecnologia retornou status ${resp.status}`, hitecUrl, details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(data, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
