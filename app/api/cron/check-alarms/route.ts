import { NextRequest, NextResponse } from "next/server";

// Chamada pelo cron-job.org a cada 2 minutos via GET com ?secret=CRON_SECRET
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Env vars ausentes" }, { status: 500 });
  }

  const resp = await fetch(`${supabaseUrl}/functions/v1/check-alarms`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  const data = await resp.json();
  return NextResponse.json(data, { status: resp.ok ? 200 : 502 });
}
