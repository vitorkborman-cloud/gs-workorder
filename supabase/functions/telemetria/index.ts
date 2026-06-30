// Edge Function: proxy seguro para a API REST do Portal de Telemetria (HI Tecnologia)
// Uso: /telemetria?action=dados&configId=4271
//      /telemetria?action=alarmes&configId=4271
//
// As credenciais (HITEC_API_USER / HITEC_API_PASSWORD) ficam só aqui no servidor,
// nunca chegam ao navegador do usuário.

const HITEC_BASE_URL = "https://api.telemetria.hitecnologia.com.br/rest/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache simples do token em memória da function (válido enquanto a instância estiver "quente")
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const user = Deno.env.get("HITEC_API_USER");
  const password = Deno.env.get("HITEC_API_PASSWORD");

  if (!user || !password) {
    throw new Error("HITEC_API_USER ou HITEC_API_PASSWORD não configurados nos secrets da Edge Function");
  }

  const loginResp = await fetch(`${HITEC_BASE_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user, password }),
  });

  if (!loginResp.ok) {
    const text = await loginResp.text();
    throw new Error(`Falha no login HI Tecnologia (status ${loginResp.status}): ${text}`);
  }

  const loginData = await loginResp.json();
  const token =
    loginData.token || loginData.access_token || loginData.accessToken ||
    loginData.access || loginData.key;

  if (!token) {
    throw new Error(`Login OK mas token não encontrado na resposta: ${JSON.stringify(loginData)}`);
  }

  cachedToken = token;
  tokenExpiresAt = Date.now() + 25 * 60 * 1000; // assume 30min de validade, renova com folga
  return token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    let hitecUrl = "";
    if (action === "dados") {
      hitecUrl = `${HITEC_BASE_URL}/data/${configId}/last`;
    } else if (action === "alarmes") {
      hitecUrl = `${HITEC_BASE_URL}/alarms?configurationId=${configId}&limit=50`;
    } else {
      return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch(hitecUrl, {
      headers: { "Authorization": `Bearer ${token}` },
    });

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
