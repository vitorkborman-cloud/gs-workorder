"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import MobileShell from "../../../components/layout/MobileShell";

const LEVEL_PT: Record<string, string> = {
  critical: "Crítico",
  base_high: "Alto",
  base_medium: "Médio",
  base_low: "Baixo",
  warning: "Aviso",
  info: "Info",
};

type Alarm = { refId: string; name: string; level: string };
type Unit  = { configId: number; unitName: string; alarms: Alarm[] };

export default function ConfiguracoesPage() {
  const [units, setUnits]             = useState<Unit[]>([]);
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const [userId, setUserId]           = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data: devices } = await supabase
        .from("telemetry_devices")
        .select("id, name, configuration_id")
        .order("name");

      if (!devices?.length) { setLoading(false); return; }

      // A API retorna TODOS os alarmes da conta, qualquer configId serve
      const firstConfigId = devices[0].configuration_id;
      const { data: alarmData, error: alarmErr } = await supabase.functions.invoke(
        `telemetria?action=alarmes&configId=${firstConfigId}`,
        { method: "GET" }
      );

      if (alarmErr || !Array.isArray(alarmData)) {
        setError("Não foi possível carregar os alarmes. Tente novamente.");
        setLoading(false);
        return;
      }

      // Mapeia configId (número) → nome da unidade no nosso banco
      const configToName: Record<number, string> = {};
      for (const dev of devices) configToName[Number(dev.configuration_id)] = dev.name;

      // Agrupa alarmes por conector (= unidade no nosso sistema)
      const unitMap: Record<number, Unit> = {};
      for (const alarm of alarmData) {
        const connId = alarm.data?.device?.connector?.id as number | undefined;
        if (!connId || !configToName[connId]) continue;

        if (!unitMap[connId]) {
          unitMap[connId] = { configId: connId, unitName: configToName[connId], alarms: [] };
        }
        unitMap[connId].alarms.push({
          refId:  alarm.reference_id ?? String(alarm.id),
          name:   alarm.name ?? `Alarme ${alarm.id}`,
          level:  alarm.level ?? "",
        });
      }

      setUnits(Object.values(unitMap));

      if (user?.id) {
        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select("disabled_alarm_ids")
          .eq("user_id", user.id)
          .single();
        if (prefs?.disabled_alarm_ids) setDisabledIds(new Set(prefs.disabled_alarm_ids));
      }
    } catch {
      setError("Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(refId: string) {
    if (!userId || saving) return;
    setSaving(true);
    const next = new Set(disabledIds);
    if (next.has(refId)) next.delete(refId); else next.add(refId);
    setDisabledIds(next);
    await supabase.from("notification_preferences").upsert(
      { user_id: userId, disabled_alarm_ids: [...next], updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSaving(false);
  }

  if (loading) {
    return (
      <MobileShell title="Notificações" backHref="/mobile">
        <div className="p-10 text-center text-gray-400 animate-pulse">Carregando alarmes...</div>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title="Notificações"
      subtitle="Selecione os alarmes que deseja receber"
      backHref="/mobile"
    >
      <div className="space-y-4 pb-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">
            {error}
          </div>
        )}

        {!userId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-400">
            Faça login para configurar notificações.
          </div>
        )}

        {userId && units.length === 0 && !error && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-400">
            Nenhum alarme encontrado.
          </div>
        )}

        {userId && units.map((unit) => (
          <div key={unit.configId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Cabeçalho da unidade */}
            <div className="px-4 py-3 bg-[#391e2a]/5 border-b border-gray-100">
              <p className="font-bold text-[#391e2a] text-sm">Unidade {unit.unitName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {unit.alarms.length} alarme{unit.alarms.length !== 1 ? "s" : ""} configurado{unit.alarms.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Alarmes da unidade */}
            <div className="divide-y divide-gray-50">
              {unit.alarms.map((alarm) => {
                const enabled    = !disabledIds.has(alarm.refId);
                const levelLabel = LEVEL_PT[alarm.level] ?? alarm.level;
                return (
                  <div key={alarm.refId} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#391e2a] font-medium truncate">{alarm.name}</p>
                      {levelLabel && (
                        <p className="text-xs text-gray-400 mt-0.5">{levelLabel}</p>
                      )}
                    </div>

                    <button
                      onClick={() => toggle(alarm.refId)}
                      disabled={saving}
                      aria-label={enabled ? "Desativar" : "Ativar"}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                        enabled ? "bg-[#80b02d]" : "bg-gray-200"
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                        enabled ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {userId && units.length > 0 && (
          <p className="text-xs text-gray-400 text-center pt-1">
            Alarmes <span className="font-semibold text-[#391e2a]">desativados</span> não geram notificação para você.
          </p>
        )}

      </div>
    </MobileShell>
  );
}
