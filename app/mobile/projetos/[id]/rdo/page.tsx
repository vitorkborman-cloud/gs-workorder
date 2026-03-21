"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MobileShell from "@/components/layout/MobileShell";

/* ========================= TYPES ========================= */

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
  assinatura: string | null;
};

/* ========================= CONSTANTES ========================= */

const tempos = ["Claro", "Chuva", "Tempestade"];
const condicoes = ["Praticável", "Não praticável"];
const statusList = ["Concluído", "Não concluído"];

/* ========================= PAGE ========================= */

export default function RdoPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [projectName, setProjectName] = useState("");

  /* ====== GERAL ====== */
  const [data, setData] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const [clima, setClima] = useState<Clima[]>([
    { periodo: "Manhã", tempo: "", condicao: "", razao: "" },
    { periodo: "Tarde", tempo: "", condicao: "", razao: "" },
    { periodo: "Noite", tempo: "", condicao: "", razao: "" },
  ]);

  /* ====== ENVOLVIDOS ====== */
  const [envolvidos, setEnvolvidos] = useState<Envolvido[]>([
    { empresa: "Greensoil", colaboradores: "", funcao: "" },
  ]);

  /* ====== ATIVIDADES ====== */
  const [atividades, setAtividades] = useState<Atividade[]>([
    { atividade: "", empresa: "", status: "", obs: "" },
  ]);

  /* ====== COMENTÁRIOS ====== */
  const [comentarios, setComentarios] = useState("");

  /* ====== FOTOS ====== */
  const [fotos, setFotos] = useState<Foto[]>([
    { file: null, preview: "", legenda: "" },
  ]);

  /* ====== ASSINATURAS ====== */
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([
    { empresa: "Greensoil", assinatura: null },
  ]);

  useEffect(() => {
    loadProject();
  }, []);

  async function loadProject() {
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    if (data) setProjectName(data.name);
  }

  /* ========================= FUNÇÕES ========================= */

  function updateClima(i: number, field: keyof Clima, value: string) {
    const copy = [...clima];
    (copy[i] as any)[field] = value;
    setClima(copy);
  }

  function addEnvolvido() {
    setEnvolvidos([
      ...envolvidos,
      { empresa: "", colaboradores: "", funcao: "" },
    ]);
  }

  function updateEnvolvido(i: number, field: keyof Envolvido, value: string) {
    const copy = [...envolvidos];
    (copy[i] as any)[field] = value;
    setEnvolvidos(copy);
  }

  function addAtividade() {
    setAtividades([
      ...atividades,
      { atividade: "", empresa: "", status: "", obs: "" },
    ]);
  }

  function updateAtividade(i: number, field: keyof Atividade, value: string) {
    const copy = [...atividades];
    (copy[i] as any)[field] = value;
    setAtividades(copy);
  }

  function addFoto() {
    setFotos([...fotos, { file: null, preview: "", legenda: "" }]);
  }

  function handleFoto(i: number, file: File) {
    const copy = [...fotos];
    copy[i].file = file;
    copy[i].preview = URL.createObjectURL(file);
    setFotos(copy);
  }

  function addAssinatura() {
    setAssinaturas([...assinaturas, { empresa: "", assinatura: null }]);
  }

  function updateAssinatura(i: number, empresa: string) {
    const copy = [...assinaturas];
    copy[i].empresa = empresa;
    setAssinaturas(copy);
  }

  /* ========================= UI ========================= */

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
            <Input label="Data *" value={data} onChange={setData} />
            <Input label="Hora início *" value={inicio} onChange={setInicio} />
          </div>

          <Input label="Hora término *" value={fim} onChange={setFim} />

          {/* TABELA CLIMA */}
          {clima.map((c, i) => (
            <div key={i} className="bg-gray-50 p-3 rounded-xl space-y-2">
              <div className="text-xs font-semibold">{c.periodo}</div>

              <Select label="Tempo" value={c.tempo} options={tempos}
                onChange={(v: string) => updateClima(i, "tempo", v)} />

              <Select label="Condição" value={c.condicao} options={condicoes}
                onChange={(v: string) => updateClima(i, "condicao", v)} />

              <Input label="Razão" value={c.razao}
                onChange={(v: string) => updateClima(i, "razao", v)} />
            </div>
          ))}

        </Section>

        {/* ================= ENVOLVIDOS ================= */}
        <Section title="Envolvidos">

          {envolvidos.map((e, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <Input label="Empresa" value={e.empresa}
                onChange={(v: string) => updateEnvolvido(i, "empresa", v)} />

              <Input label="N°" value={e.colaboradores}
                onChange={(v: string) => updateEnvolvido(i, "colaboradores", v)} />

              <Input label="Função" value={e.funcao}
                onChange={(v: string) => updateEnvolvido(i, "funcao", v)} />
            </div>
          ))}

          <button onClick={addEnvolvido}
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg">
            + Adicionar envolvidos
          </button>

        </Section>

        {/* ================= ATIVIDADES ================= */}
        <Section title="Atividades">

          {atividades.map((a, i) => (
            <div key={i} className="space-y-2 bg-gray-50 p-3 rounded-xl">

              <Input label="Atividade" value={a.atividade}
                onChange={(v: string) => updateAtividade(i, "atividade", v)} />

              <Select label="Empresa"
                value={a.empresa}
                options={envolvidos.map(e => e.empresa).filter(Boolean)}
                onChange={(v: string) => updateAtividade(i, "empresa", v)} />

              <Select label="Status"
                value={a.status}
                options={statusList}
                onChange={(v: string) => updateAtividade(i, "status", v)} />

              <Input label="Observações" value={a.obs}
                onChange={(v: string) => updateAtividade(i, "obs", v)} />

            </div>
          ))}

          <button onClick={addAtividade}
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg">
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
            <div key={i} className="space-y-2">

              <input
                type="file"
                onChange={(e) =>
                  e.target.files && handleFoto(i, e.target.files[0])
                }
              />

              {f.preview && (
                <img src={f.preview} className="rounded-xl" />
              )}

              <Input label="Legenda" value={f.legenda}
                onChange={(v: string) => {
                  const copy = [...fotos];
                  copy[i].legenda = v;
                  setFotos(copy);
                }} />

            </div>
          ))}

          <button onClick={addFoto}
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg">
            + Adicionar mais fotos
          </button>

        </Section>

        {/* ================= ASSINATURAS ================= */}
        <Section title="Assinaturas">

          {assinaturas.map((a, i) => (
            <div key={i} className="space-y-2">

              <Input label="Empresa"
                value={a.empresa}
                onChange={(v: string) => updateAssinatura(i, v)} />

              <div className="h-20 border rounded-xl flex items-center justify-center text-gray-400 text-sm">
                Área de assinatura (próximo passo)
              </div>

            </div>
          ))}

          <button onClick={addAssinatura}
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg">
            + Adicionar responsável
          </button>

        </Section>

      </div>
    </MobileShell>
  );
}

/* ================= COMPONENTES BASE ================= */

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