"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import MobileShell from "../../../../../components/layout/MobileShell";

type TelemetryDevice = {
  id: string;
  name: string;
  configuration_id: string;
  status: string;
  last_reading: any;
  last_checked_at: string | null;
};

export default function TelemetriaMobilePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [devices, setDevices] = useState<TelemetryDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("telemetry_devices")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (data) setDevices(data);
    setLoading(false);
  }

  async function refresh(dev: TelemetryDevice) {
    setRefreshing(dev.id);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        `telemetria?action=dados&configId=${dev.configuration_id}`,
        { method: "GET" }
      );
      if (error) {
        const detail = await error.context?.json?.().catch(() => null);
        throw new Error(detail?.error || error.message);
      }
      await supabase
        .from("telemetry_devices")
        .update({ status: "online", last_reading: data, last_checked_at: new Date().toISOString() })
        .eq("id", dev.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Não foi possível buscar a leitura.");
      await supabase
        .from("telemetry_devices")
        .update({ status: "offline", last_checked_at: new Date().toISOString() })
        .eq("id", dev.id);
    } finally {
      setRefreshing(null);
      load();
    }
  }

  if (loading) return (
    <MobileShell title="Telemetria" backHref={`/mobile/projetos/${projectId}`}>
      <div className="p-10 text-center text-gray-400 animate-pulse">Carregando...</div>
    </MobileShell>
  );

  return (
    <MobileShell
      title="Telemetria"
      subtitle="Status dos equipamentos em campo"
      backHref={`/mobile/projetos/${projectId}`}
    >
      <div className="space-y-3 pb-6">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">
            {errorMsg}
          </div>
        )}

        {devices.length === 0 && (
          <div className="text-center mt-16 space-y-3 text-gray-400">
            <svg className="w-14 h-14 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="font-medium text-sm">Nenhum equipamento vinculado a este projeto.</p>
          </div>
        )}

        {devices.map((dev) => (
          <div key={dev.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-[#391e2a] text-sm">{dev.name}</p>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                dev.status === "online" ? "bg-green-100 text-green-700" :
                dev.status === "offline" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-500"
              }`}>
                {dev.status === "online" ? "● Online" : dev.status === "offline" ? "● Offline" : "— Sem dados"}
              </span>
            </div>

            {dev.last_reading && (
              <pre className="text-[10px] bg-gray-50 rounded-lg p-2 overflow-x-auto max-h-24 text-gray-600 mb-2">
                {JSON.stringify(dev.last_reading, null, 1)}
              </pre>
            )}

            {dev.last_checked_at && (
              <p className="text-[10px] text-gray-300 mb-2">
                Última checagem: {new Date(dev.last_checked_at).toLocaleString("pt-BR")}
              </p>
            )}

            <button
              onClick={() => refresh(dev)}
              disabled={refreshing === dev.id}
              className="w-full text-xs font-bold py-2.5 rounded-xl bg-[#391e2a] text-white active:scale-95 transition disabled:opacity-50"
            >
              {refreshing === dev.id ? "Buscando..." : "Atualizar leitura"}
            </button>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}
