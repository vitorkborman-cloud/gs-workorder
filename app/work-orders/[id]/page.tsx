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

  async function createActivity() {
    if (finalized || mobile) return;

    const description = prompt("Descrição da atividade:");
    if (!description) return;

    await supabase.from("activities").insert({
      description,
      work_order_id: workOrderId,
    });

    load();
  }

  async function deleteActivity(id: string, description: string) {
    if (finalized || mobile) return;

    const ok = confirm(`Excluir a atividade:\n"${description}"?`);
    if (!ok) return;

    await supabase.from("activities").delete().eq("id", id);
    load();
  }

  async function updateStatus(id: string, status: string) {
    if (finalized) return;

    setActivities(prev =>
      prev.map(a => (a.id === id ? { ...a, status } : a))
    );

    await supabase.from("activities").update({ status }).eq("id", id);
  }

  async function updateNote(id: string, note: string) {
    if (finalized) return;

    setActivities(prev =>
      prev.map(a => (a.id === id ? { ...a, note } : a))
    );

    await supabase.from("activities").update({ note }).eq("id", id);
  }

  async function uploadImage(id: string, file: File) {
    if (finalized) return;

    const fileName = `${id}/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("activity-images")
      .upload(fileName, file);

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

    await supabase
      .from("activities")
      .update({ images: newImages })
      .eq("id", id);
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

    await supabase
      .from("work_orders")
      .update({ finalized: true })
      .eq("id", workOrderId);

    load();
  }

  function statusBadge(status: string | null) {
    if (!status) return null;
    if (status === "concluído")
      return <span className="text-green-600 font-bold text-sm">✔ Concluído</span>;
    return <span className="text-red-600 font-bold text-sm">✖ Não concluído</span>;
  }

  return (
    <AppShell>
      <Card title="Atividades">

        {/* BOTÃO CRIAR (apenas desktop) */}
        {!finalized && !mobile && (
          <div className="mb-4">
            <Button text="Criar Atividade" onClick={createActivity} />
          </div>
        )}

        <div className="space-y-4">
          {activities.map(act => (
            <div key={act.id} className="border rounded-xl p-3 space-y-3">

              <div className="flex justify-between items-center">
                <p className="font-bold">{act.description}</p>

                {!finalized && !mobile && (
                  <button
                    onClick={() => deleteActivity(act.id, act.description)}
                    className="text-xs font-bold underline"
                  >
                    Excluir
                  </button>
                )}

                {finalized && statusBadge(act.status)}
              </div>

              {!finalized && (
                <div className="flex gap-2">
                  <button onClick={() => updateStatus(act.id, "concluído")}>
                    Concluído
                  </button>
                  <button onClick={() => updateStatus(act.id, "não concluído")}>
                    Não concluído
                  </button>
                </div>
              )}

              {/* OBSERVAÇÃO */}
              <textarea
                placeholder="Observações..."
                value={act.note ?? ""}
                disabled={finalized}
                onChange={(e) => updateNote(act.id, e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
              />

              {/* IMAGENS */}
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
                    <img
                      key={i}
                      src={img}
                      className="w-24 h-24 object-cover rounded-lg border"
                    />
                  ))}
                </div>
              </div>

            </div>
          ))}
        </div>

        {!finalized && (
          <div className="mt-6">
            <Button text="Finalizar Work Order" onClick={finalizeWorkOrder} />
          </div>
        )}

      </Card>
    </AppShell>
  );
}
