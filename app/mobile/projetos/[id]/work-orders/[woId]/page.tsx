"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../../lib/supabase";
import MobileShell from "../../../../../../components/layout/MobileShell";
import SignatureCanvas from "react-signature-canvas";

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
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [openSign, setOpenSign] = useState(false);

  const sigRef = useRef<SignatureCanvas | null>(null);

  /* ================= LOAD ================= */

  async function load() {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("finalized, signature_url")
      .eq("id", workOrderId)
      .single();

    setFinalized(!!wo?.finalized);
    setSignatureUrl(wo?.signature_url ?? null);

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

  /* ================= ASSINATURA ================= */

  async function salvarAssinatura() {
    if (!sigRef.current) return;

    if (sigRef.current.isEmpty()) {
      alert("Assine antes de salvar.");
      return;
    }

    const base64 = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    const blob = await (await fetch(base64)).blob();

    const fileName = `signatures/${workOrderId}.png`;

    await supabase.storage
      .from("signatures")
      .upload(fileName, blob, { upsert: true });

    const { data } = supabase.storage
      .from("signatures")
      .getPublicUrl(fileName);

    await supabase
      .from("work_orders")
      .update({ signature_url: data.publicUrl })
      .eq("id", workOrderId);

    setSignatureUrl(data.publicUrl);
    setOpenSign(false);
  }

  /* ================= PROGRESS ================= */

  const total = activities.length;
  const done = activities.filter(a => a.status !== null).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  /* ================= STATUS ================= */

  async function updateStatus(id: string, status: string) {
    if (finalized) return;

    if (status === "não concluído") {
      const note = prompt("Informe a observação obrigatória:");

      if (!note || note.trim() === "") {
        alert("A observação é obrigatória para marcar como não concluído.");
        return;
      }

      setActivities(prev =>
        prev.map(a =>
          a.id === id ? { ...a, status, note } : a
        )
      );

      await supabase
        .from("activities")
        .update({ status, note })
        .eq("id", id);

      return;
    }

    setActivities(prev =>
      prev.map(a => a.id === id ? { ...a, status } : a)
    );

    await supabase
      .from("activities")
      .update({ status })
      .eq("id", id);
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
    if (!signatureUrl) {
      alert("É obrigatório assinar antes de finalizar.");
      return;
    }

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
      subtitle={`${done}/${total} atividades • ${percent}%`}
      backHref={`/mobile/projetos/${params.id}/work-orders`}
    >

      {/* ASSINATURA */}
      {!finalized && (
        <div className="px-4 mt-4">
          <button
            onClick={() => setOpenSign(true)}
            className="w-full py-4 rounded-2xl font-bold text-white bg-[var(--purple)]"
          >
            {signatureUrl ? "Refazer assinatura" : "Assinar responsável"}
          </button>
        </div>
      )}

      {signatureUrl && (
        <div className="px-4 mt-4">
          <div className="bg-white rounded-2xl p-3 border">
            <p className="text-xs mb-2 text-gray-500">Assinatura registrada</p>
            <img src={signatureUrl} className="w-full h-32 object-contain" />
          </div>
        </div>
      )}

      {/* CARDS */}
      <div className="space-y-4 pb-28 mt-4">
        {activities.map(act => (
          <div key={act.id}>{/* swipe cards continuam iguais */}</div>
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

      {/* MODAL */}
      {openSign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-4 space-y-3">

            <p className="font-bold text-center">Assine abaixo</p>

            <SignatureCanvas
              ref={sigRef}
              penColor="black"
              canvasProps={{
                className: "w-full h-48 bg-white border rounded-xl",
              }}
            />

            <div className="flex gap-2">
              <button
                onClick={() => sigRef.current?.clear()}
                className="flex-1 py-3 rounded-xl bg-gray-200 font-bold"
              >
                Limpar
              </button>

              <button
                onClick={salvarAssinatura}
                className="flex-1 py-3 rounded-xl bg-[var(--green)] text-white font-bold"
              >
                Salvar
              </button>
            </div>

            <button
              onClick={() => setOpenSign(false)}
              className="w-full text-sm text-gray-500"
            >
              Cancelar
            </button>

          </div>
        </div>
      )}
    </MobileShell>
  );
}
