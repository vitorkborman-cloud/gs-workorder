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

type SystemData = {
  equipamento: string;
  medicao: string;
};

export default function MobileWorkOrderPage() {
  const params = useParams();
  const workOrderId = params.woId as string;
  const projectId = params.id as string;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [finalized, setFinalized] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [openSign, setOpenSign] = useState(false);

  // ✅ STATES DA WORK ORDER
  const [additionalInfo, setAdditionalInfo] = useState<string>("");
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [systemData, setSystemData] = useState<SystemData[]>([]); // NOVO STATE

  const sigRef = useRef<SignatureCanvas | null>(null);

  /* ================= LOAD ================= */

  async function load() {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("finalized, signature_url, additional_info, additional_images, system_data") // Adicionado system_data
      .eq("id", workOrderId)
      .single();

    setFinalized(!!wo?.finalized);
    setSignatureUrl(wo?.signature_url ?? null);
    setAdditionalInfo(wo?.additional_info ?? "");
    setAdditionalImages(wo?.additional_images ?? []);
    setSystemData(wo?.system_data ?? []);

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
        alert("A observação é obrigatória.");
        return;
      }

      setActivities(prev =>
        prev.map(a => a.id === id ? { ...a, status, note } : a)
      );

      await supabase.from("activities").update({ status, note }).eq("id", id);
      return;
    }

    setActivities(prev =>
      prev.map(a => a.id === id ? { ...a, status } : a)
    );

    await supabase.from("activities").update({ status }).eq("id", id);
  }

  async function updateNote(id: string, note: string) {
    if (finalized) return;
    await supabase.from("activities").update({ note }).eq("id", id);
  }

  /* ================= IMAGENS ================= */

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

    const activity = activities.find(a => a.id === id);
    const images = activity?.images ?? [];

    if (images.length >= 3) {
      alert("Máximo de 3 imagens.");
      return;
    }

    const resized = await resizeImage(file);
    const fileName = `${id}/${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("activity-images")
      .upload(fileName, resized);

    if (error) {
      alert("Erro ao enviar imagem.");
      return;
    }

    const { data } = supabase.storage
      .from("activity-images")
      .getPublicUrl(fileName);

    const newImages = [...images, data.publicUrl];

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

  /* ================= DADOS DO SISTEMA (NOVO) ================= */

  async function addSystemData() {
    if (finalized) return;
    const newItems = [...systemData, { equipamento: "", medicao: "" }];
    setSystemData(newItems);
    await supabase.from("work_orders").update({ system_data: newItems }).eq("id", workOrderId);
  }

  function handleSystemDataChange(index: number, field: "equipamento" | "medicao", value: string) {
    if (finalized) return;
    const newItems = [...systemData];
    newItems[index][field] = value;
    setSystemData(newItems);
  }

  async function syncSystemData() {
    if (finalized) return;
    await supabase.from("work_orders").update({ system_data: systemData }).eq("id", workOrderId);
  }

  async function removeSystemData(index: number) {
    if (finalized) return;
    const newItems = systemData.filter((_, i) => i !== index);
    setSystemData(newItems);
    await supabase.from("work_orders").update({ system_data: newItems }).eq("id", workOrderId);
  }

  /* ================= IMAGENS ADICIONAIS ================= */

  async function uploadAdditionalImage(file: File) {
    if (finalized) return;

    if (additionalImages.length >= 3) {
      alert("Máximo de 3 imagens.");
      return;
    }

    const resized = await resizeImage(file);
    const fileName = `additional/${workOrderId}/${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("activity-images")
      .upload(fileName, resized);

    if (error) {
      alert("Erro ao enviar imagem.");
      return;
    }

    const { data } = supabase.storage
      .from("activity-images")
      .getPublicUrl(fileName);

    const newImages = [...additionalImages, data.publicUrl];

    setAdditionalImages(newImages);

    await supabase
      .from("work_orders")
      .update({ additional_images: newImages })
      .eq("id", workOrderId);
  }

  async function removeAdditionalImage(img: string) {
    if (finalized) return;

    const path = img.split("/activity-images/")[1];
    await supabase.storage.from("activity-images").remove([path]);

    const newImages = additionalImages.filter(i => i !== img);

    setAdditionalImages(newImages);

    await supabase
      .from("work_orders")
      .update({ additional_images: newImages })
      .eq("id", workOrderId);
  }

  async function updateAdditionalInfo(text: string) {
    if (finalized) return;

    setAdditionalInfo(text);

    await supabase
      .from("work_orders")
      .update({ additional_info: text })
      .eq("id", workOrderId);
  }

  /* ================= ASSINATURA ================= */

  async function salvarAssinatura() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert("Assine antes de salvar.");
      return;
    }

    const base64 = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    const blob = await (await fetch(base64)).blob();
    const fileName = `${workOrderId}.png`;

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

  async function finalize() {
    if (!signatureUrl) {
      alert("Assine antes de finalizar.");
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

  /* ================= SWIPE ================= */

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

        <textarea
          disabled={finalized}
          defaultValue={act.note ?? ""}
          onBlur={(e) => updateNote(act.id, e.target.value)}
          placeholder="Observações..."
          className="w-full rounded-xl border p-3 text-sm bg-white"
        />

        {!finalized && (
          <>
            <input
              id={`file-${act.id}`}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (!files) return;
                Array.from(files).forEach(f => uploadImage(act.id, f));
                e.target.value = "";
              }}
            />

            <label
              htmlFor={`file-${act.id}`}
              className="w-full block text-center py-3 rounded-2xl bg-[var(--purple)] text-white font-bold shadow-md"
            >
              📎 Anexar imagem
            </label>
          </>
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
      subtitle={`${done}/${total} atividades • ${percent}%`}
      backHref={`/mobile/projetos/${projectId}/work-orders`}
    >
      {!finalized && (
        <div className="px-4 mt-4">
          <button
            onClick={() => setOpenSign(true)}
            className="w-full py-4 rounded-2xl font-bold text-white bg-[var(--purple)] shadow-md"
          >
            {signatureUrl ? "Refazer assinatura" : "Assinatura do responsável"}
          </button>
        </div>
      )}

      {signatureUrl && (
        <div className="px-4 mt-4">
          <div className="bg-white rounded-2xl p-3 border">
            <p className="text-xs mb-2 text-gray-500 font-semibold uppercase tracking-wider">Assinatura registrada</p>
            <img src={signatureUrl} className="w-full h-32 object-contain" />
          </div>
        </div>
      )}

      <div className="space-y-4 mt-4 px-4">
        {activities.map(act => (
          <SwipeCard key={act.id} act={act} />
        ))}
      </div>

      {/* ================= DADOS DO SISTEMA (NOVO BLOCO) ================= */}

      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl p-4 border space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <p className="font-bold text-sm text-[#391e2a] uppercase tracking-wider">
              Dados do Sistema
            </p>
          </div>

          <div className="space-y-4">
            {systemData.map((item, index) => (
              <div key={index} className="relative bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-3">
                
                {/* Botão de remover se houver mais de um e não estiver finalizado */}
                {!finalized && (
                  <button 
                    onClick={() => removeSystemData(index)}
                    className="absolute -top-2 -right-2 bg-red-100 text-red-600 border border-red-200 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                  >
                    X
                  </button>
                )}

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Equipamento</label>
                  <input
                    disabled={finalized}
                    value={item.equipamento}
                    onChange={(e) => handleSystemDataChange(index, "equipamento", e.target.value)}
                    onBlur={syncSystemData}
                    placeholder="Ex: Hidrômetro FM-01"
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-sm bg-white mt-1 outline-none focus:border-[var(--green)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Medição</label>
                  <input
                    disabled={finalized}
                    value={item.medicao}
                    onChange={(e) => handleSystemDataChange(index, "medicao", e.target.value)}
                    onBlur={syncSystemData}
                    placeholder="Ex: 1539,13"
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-sm bg-white mt-1 outline-none focus:border-[var(--green)]"
                  />
                </div>
              </div>
            ))}
          </div>

          {!finalized && (
            <button
              onClick={addSystemData}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition flex justify-center items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Adicionar Equipamento
            </button>
          )}
        </div>
      </div>

      {/* ================= INFORMAÇÕES ADICIONAIS ================= */}

      <div className="px-4 mt-6 space-y-3 pb-28">
        <div className="bg-white rounded-2xl p-4 border space-y-3 shadow-sm">

          <p className="font-bold text-sm text-[#391e2a] uppercase tracking-wider">
            Informações adicionais
          </p>

          <textarea
            value={additionalInfo}
            disabled={finalized}
            onChange={(e) => updateAdditionalInfo(e.target.value)}
            placeholder="Observações não planejadas identificadas em campo..."
            className="w-full rounded-xl border border-gray-200 p-3 text-sm bg-gray-50 outline-none focus:border-[var(--green)]"
          />

          {!finalized && (
            <>
              <input
                id="additional-file"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  Array.from(files).forEach(f => uploadAdditionalImage(f));
                  e.target.value = "";
                }}
              />

              <label
                htmlFor="additional-file"
                className="w-full block text-center py-3 rounded-xl bg-[var(--purple)] text-white font-bold shadow-md"
              >
                📎 Anexar imagem extra
              </label>
            </>
          )}

          <div className="flex gap-2 flex-wrap">
            {additionalImages.map((img, i) => (
              <div key={i} className="relative">
                <img
                  src={img}
                  className="w-20 h-20 object-cover rounded-lg border shadow-sm"
                />
                {!finalized && (
                  <button
                    onClick={() => removeAdditionalImage(img)}
                    className="absolute -top-2 -right-2 bg-white border rounded-full px-2 text-xs"
                  >
                    X
                  </button>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>

      {!finalized && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
          <button
            onClick={finalize}
            className="w-full py-4 rounded-xl font-bold text-white bg-[var(--green)] shadow-md text-lg"
          >
            Finalizar Work Order
          </button>
        </div>
      )}

      {/* MODAL DE ASSINATURA */}
      {openSign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <p className="font-extrabold text-center text-lg text-[#391e2a]">Assine abaixo</p>

            <SignatureCanvas
              ref={sigRef}
              penColor="#391e2a"
              canvasProps={{
                className: "w-full h-48 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl",
              }}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => sigRef.current?.clear()}
                className="flex-1 py-3.5 rounded-xl bg-gray-100 text-gray-600 font-bold"
              >
                Limpar
              </button>

              <button
                onClick={salvarAssinatura}
                className="flex-1 py-3.5 rounded-xl bg-[var(--green)] text-white font-bold shadow-md"
              >
                Salvar
              </button>
            </div>

            <button
              onClick={() => setOpenSign(false)}
              className="w-full py-2 text-sm font-semibold text-gray-400 mt-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </MobileShell>
  );
}