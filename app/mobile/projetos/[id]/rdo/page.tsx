"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MobileShell from "@/components/layout/MobileShell";
import SignaturePad from "@/components/SignaturePad";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useRef } from "react";

/* ================= TYPES ================= */

type Clima = {
  periodo: string;
  tempo: string;
  condicao: string;
  razao: string;
};

type Envolvido = {
  empresa: string;
  colaboradores: string;
  funcao: string;
};

type Atividade = {
  atividade: string;
  empresa: string;
  status: string;
  obs: string;
};

type Foto = {
  file: File | null;
  preview: string;
  legenda: string;
};

type Assinatura = {
  empresa: string;
  assinatura?: string;
};

/* ================= CONSTANTES ================= */

const tempos = ["Claro", "Chuva", "Tempestade"];
const condicoes = ["Praticável", "Não praticável"];
const statusList = ["Concluído", "Não concluído"];

/* ================= PAGE ================= */

export default function RdoPage() {
const [draftId, setDraftId] = useState<string | null>(null);
  const params = useParams();
  const projectId = params?.id as string;

  const [assinaturaAberta, setAssinaturaAberta] = useState<number | null>(null);

  const [sheq, setSheq] = useState({
  incidente: "",
  incidenteObs: "",
  vazamento: "",
  vazamentoObs: "",
});

  const pdfRef = useRef<HTMLDivElement>(null);

  const [projectName, setProjectName] = useState("");

  /* ===== GERAL ===== */
  const [dataRelatorio, setDataRelatorio] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const [clima, setClima] = useState<Clima[]>([
    { periodo: "Manhã", tempo: "", condicao: "", razao: "" },
    { periodo: "Tarde", tempo: "", condicao: "", razao: "" },
    { periodo: "Noite", tempo: "", condicao: "", razao: "" },
  ]);

  /* ===== ENVOLVIDOS ===== */
  const [envolvidos, setEnvolvidos] = useState<Envolvido[]>([
    { empresa: "Greensoil", colaboradores: "", funcao: "" },
  ]);

  /* ===== ATIVIDADES ===== */
  const [atividades, setAtividades] = useState<Atividade[]>([
    { atividade: "", empresa: "", status: "", obs: "" },
  ]);

  {/* ================= SHEQ ================= */}
<Section title="SHEQ">

  {/* INCIDENTE */}
  <div className="space-y-2">
    <div className="text-sm font-semibold">Incidente/Acidente?</div>

    <div className="flex gap-4 text-sm">
      {["Sim", "Não", "N/A"].map((op) => (
        <label key={op} className="flex items-center gap-1">
          <input
            type="radio"
            name="incidente"
            value={op}
            checked={sheq.incidente === op}
            onChange={(e) =>
              setSheq({ ...sheq, incidente: e.target.value })
            }
          />
          {op}
        </label>
      ))}
    </div>

    <Input
      label="Observações"
      value={sheq.incidenteObs}
      onChange={(v: string) =>
        setSheq({ ...sheq, incidenteObs: v })
      }
    />
  </div>

  {/* VAZAMENTO */}
  <div className="space-y-2 mt-4">
    <div className="text-sm font-semibold">Vazamento?</div>

    <div className="flex gap-4 text-sm">
      {["Sim", "Não", "N/A"].map((op) => (
        <label key={op} className="flex items-center gap-1">
          <input
            type="radio"
            name="vazamento"
            value={op}
            checked={sheq.vazamento === op}
            onChange={(e) =>
              setSheq({ ...sheq, vazamento: e.target.value })
            }
          />
          {op}
        </label>
      ))}
    </div>

    <Input
      label="Observações"
      value={sheq.vazamentoObs}
      onChange={(v: string) =>
        setSheq({ ...sheq, vazamentoObs: v })
      }
    />
  </div>

</Section>

  /* ===== COMENTÁRIOS ===== */
  const [comentarios, setComentarios] = useState("");

  /* ===== FOTOS ===== */
  const [fotos, setFotos] = useState<Foto[]>([
    { file: null, preview: "", legenda: "" },
  ]);

  /* ===== ASSINATURAS ===== */
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([
    { empresa: "Greensoil" },
  ]);

  useEffect(() => {
  if (!projectId) return;

  loadProject();
  loadDraft();

}, [projectId]);

  async function loadProject() {
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    if (data) setProjectName(data.name);
  }

async function salvarRascunho() {

  // 🔁 SE JÁ EXISTE RASCUNHO → ATUALIZA
  if (draftId) {

    const { error } = await supabase
      .from("rdo_reports")
      .update({
        data: dataRelatorio,
        inicio,
        fim,
        clima,
        envolvidos,
        atividades,
        sheq,
        comentarios,
        fotos: fotos.map(f => ({
  preview: f.preview,
  legenda: f.legenda,
})),
        assinaturas,
        draft: true,
      })
      .eq("id", draftId);

    if (error) {
      console.error(error);
      console.error(error);
alert("Erro ao salvar rascunho: " + error?.message);
      return;
    }

  } else {

    // 🆕 SE NÃO EXISTE → CRIA NOVO
    const { data: newDraft, error } = await supabase
      .from("rdo_reports")
      .insert({
        project_id: projectId,
        data: dataRelatorio,
        inicio,
        fim,
        clima,
        envolvidos,
        atividades,
        comentarios,
        fotos: fotos.map(f => ({
  preview: f.preview,
  legenda: f.legenda,
})),
        assinaturas,
        draft: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      console.error(error);
alert("Erro ao salvar rascunho: " + error?.message);
      return;
    }

    if (newDraft) {
      setDraftId(newDraft.id);
    }
  }

  alert("Rascunho salvo!");
}

async function loadDraft() {
  const { data } = await supabase
    .from("rdo_reports")
    .select("*")
    .eq("project_id", projectId)
    .eq("draft", true)
    .maybeSingle();

  if (!data) return;
  setDraftId(data.id);

  setDataRelatorio(data.data || "");
  setInicio(data.inicio || "");
  setFim(data.fim || "");
  setClima(data.clima || clima);
  setEnvolvidos(data.envolvidos || envolvidos);
  setAtividades(data.atividades || atividades);
  setSheq(data.sheq || {
  incidente: "",
  incidenteObs: "",
  vazamento: "",
  vazamentoObs: "",
});
  setComentarios(data.comentarios || "");
  setFotos(data.fotos || fotos);
  setAssinaturas(data.assinaturas || assinaturas);
}

async function gerarPDF() {
  if (!pdfRef.current) return;

  const canvas = await html2canvas(pdfRef.current, {
    scale: 2,
  });

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");

  const width = 210;
  const height = (canvas.height * width) / canvas.width;

  pdf.addImage(imgData, "PNG", 0, 0, width, height);

  pdf.save(`RDO_${projectName}.pdf`);
}

  /* ================= FUNÇÕES ================= */

  const empresas = envolvidos.map(e => e.empresa).filter(Boolean);

  function removeItem(setter: any, index: number, list: any[]) {
    const copy = [...list];
    copy.splice(index, 1);
    setter(copy);
  }

 function handleFoto(i: number, file: File) {
  const reader = new FileReader();

  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target?.result as string;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // 🔥 REDUZ TAMANHO
      const MAX_WIDTH = 800;

      const scale = Math.min(1, MAX_WIDTH / img.width);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 🔥 COMPRESSÃO FORTE
      const compressed = canvas.toDataURL("image/jpeg", 0.6);

      const copy = [...fotos];
      copy[i] = {
        file: null, // 🔥 REMOVE arquivo pesado
        preview: compressed,
        legenda: copy[i]?.legenda || "",
      };

      setFotos(copy);
    };
  };

  reader.readAsDataURL(file);
}

  /* ================= UI ================= */

  return (
    <MobileShell
      title={projectName}
      subtitle="Relatório Diário de Obra"
      backHref={`/mobile/projetos/${projectId}`}
    >
      <div className="space-y-6">

        {/* ================= INFORMAÇÕES ================= */}
        <Section title="Informações Gerais">

          <div className="grid grid-cols-2 gap-3">
            <Input label="Data *" value={dataRelatorio} onChange={(v: string) => setDataRelatorio(v)} />
            <Input label="Hora início *" value={inicio} onChange={(v: string) => setInicio(v)} />
          </div>

          <Input label="Hora término *" value={fim} onChange={(v: string) => setFim(v)} />

          {clima.map((c, i) => (
            <div key={i} className="bg-gray-50 p-3 rounded-xl space-y-2">
              <div className="text-xs font-semibold">{c.periodo}</div>

              <Select label="Tempo" value={c.tempo} options={tempos}
                onChange={(v: string) => {
                  const copy = [...clima];
                  copy[i].tempo = v;
                  setClima(copy);
                }} />

              <Select label="Condição" value={c.condicao} options={condicoes}
                onChange={(v: string) => {
                  const copy = [...clima];
                  copy[i].condicao = v;
                  setClima(copy);
                }} />

              <Input label="Razão" value={c.razao}
                onChange={(v: string) => {
                  const copy = [...clima];
                  copy[i].razao = v;
                  setClima(copy);
                }} />
            </div>
          ))}

        </Section>

        {/* ================= ENVOLVIDOS ================= */}
        <Section title="Envolvidos">

          {envolvidos.map((e, i) => (
            <div key={i} className="relative grid grid-cols-3 gap-2">

              {i !== 0 && (
                <RemoveButton onClick={() => removeItem(setEnvolvidos, i, envolvidos)} />
              )}

              <Input label="Empresa" value={e.empresa}
                onChange={(v: string) => {
                  const copy = [...envolvidos];
                  copy[i].empresa = v;
                  setEnvolvidos(copy);
                }} />

              <Input label="N°" value={e.colaboradores}
                onChange={(v: string) => {
                  const copy = [...envolvidos];
                  copy[i].colaboradores = v;
                  setEnvolvidos(copy);
                }} />

              <Input label="Função" value={e.funcao}
                onChange={(v: string) => {
                  const copy = [...envolvidos];
                  copy[i].funcao = v;
                  setEnvolvidos(copy);
                }} />

            </div>
          ))}

          <button
            onClick={() =>
              setEnvolvidos([...envolvidos, { empresa: "", colaboradores: "", funcao: "" }])
            }
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg"
          >
            + Adicionar envolvidos
          </button>

        </Section>

        {/* ================= ATIVIDADES ================= */}
        <Section title="Atividades">

          {atividades.map((a, i) => (
            <div key={i} className="relative bg-gray-50 p-3 rounded-xl space-y-2">

              <RemoveButton onClick={() => removeItem(setAtividades, i, atividades)} />

              <Input label="Atividade" value={a.atividade}
                onChange={(v: string) => {
                  const copy = [...atividades];
                  copy[i].atividade = v;
                  setAtividades(copy);
                }} />

              <Select label="Empresa"
                value={a.empresa}
                options={empresas}
                onChange={(v: string) => {
                  const copy = [...atividades];
                  copy[i].empresa = v;
                  setAtividades(copy);
                }} />

              <Select label="Status"
                value={a.status}
                options={statusList}
                onChange={(v: string) => {
                  const copy = [...atividades];
                  copy[i].status = v;
                  setAtividades(copy);
                }} />

              <Input label="Observações" value={a.obs}
                onChange={(v: string) => {
                  const copy = [...atividades];
                  copy[i].obs = v;
                  setAtividades(copy);
                }} />

            </div>
          ))}

          <button
            onClick={() =>
              setAtividades([...atividades, { atividade: "", empresa: "", status: "", obs: "" }])
            }
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg"
          >
            + Adicionar atividade
          </button>

        </Section>

        {/* ================= COMENTÁRIOS ================= */}
        <Section title="Comentários adicionais">
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            className="w-full h-32 border rounded-xl p-3 text-sm"
          />
        </Section>

        {/* ================= FOTOS ================= */}
        <Section title="Fotos">

          {fotos.map((f, i) => (
            <div key={i} className="relative space-y-2">

              <RemoveButton onClick={() => removeItem(setFotos, i, fotos)} />

              <label className="block">
                <div className="bg-[#80b02d] text-white text-center py-2 rounded-xl cursor-pointer">
                  Selecionar imagem
                </div>

                <input
                  type="file"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files && handleFoto(i, e.target.files[0])
                  }
                />
              </label>

              {f.preview && <img src={f.preview} className="rounded-xl" />}

              <Input label="Legenda" value={f.legenda}
                onChange={(v: string) => {
                  const copy = [...fotos];
                  copy[i].legenda = v;
                  setFotos(copy);
                }} />

            </div>
          ))}

          <button
            onClick={() =>
              setFotos([...fotos, { file: null, preview: "", legenda: "" }])
            }
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg"
          >
            + Adicionar mais fotos
          </button>

        </Section>

        {/* ================= ASSINATURAS ================= */}
        <Section title="Assinaturas">

          {assinaturas.map((a, i) => (
            <div key={i} className="relative space-y-2">

              {i !== 0 && (
                <RemoveButton onClick={() =>
                  removeItem(setAssinaturas, i, assinaturas)
                } />
              )}

              <Select
                label="Empresa"
                value={a.empresa}
                options={empresas}
                onChange={(v: string) => {
                  const copy = [...assinaturas];
                  copy[i].empresa = v;
                  setAssinaturas(copy);
                }}
              />

              {a.assinatura ? (

  <div className="space-y-2">
    <img src={a.assinatura} className="rounded-xl border" />

    <div className="text-xs text-green-600 font-semibold">
      Assinado ✔
    </div>

    <button
      onClick={() => setAssinaturaAberta(i)}
      className="text-xs text-blue-600 underline"
    >
      Refazer assinatura
    </button>
  </div>

) : assinaturaAberta === i ? (

  <div className="space-y-2">

    <SignaturePad
      onSave={(dataUrl) => {
        const copy = [...assinaturas];
        copy[i].assinatura = dataUrl;
        setAssinaturas(copy);
        setAssinaturaAberta(null);
      }}
    />

    <button
      onClick={() => setAssinaturaAberta(null)}
      className="w-full bg-gray-200 py-2 rounded-lg text-sm"
    >
      Cancelar
    </button>

  </div>

) : (

  <button
    onClick={() => setAssinaturaAberta(i)}
    className="w-full bg-[#80b02d] text-white py-2 rounded-lg text-sm"
  >
    Assinar
  </button>

)}

            </div>
          ))}

          <button
            onClick={() =>
              setAssinaturas([...assinaturas, { empresa: "" }])
            }
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg"
          >
            + Adicionar responsável
          </button>

                </Section>

        {/* BOTÕES FINAIS */}
        <div className="space-y-4 pt-4">

  <button
    onClick={salvarRascunho}
    className="w-full bg-white border-2 border-[#391e2a] text-[#391e2a] font-semibold py-3 rounded-xl shadow-sm"
  >
    Salvar rascunho
  </button>

  <button
    onClick={gerarPDF}
    className="w-full bg-[#80b02d] text-white font-semibold py-3 rounded-xl"
  >
    Finalizar e Gerar PDF
  </button>

