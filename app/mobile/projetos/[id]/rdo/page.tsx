"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MobileShell from "@/components/layout/MobileShell";

/* ================= TYPES ================= */

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
};

/* ================= CONSTANTES ================= */

const statusList = ["Concluído", "Não concluído"];

/* ================= PAGE ================= */

export default function RdoPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [projectName, setProjectName] = useState("");

  const [envolvidos, setEnvolvidos] = useState<Envolvido[]>([
    { empresa: "Greensoil", colaboradores: "", funcao: "" },
  ]);

  const [atividades, setAtividades] = useState<Atividade[]>([
    { atividade: "", empresa: "", status: "", obs: "" },
  ]);

  const [fotos, setFotos] = useState<Foto[]>([
    { file: null, preview: "", legenda: "" },
  ]);

  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([
    { empresa: "Greensoil" },
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

  /* ================= REMOVER ================= */

  const removeItem = (setter: any, index: number, list: any[]) => {
    const copy = [...list];
    copy.splice(index, 1);
    setter(copy);
  };

  /* ================= FUNÇÕES ================= */

  const empresas = envolvidos.map(e => e.empresa).filter(Boolean);

  function handleFoto(index: number, file: File) {
  const copy = [...fotos];
  copy[index].file = file;
  copy[index].preview = URL.createObjectURL(file);
  setFotos(copy);
}

  /* ================= UI ================= */

  return (
    <MobileShell
      title={projectName}
      subtitle="Relatório Diário de Obra"
      backHref={`/mobile/projetos/${projectId}`}
    >
      <div className="space-y-6">

        {/* ================= ENVOLVIDOS ================= */}
        <Section title="Envolvidos">

          {envolvidos.map((e, i) => (
            <div key={i} className="relative grid grid-cols-3 gap-2">

              {i !== 0 && (
                <RemoveButton onClick={() =>
                  removeItem(setEnvolvidos, i, envolvidos)
                } />
              )}

              <Input
                label="Empresa"
                value={e.empresa}
                onChange={(v: string) => {
                  const copy = [...envolvidos];
                  copy[i].empresa = v;
                  setEnvolvidos(copy);
                }}
              />

              <Input
                label="N°"
                value={e.colaboradores}
                onChange={(v: string) => {
                  const copy = [...envolvidos];
                  copy[i].colaboradores = v;
                  setEnvolvidos(copy);
                }}
              />

              <Input
                label="Função"
                value={e.funcao}
                onChange={(v: string) => {
                  const copy = [...envolvidos];
                  copy[i].funcao = v;
                  setEnvolvidos(copy);
                }}
              />

            </div>
          ))}

          <button
            onClick={() =>
              setEnvolvidos([
                ...envolvidos,
                { empresa: "", colaboradores: "", funcao: "" },
              ])
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

              <RemoveButton onClick={() =>
                removeItem(setAtividades, i, atividades)
              } />

              <Input
                label="Atividade"
                value={a.atividade}
                onChange={(v: string) => {
                  const copy = [...atividades];
                  copy[i].atividade = v;
                  setAtividades(copy);
                }}
              />

              <Select
                label="Empresa"
                value={a.empresa}
                options={empresas}
                onChange={(v: string) => {
                  const copy = [...atividades];
                  copy[i].empresa = v;
                  setAtividades(copy);
                }}
              />

              <Select
                label="Status"
                value={a.status}
                options={statusList}
                onChange={(v: string) => {
                  const copy = [...atividades];
                  copy[i].status = v;
                  setAtividades(copy);
                }}
              />

              <Input
                label="Observações"
                value={a.obs}
                onChange={(v: string) => {
                  const copy = [...atividades];
                  copy[i].obs = v;
                  setAtividades(copy);
                }}
              />

            </div>
          ))}

          <button
            onClick={() =>
              setAtividades([
                ...atividades,
                { atividade: "", empresa: "", status: "", obs: "" },
              ])
            }
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg"
          >
            + Adicionar atividade
          </button>

        </Section>

        {/* ================= FOTOS ================= */}
        <Section title="Fotos">

          {fotos.map((f, i) => (
            <div key={i} className="relative space-y-2">

              <RemoveButton onClick={() =>
                removeItem(setFotos, i, fotos)
              } />

              <label className="block">
                <div className="bg-[#80b02d] text-white text-center py-2 rounded-xl cursor-pointer">
                  Selecionar imagem
                </div>

                <input
                  type="file"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files &&
                    handleFoto(i, e.target.files[0])
                  }
                />
              </label>

              {f.preview && (
                <img src={f.preview} className="rounded-xl" />
              )}

              <Input
                label="Legenda"
                value={f.legenda}
                onChange={(v: string) => {
                  const copy = [...fotos];
                  copy[i].legenda = v;
                  setFotos(copy);
                }}
              />

            </div>
          ))}

          <button
            onClick={() =>
              setFotos([
                ...fotos,
                { file: null, preview: "", legenda: "" },
              ])
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

              <div className="h-20 border rounded-xl flex items-center justify-center text-gray-400">
                Área de assinatura (próximo passo)
              </div>

            </div>
          ))}

          <button
            onClick={() =>
              setAssinaturas([
                ...assinaturas,
                { empresa: "" },
              ])
            }
            className="w-full bg-[#391e2a] text-white py-2 rounded-lg"
          >
            + Adicionar responsável
          </button>

        </Section>

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