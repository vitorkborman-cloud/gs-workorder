"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AppShell from "../../../components/AppShell";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import { isMobileDevice } from "../../../lib/isMobile";

type Activity = {
  id: string;
  description: string;
  status: string | null;
  note: string | null;
  images: string[] | null;
};

export default function WorkOrderPage() {
  const params = useParams();
  const workOrderId = params.id as string;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [finalized, setFinalized] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobileDevice());
    load();
  }, []);

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

  /* ---------- REDIMENSIONAMENTO ---------- */
  async function resizeImage(file: File): Promise<File> {
    const img = document.createElement("img");
    const reader = new FileReader();

    return new Promise((resolve) => {
      reader.onload = e => img.src = e.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;

        const ratio = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        const width = img.width * ratio;
        const height = img.height * ratio;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

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
      prev.map(a => (a.id === id ? { ...a, images: newImages } : a))
    );

    await supabase.from("activities").update({ images: newImages }).eq("id", id);
  }

  async function removeImage(id: string, imageUrl: string) {
    if (finalized) return;

    const path = imageUrl.split("/activity-images/")[1];
    await supabase.storage.from("activity-images").remove([path]);

    const activity = activities.find(a => a.id === id);
    const newImages = (activity?.images ?? []).filter(img => img !== imageUrl);

    setActivities(prev =>
      prev.map(a => (a.id === id ? { ...a, images: newImages } : a))
    );

    await supabase.from("activities").update({ images: newImages }).eq("id", id);
  }

  async function updateStatus(id: string, status: string) {
    if (finalized) return;

    setActivities(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    await supabase.from("activities").update({ status }).eq("id", id);
  }

  async function updateNote(id: string, note: string) {
    if (finalized) return;

    setActivities(prev => prev.map(a => a.id === id ? { ...a, note } : a));
    await supabase.from("activities").update({ note }).eq("id", id);
  }

  async function finalizeWorkOrder() {
    if (finalized) return;

    const incomplete = activities.some(a => !a.status);
    if (incomplete) {
      alert("Todas as atividades precisam ser respondidas.");
      return;
    }

    const ok = confirm("Finalizar Work Order?");
    if (!ok) return;

    await supabase.from("work_orders").update({ finalized: true }).eq("id", workOrderId);
    load();
  }

  function statusBadge(status: string | null) {
    if (!status) return null;
    return status === "concluído"
      ? <span className="text-green-600 font-bold text-sm">✔ Concluído</span>
      : <span className="text-red-600 font-bold text-sm">✖ Não concluído</span>;
  }

  return (
    <AppShell>
      <Card title="Atividades">

        <div className="space-y-4">
          {activities.map(act => (
            <div key={act.id} className="border rounded-xl p-3 space-y-3">

              <div className="flex justify-between items-center">
                <p className="font-bold">{act.description}</p>
                {finalized && statusBadge(act.status)}
              </div>

              {!finalized && (
                <div className="flex gap-2">
                  <button onClick={() => updateStatus(act.id, "concluído")}>Concluído</button>
                  <button onClick={() => updateStatus(act.id, "não concluído")}>Não concluído</button>
                </div>
              )}

              <textarea
                placeholder="Observações..."
                value={act.note ?? ""}
                disabled={finalized}
                onChange={(e) => updateNote(act.id, e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
              />

              <div className="space-y-2">
                {!finalized && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (!e.target.files?.[0]) return;
                      uploadImage(act.id, e.target.files[0]);
                    }}
                  />
                )}

                <div className="flex gap-2 flex-wrap">
                  {act.images?.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} className="w-24 h-24 object-cover rounded-lg border"/>
                      {!finalized && (
                        <button
                          onClick={() => removeImage(act.id, img)}
                          className="absolute -top-2 -right-2 bg-white border rounded-full px-2 text-xs"
                        >X</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ))}
        </div>

        {!finalized && (
          <div className="mt-6">
            <Button text="Finalizar Work Order" onClick={finalizeWorkOrder}/>
          </div>
        )}

      </Card>
    </AppShell>
  );
}