</div>

        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
  <div ref={pdfRef} className="p-6 bg-white text-black">

    <h1 className="text-xl font-bold mb-2">Greensoil</h1>
    <h2 className="text-md mb-4">Relatório Diário de Obra</h2>

    <p><b>Projeto:</b> {projectName}</p>
    <p><b>Data:</b> {dataRelatorio}</p>
    <p><b>Início:</b> {inicio}</p>
    <p><b>Fim:</b> {fim}</p>

    <h3 className="mt-4 font-semibold">Atividades</h3>
    {atividades.map((a, i) => (
      <p key={i}>- {a.atividade} ({a.status})</p>
    ))}

    <h3 className="mt-4 font-semibold">Comentários</h3>
    <p>{comentarios}</p>

  </div>
</div>

      </div>
    </MobileShell>
  );
}

/* ================= COMPONENTES ================= */

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-0 right-0 bg-red-500 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center"
    >
      ✕
    </button>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-md border p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[#391e2a] uppercase border-b pb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Input({ label, value, onChange }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[38px] border rounded-lg px-3 text-sm bg-gray-50 focus:ring-2 focus:ring-[#80b02d]"
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[38px] border rounded-lg px-3 text-sm bg-gray-50 focus:ring-2 focus:ring-[#80b02d]"
      >
        <option value="">Selecionar</option>
        {options.map((o: string) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}