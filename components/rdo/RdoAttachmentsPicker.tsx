"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type PdfAttachment = { tipo: "soil_description" | "water_sampling"; id: string; ordem: number };

type SoilOption = { id: string; label: string };
type WaterOption = { id: string; label: string };

export function RdoAttachmentsPicker({
  projectId,
  attachments,
  onChange,
}: {
  projectId: string;
  attachments: PdfAttachment[];
  onChange: (next: PdfAttachment[]) => void;
}) {
  const [soilOptions, setSoilOptions] = useState<SoilOption[]>([]);
  const [waterOptions, setWaterOptions] = useState<WaterOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    const [{ data: solos }, { data: aguas }] = await Promise.all([
      supabase.from("soil_descriptions").select("id, nome_sondagem, nomenclatura_poco").eq("project_id", projectId).eq("finalized", true),
      supabase.from("water_samplings").select("id, data, poco").eq("project_id", projectId).eq("finalized", true),
    ]);
    if (solos) {
      setSoilOptions(solos.map((s: any) => ({ id: s.id, label: s.nomenclatura_poco || s.nome_sondagem || "Perfil sem identificação" })));
    }
    if (aguas) {
      setWaterOptions(aguas.map((a: any) => ({ id: a.id, label: `${a.poco || "Poço"} — ${a.data || "sem data"}` })));
    }
    setLoading(false);
  }

  function isChecked(tipo: PdfAttachment["tipo"], id: string) {
    return attachments.some((a) => a.tipo === tipo && a.id === id);
  }

  function toggle(tipo: PdfAttachment["tipo"], id: string) {
    if (isChecked(tipo, id)) {
      onChange(attachments.filter((a) => !(a.tipo === tipo && a.id === id)));
    } else {
      onChange([...attachments, { tipo, id, ordem: attachments.length }]);
    }
  }

  if (loading) return null;

  if (soilOptions.length === 0 && waterOptions.length === 0) {
    return <p className="text-sm text-gray-400">Nenhum perfil de solo ou amostragem finalizada neste projeto para anexar.</p>;
  }

  return (
    <div className="space-y-4">
      {soilOptions.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Perfis Descritivos de Solo</p>
          <div className="space-y-2">
            {soilOptions.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded-lg p-2.5 cursor-pointer hover:border-[#80b02d] transition">
                <input
                  type="checkbox"
                  checked={isChecked("soil_description", s.id)}
                  onChange={() => toggle("soil_description", s.id)}
                  className="w-4 h-4 accent-[#80b02d]"
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {waterOptions.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Amostragens Físico-Químicas</p>
          <div className="space-y-2">
            {waterOptions.map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded-lg p-2.5 cursor-pointer hover:border-[#80b02d] transition">
                <input
                  type="checkbox"
                  checked={isChecked("water_sampling", w.id)}
                  onChange={() => toggle("water_sampling", w.id)}
                  className="w-4 h-4 accent-[#80b02d]"
                />
                {w.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
