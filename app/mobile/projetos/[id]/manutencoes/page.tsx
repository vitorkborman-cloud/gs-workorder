"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import MobileShell from "../../../../../components/layout/MobileShell";

// ─── Types ───────────────────────────────────────────────────────────────────

type Equipment = {
  id: string;
  project_id: string;
  name: string;
  max_hours: number | "";
  started_at: string; // ISO – when the timer was last reset
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ALERT_THRESHOLD_H = 168; // 7 days

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsedHours(started_at: string): number {
  return (Date.now() - new Date(started_at).getTime()) / 3_600_000;
}

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ManutencoesPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState("Carregando...");
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // id being saved

  // Ticks every second to redraw clocks
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    load();
    requestNotificationPermission();

    tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [projectId]);

  // Check notifications whenever tick updates
  useEffect(() => {
    checkNotifications();
  }, [tick]);

  async function load() {
    setLoading(true);
    const [{ data: proj }, { data: equip }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      supabase
        .from("preventive_maintenances")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
    ]);

    if (proj) setProjectName(proj.name);
    if (equip) setEquipments(equip);
    setLoading(false);
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  const notifiedRef = useRef<Set<string>>(new Set());

  function checkNotifications() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    equipments.forEach((eq) => {
      if (!eq.name || !eq.max_hours) return;
      const elapsed = elapsedHours(eq.started_at);
      const remaining = Number(eq.max_hours) - elapsed;

      // Fire once when crossing the 168h threshold (within a 1-minute window to avoid spam)
      const key = `${eq.id}-${Math.floor(elapsed)}`;
      if (remaining <= ALERT_THRESHOLD_H && remaining > ALERT_THRESHOLD_H - 1 / 60) {
        if (!notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          new Notification(`GS ${projectName}`, {
            body: `Faltam 7 dias para a troca do ${eq.name}`,
            icon: "/logo.png",
          });
        }
      }
    });
  }

  // ── Equipment CRUD ────────────────────────────────────────────────────────

  async function addEquipment() {
    const newEq = {
      project_id: projectId,
      name: "",
      max_hours: 0,
      started_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("preventive_maintenances")
      .insert(newEq)
      .select()
      .single();

    if (error) {
      alert("Erro ao adicionar equipamento: " + error.message);
      return;
    }
    if (data) {
      setEquipments((prev) => [...prev, data]);
    }
  }

  async function updateField(
    id: string,
    field: keyof Equipment,
    value: string | number
  ) {
    setEquipments((prev) =>
      prev.map((eq) => (eq.id === id ? { ...eq, [field]: value } : eq))
    );
  }

  async function saveEquipment(eq: Equipment) {
    setSaving(eq.id);
    await supabase
      .from("preventive_maintenances")
      .update({ name: eq.name, max_hours: eq.max_hours })
      .eq("id", eq.id);
    setSaving(null);
  }

  async function resetTimer(id: string) {
    const now = new Date().toISOString();
    await supabase
      .from("preventive_maintenances")
      .update({ started_at: now })
      .eq("id", id);
    setEquipments((prev) =>
      prev.map((eq) => (eq.id === id ? { ...eq, started_at: now } : eq))
    );
    // Clear notification state for this equipment
    notifiedRef.current = new Set(
      [...notifiedRef.current].filter((k) => !k.startsWith(id))
    );
  }

  async function deleteEquipment(id: string) {
    if (!confirm("Excluir este equipamento?")) return;
    await supabase.from("preventive_maintenances").delete().eq("id", id);
    setEquipments((prev) => prev.filter((eq) => eq.id !== id));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <MobileShell title="Carregando...">
        <div className="p-10 text-center text-gray-400 animate-pulse">
          Carregando equipamentos...
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title={projectName}
      subtitle="Manutenções preventivas"
      backHref={`/mobile/projetos/${projectId}`}
    >
      <div className="space-y-4 pb-10">

        {equipments.length === 0 && (
          <div className="text-center text-sm text-gray-400 mt-12 space-y-2">
            <div className="text-4xl">🔧</div>
            <p className="font-medium">Nenhum equipamento cadastrado.</p>
            <p className="text-xs">Use o botão abaixo para adicionar.</p>
          </div>
        )}

        {equipments.map((eq) => {
          const elapsedSec = Math.floor(
            (Date.now() - new Date(eq.started_at).getTime()) / 1000
          );
          const elapsed = elapsedSec / 3600;
          const maxH = Number(eq.max_hours) || 0;
          const remaining = maxH > 0 ? maxH - elapsed : null;
          const isWarning = remaining !== null && remaining <= ALERT_THRESHOLD_H;
          const isDanger = remaining !== null && remaining <= 0;

          return (
            <div
              key={eq.id}
              className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${
                isDanger
                  ? "border-red-400"
                  : isWarning
                  ? "border-amber-400"
                  : "border-gray-100"
              }`}
            >
              {/* Status bar */}
              {(isWarning || isDanger) && (
                <div
                  className={`text-xs font-bold text-center py-1.5 tracking-wide ${
                    isDanger
                      ? "bg-red-500 text-white"
                      : "bg-amber-400 text-amber-900"
                  }`}
                >
                  {isDanger
                    ? "⛔ Prazo de troca excedido!"
                    : `⚠️ Faltam ${Math.ceil(remaining!)}h para a troca`}
                </div>
              )}

              <div className="p-5 space-y-4">

                {/* Row 1: name + delete */}
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 h-11 border border-gray-200 rounded-xl px-4 text-sm font-semibold text-[#391e2a] focus:ring-2 focus:ring-[#b06a2d]/30 focus:border-[#b06a2d] transition placeholder:text-gray-300 placeholder:font-normal"
                    placeholder="Nome do equipamento"
                    value={eq.name}
                    onChange={(e) => updateField(eq.id, "name", e.target.value)}
                    onBlur={() => saveEquipment(eq)}
                  />
                  <button
                    onClick={() => deleteEquipment(eq.id)}
                    className="w-11 h-11 rounded-xl bg-red-50 text-red-400 flex items-center justify-center active:scale-90 transition shrink-0"
                  >
                    <TrashIcon />
                  </button>
                </div>

                {/* Row 2: cronômetro + reset */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-[#391e2a] rounded-2xl px-4 py-3 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">
                      Tempo decorrido
                    </span>
                    <span className="text-2xl font-black text-white font-mono tracking-wider">
                      {formatClock(elapsedSec)}
                    </span>
                    {maxH > 0 && (
                      <span className="text-[10px] text-white/40 mt-1">
                        {elapsed.toFixed(1)}h / {maxH}h
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => resetTimer(eq.id)}
                    className="w-16 h-16 rounded-2xl bg-[#b06a2d]/10 text-[#b06a2d] flex flex-col items-center justify-center gap-1 active:scale-90 transition shrink-0 border border-[#b06a2d]/20"
                  >
                    <ResetIcon />
                    <span className="text-[9px] font-bold uppercase tracking-wide">
                      Reset
                    </span>
                  </button>
                </div>

                {/* Row 3: max hours */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                    Máximo de horas para troca
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      className="w-full h-11 border border-gray-200 rounded-xl px-4 pr-10 text-sm focus:ring-2 focus:ring-[#b06a2d]/30 focus:border-[#b06a2d] transition"
                      placeholder="Ex: 500"
                      value={eq.max_hours}
                      onChange={(e) =>
                        updateField(
                          eq.id,
                          "max_hours",
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      onBlur={() => saveEquipment(eq)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">
                      h
                    </span>
                  </div>
                  {maxH > 0 && remaining !== null && remaining > 0 && (
                    <p className="text-xs text-gray-400 ml-1">
                      Próxima troca em{" "}
                      <span className={`font-bold ${isWarning ? "text-amber-500" : "text-[#391e2a]"}`}>
                        ~{Math.ceil(remaining)}h
                      </span>{" "}
                      ({Math.ceil(remaining / 24)} dias)
                    </p>
                  )}
                </div>

                {/* Save indicator */}
                {saving === eq.id && (
                  <p className="text-[10px] text-gray-400 text-right animate-pulse">
                    Salvando...
                  </p>
                )}
              </div>

              {/* Progress bar */}
              {maxH > 0 && (
                <div className="h-1.5 bg-gray-100">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      isDanger
                        ? "bg-red-500"
                        : isWarning
                        ? "bg-amber-400"
                        : "bg-[#b06a2d]"
                    }`}
                    style={{
                      width: `${Math.min(100, (elapsed / maxH) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Add button */}
        <button
          onClick={addEquipment}
          className="w-full bg-white hover:bg-gray-50 text-[#391e2a] py-4 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition"
        >
          <PlusIcon />
          Adicionar equipamento
        </button>

      </div>
    </MobileShell>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
