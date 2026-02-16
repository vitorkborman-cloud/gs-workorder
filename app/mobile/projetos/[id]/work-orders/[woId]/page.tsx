"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../../lib/supabase";
import MobileShell from "../../../../../../components/layout/MobileShell";

type Activity = {
  id: string;
  description: string;
  status: string | null;
  note: string | null;
  images: string[] | null;
};

export default function MobileWorkOrderPage() {
  const params = useParams();
  const workOrderId = params.woId as string;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [finalized, setFinalized] = useState(false);

  /* ================= LOAD ================= */

  async function load() {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("finalized")
      .eq("id", workOrderId)
      .single();

    setFinalized(!!wo?.finalized);

    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true });

    if (data) setActivities(data);
  }

  useEffect(() => {
    load();
  }, []);

  /* ================= IMAGE RESIZE ================= */

  async function resizeImage(file: File): Promise<File> {
    const img = document.createElement("img");
    const reader = new FileReader();

    return new Promise((resolve) => {
      reader.onload = e => img.src = e.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1200;

        const ratio = img.width > MAX ? MAX / img.width : 1;
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob =>
          resolve(new File([blob!], file.name, { type: "image/jpeg" }))
        , "image/jpeg", 0.8);
      };

      reader.readAsDataURL(file);
    });
  }

  /* ================= UPLOAD ================= */

  async function uploadImage(activityId: string, file: File) {
    if (finalized) return;

    const act = activities.find(a => a.id === activityId);
    const images = act?.images ?? [];

    if (images.length >= 3) {
      alert("Máximo de 3 imagens por atividade");
      return;
    }

    const resized = await resizeImage(file);
    const fileName = `${activityId}/${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("activity-images")
      .upload(fileName, resized);

    if (error) {
      alert("Erro ao enviar imagem");
      return;
    }

    const { data } = supabase.storage
      .from("activity-images")
      .getPublicUrl(fileName);

    const newImages = [...images, data.publicUrl];

    setActivities(prev =>
      prev.map(a => a.id === activityId ? { ...a, images: newImages } : a)
    );

    await supabase.from("activities").update({ images: newImages }).eq("id", activityId);
  }

  async function removeImage(activityId: string, url: string) {
    if (finalized) return;

    const path = url.split("/activity-images/")[1];
    await supabase.storage.from("activity-images").remove([path]);

    const act = activities.find(a => a.id === activityId);
    const newImages = (act?.images ?? []).filter(i => i !== url);

    setActivities(prev =>
      prev.map(a => a.id === activityId ? { ...a, images: newImages } : a)
    );

    await supabase.from("activities").update({ images: newImages }).eq("id", activityId);
  }

  /* ================= STATUS ================= */

  async function updateStatus(id: string, status: string) {
    if (finalized) return;

    setActivities(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    await supabase.from("activities").update({ status }).eq("id", id);
  }

  async function updateNote(id: string, note: string) {
    if (finalized) return;
    await supabase.from("activities").update({ note }).eq("id", id);
  }

  async function finalize() {
    const incomplete = activities.some(a => !a.status);
    if (incomplete) {
      alert("Todas as atividades precisam ser respondidas.");
      return;
    }

    await supabase.from("work_orders").update({ finalized: true }).eq("id", workOrderId);
    load();
  }

  /* ================= UI ================= */

  return (
    <MobileShell
      title="Checklist"
      backHref={`/mobile/projetos/${params.id}/work-orders`}
    >
      <div className="space-y-4 pb-28">

        {activities.map(act => (
          <div
            key={act.id}
            className={`
              rounded-2xl p-4 border
              ${act.status === "concluído" && "border-green-500 bg-green-50"}
              ${act.status === "não concluído" && "border-red-500 bg-red-50"}
              ${!act.status && "border-gray-200 bg-white"}
            `}
          >

            <p className="font-semibold mb-3">{act.description}</p>

            {/* STATUS */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                disabled={finalized}
                onClick={() => updateStatus(act.id, "concluído")}
                className={`py-3 rounded-xl font-bold ${
                  act.status === "concluído"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100"
                }`}
              >
                ✔ Concluído
              </button>

              <button
                disabled={finalized}
                onClick={() => updateStatus(act.id, "não concluído")}
                className={`py-3 rounded-xl font-bold ${
                  act.status === "não concluído"
                    ? "bg-red-600 text-white"
                    : "bg-gray-100"
                }`}
              >
                ✖ Não
              </button>
            </div>

            {/* OBS */}
            <textarea
              disabled={finalized}
              defaultValue={act.note ?? ""}
              onBlur={(e) => updateNote(act.id, e.target.value)}
              placeholder="Observações..."
              className="w-full rounded-xl border p-3 text-sm mb-3"
            />

            {/* FOTO */}
            {!finalized && (
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  if (!e.target.files?.[0]) return;
                  uploadImage(act.id, e.target.files[0]);
                }}
              />
            )}

            {/* PREVIEW */}
            <div className="flex gap-2 flex-wrap mt-2">
              {act.images?.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} className="w-24 h-24 rounded-xl object-cover border"/>
                  {!finalized && (
                    <button
                      onClick={() => removeImage(act.id, img)}
                      className="absolute -top-2 -right-2 bg-white border rounded-full px-2 text-xs"
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
            </div>

          </div>
        ))}

      </div>

      {!finalized && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
          <button
            onClick={finalize}
            className="w-full py-4 rounded-2xl font-bold text-white bg-[var(--green)]"
          >
            Finalizar Work Order
          </button>
        </div>
      )}

    </MobileShell>
  );
}
