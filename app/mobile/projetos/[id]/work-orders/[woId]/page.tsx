"use client";

import { useEffect, useState, useRef } from "react";
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

  /* ================= IMAGE ================= */

  async function resizeImage(file: File): Promise<File> {
    const img = document.createElement("img");
    const reader = new FileReader();

    return new Promise((resolve) => {
      reader.onload = e => img.src = e.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1200;

        const ratio = img.width > MAX ? MAX / img.width : 1;
        const w = img.width * ratio;
        const h = img.height * ratio;

        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          blob => resolve(new File([blob!], file.name, { type: "image/jpeg" })),
          "image/jpeg",
          0.8
        );
      };

      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(id: string, file: File) {
    if (finalized) return;

    const resized = await resizeImage(file);
    const fileName = `${id}/${Date.now()}.jpg`;

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

    const url = data.publicUrl;

    const activity = activities.find(a => a.id === id);
    const images = activity?.images ?? [];

    if (images.length >= 3) {
      alert("Máximo de 3 imagens");
      return;
    }

    const newImages = [...images, url];

    setActivities(prev =>
      prev.map(a => a.id === id ? { ...a, images: newImages } : a)
    );

    await supabase.from("activities").update({ images: newImages }).eq("id", id);
  }

  async function removeImage(id: string, img: string) {
    if (finalized) return;

    const path = img.split("/activity-images/")[1];
    await supabase.storage.from("activity-images").remove([path]);

    const activity = activities.find(a => a.id === id);
    const newImages = (activity?.images ?? []).filter(i => i !== img);

    setActivities(prev =>
      prev.map(a => a.id === id ? { ...a, images: newImages } : a)
    );

    await supabase.from("activities").update({ images: newImages }).eq("id", id);
  }

  /* ================= FINALIZE ================= */

  async function finalize() {
    const incomplete = activities.some(a => !a.status);
    if (incomplete) {
      alert("Todas as atividades precisam ser respondidas.");
      return;
    }

    await supabase.from("work_orders").update({ finalized: true }).eq("id", workOrderId);
    load();
  }

  /* ================= SWIPE CARD ================= */

  function SwipeCard({ act }: { act: Activity }) {
    const startX = useRef<number | null>(null);
    const startY = useRef<number | null>(null);

    function onTouchStart(e: React.TouchEvent) {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    }

    function onTouchEnd(e: React.TouchEvent) {
      if (startX.current === null || startY.current === null) return;

      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 70) {
        if (dx > 0) updateStatus(act.id, "concluído");
        else updateStatus(act.id, "não concluído");
      }

      startX.current = null;
      startY.current = null;
    }

    return (
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`
          rounded-2xl p-4 border transition space-y-3
          ${act.status === "concluído" && "border-green-500 bg-green-50"}
          ${act.status === "não concluído" && "border-red-500 bg-red-50"}
          ${!act.status && "border-gray-200 bg-white"}
        `}
      >
        <p className="font-semibold">{act.description}</p>

        {/* OBS */}
        <textarea
          disabled={finalized}
          defaultValue={act.note ?? ""}
          onBlur={(e) => updateNote(act.id, e.target.value)}
          placeholder="Observações..."
          className="w-full rounded-xl border p-3 text-sm"
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

        <div className="flex gap-2 flex-wrap">
          {act.images?.map((img, i) => (
            <div key={i} className="relative">
              <img src={img} className="w-20 h-20 object-cover rounded-lg border" />
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

        <div className="text-xs text-gray-400">
          ➜ Deslize → concluído | ← não concluído
        </div>
      </div>
    );
  }

  return (
    <MobileShell
      title="Checklist"
      backHref={`/mobile/projetos/${params.id}/work-orders`}
    >
      <div className="space-y-4 pb-28">
        {activities.map(act => (
          <SwipeCard key={act.id} act={act} />
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
