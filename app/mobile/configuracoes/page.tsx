"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import MobileShell from "../../../components/layout/MobileShell";

type Device = {
  id: string;
  name: string;
  project_name: string;
};

export default function ConfiguracoesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const [{ data: devs }, { data: projs }] = await Promise.all([
      supabase.from("telemetry_devices").select("id, name, project_id").order("name"),
      supabase.from("projects").select("id, name"),
    ]);

    const projMap: Record<string, string> = Object.fromEntries(
      (projs ?? []).map((p) => [p.id, p.name])
    );

    setDevices(
      (devs ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        project_name: projMap[d.project_id] ?? "",
      }))
    );

    if (user?.id) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("disabled_device_ids")
        .eq("user_id", user.id)
        .single();

      if (prefs?.disabled_device_ids) {
        setDisabledIds(new Set(prefs.disabled_device_ids));
      }
    }

    setLoading(false);
  }

  async function toggle(deviceId: string) {
    if (!userId || saving) return;
    setSaving(true);

    const next = new Set(disabledIds);
    if (next.has(deviceId)) next.delete(deviceId);
    else next.add(deviceId);

    setDisabledIds(next);

    await supabase.from("notification_preferences").upsert(
      { user_id: userId, disabled_device_ids: [...next], updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    setSaving(false);
  }

  if (loading) {
    return (
      <MobileShell title="Notificações" backHref="/mobile">
        <div className="p-10 text-center text-gray-400 animate-pulse">Carregando...</div>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title="Notificações"
      subtitle="Alarmes que você deseja receber"
      backHref="/mobile"
    >
      <div className="space-y-3 pb-6">
        {!userId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-400">
            Faça login para configurar notificações.
          </div>
        )}

        {userId && devices.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-400">
            Nenhum equipamento cadastrado.
          </div>
        )}

        {userId && devices.length > 0 && (
          <>
            <p className="text-xs text-gray-400 px-1 pb-1">
              Equipamentos <span className="font-semibold text-[#391e2a]">desativados</span> não enviarão notificações de alarme para você.
            </p>

            {devices.map((dev) => {
              const enabled = !disabledIds.has(dev.id);
              return (
                <div
                  key={dev.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#391e2a] text-sm truncate">{dev.name}</p>
                    {dev.project_name && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{dev.project_name}</p>
                    )}
                  </div>

                  <button
                    onClick={() => toggle(dev.id)}
                    disabled={saving}
                    aria-label={enabled ? "Desativar notificações" : "Ativar notificações"}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                      enabled ? "bg-[#80b02d]" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                        enabled ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </MobileShell>
  );
}
