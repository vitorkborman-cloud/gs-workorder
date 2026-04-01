"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AdminShell from "../../../../../components/layout/AdminShell";
import { Button } from "../../../../../components/ui/button";

// Tipagem das camadas
type Layer = {
  de: string;
  ate: string;
  tipo: string;
  coloracao?: string;
  leitura_voc?: string;
};

const tiposSolo = [
  "Areia", "Areia fina", "Argila", "Aterro", "Britas", "Concreto", 
  "Rachão", "Silte", "Silte arenoso", "Silte argiloso"
  // ... (mantenha sua lista completa aqui)
];

export default function SoloDetailPage() {
  const params = useParams();
  const soloId = params.soloId as string;

  const [data, setData] = useState<any>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editLayers, setEditLayers] = useState<Layer[]>([]);

  async function load() {
    const { data } = await supabase.from("soil_descriptions").select("*").eq("id", soloId).single();
    if (data) {
      setData(data);
      setLayers((data.layers as Layer[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEditing() {
    setEditForm({ ...data });
    setEditLayers(layers.length > 0 ? JSON.parse(JSON.stringify(layers)) : [{ de: "", ate: "", tipo: "", coloracao: "", leitura_voc: "" }]);
    setIsEditing(true);
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("soil_descriptions")
        .update({ ...editForm, layers: editLayers })
        .eq("id", soloId);
      
      if (error) throw error;
      await load();
      setIsEditing(false);
    } catch (error) {
      alert("Erro ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange(field: string, value: string) {
    setEditForm((prev: any) => ({ ...prev, [field]: value }));
  }

  function handleLayerChange(index: number, field: keyof Layer, value: string) {
    const newLayers = [...editLayers];
    newLayers[index] = { ...newLayers[index], [field]: value };
    setEditLayers(newLayers);
  }

  // Função para chamar sua API de PDF ajustada anteriormente
  async function gerarPDF() {
    if (!data) return;
    try {
      const response = await fetch('/api/gerar-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, layers })
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Perfil_${data.nomenclatura_poco || data.nome_sondagem}.pdf`;
      link.click();
    } catch (error) {
      alert("Erro ao exportar PDF.");
    }
  }

  if (loading) return <AdminShell><p className="p-10 text-center text-gray-500">Carregando...</p></AdminShell>;

  return (
    <AdminShell>
      <div className="bg-gray-50 min-h-screen pb-12">
        
        {/* HEADER */}
        <div className="bg-[#391e2a] text-white px-10 py-8 shadow-md">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold">{isEditing ? "Modo Edição" : "Visualização do Perfil"}</h1>
              <p className="opacity-80 mt-1">ID: {data.nomenclatura_poco || data.nome_sondagem}</p>
            </div>
            
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <Button onClick={() => setIsEditing(false)} variant="outline" className="text-[#391e2a] bg-white font-bold h-12">Cancelar</Button>
                  <Button onClick={saveChanges} disabled={saving} className="bg-[#80b02d] text-white font-bold px-8 h-12">{saving ? "Salvando..." : "Salvar Alterações"}</Button>
                </>
              ) : (
                <>
                  <Button onClick={startEditing} className="bg-white/10 text-white font-bold h-12">Editar Perfil</Button>
                  <Button onClick={gerarPDF} className="bg-[#80b02d] text-white font-bold px-8 h-12">Baixar PDF</Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 px-6">
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* BLOCO 1: DADOS DA SONDAGEM */}
            <Section title="Dados da Sondagem">
              {isEditing ? (
                <div className="space-y-4">
                  {/* NOVO CAMPO: Nomenclatura */}
                  <EditInput label="Nomenclatura do Poço" value={editForm.nomenclatura_poco} onChange={(v) => handleFieldChange("nomenclatura_poco", v)} />
                  <EditInput label="ID Interno Sondagem" value={editForm.nome_sondagem} onChange={(v) => handleFieldChange("nome_sondagem", v)} />
                  <EditInput label="Método/Tipo" value={editForm.tipo_sondagem} onChange={(v) => handleFieldChange("tipo_sondagem", v)} />
                  <div className="grid grid-cols-2 gap-3">
                    <EditInput label="Data" type="date" value={editForm.data} onChange={(v) => handleFieldChange("data", v)} />
                    <EditInput label="Nível d'água (m)" type="number" value={editForm.nivel_agua} onChange={(v) => handleFieldChange("nivel_agua", v)} />
                  </div>
                </div>
              ) : (
                <Grid>
                  <Info label="Nomenclatura" value={data.nomenclatura_poco} />
                  <Info label="Sondagem" value={data.nome_sondagem} />
                  <Info label="Método" value={data.tipo_sondagem} />
                  <Info label="Data" value={data.data} />
                  <Info label="Nível d’água" value={data.nivel_agua ? `${data.nivel_agua} m` : "-"} />
                  <Info label="Prof. Total" value={`${data.profundidade_total} m`} />
                </Grid>
              )}
            </Section>

            {/* BLOCO 2: INSTALAÇÃO */}
            <Section title="Dados de Instalação">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <EditInput label="Ø Sondagem" value={editForm.diametro_sondagem} onChange={(v) => handleFieldChange("diametro_sondagem", v)} />
                    <EditInput label="Ø Poço" value={editForm.diametro_poco} onChange={(v) => handleFieldChange("diametro_poco", v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditInput label="Filtro Topo (m)" type="number" value={editForm.secao_filtrante_topo} onChange={(v) => handleFieldChange("secao_filtrante_topo", v)} />
                    <EditInput label="Filtro Base (m)" type="number" value={editForm.secao_filtrante_base} onChange={(v) => handleFieldChange("secao_filtrante_base", v)} />
                  </div>
                  <EditInput label="Pré-filtro (m)" type="number" value={editForm.pre_filtro} onChange={(v) => handleFieldChange("pre_filtro", v)} />
                </div>
              ) : (
                <Grid>
                  <Info label="Ø Sondagem" value={data.diametro_sondagem} />
                  <Info label="Ø Poço" value={data.diametro_poco} />
                  <Info label="Seção Filtrante" value={`${data.secao_filtrante_topo ?? "-"} a ${data.secao_filtrante_base ?? "-"} m`} />
                  <Info label="Pré-filtro" value={data.pre_filtro ? `${data.pre_filtro} m` : "-"} />
                </Grid>
              )}
            </Section>

            {/* BLOCO 3: GEOLOCALIZAÇÃO (UTM) */}
            <Section title="Geolocalização (UTM)">
              {isEditing ? (
                <div className="space-y-4">
                  <EditInput label="UTM Este (X)" value={editForm.coord_x} onChange={(v) => handleFieldChange("coord_x", v)} />
                  <EditInput label="UTM Norte (Y)" value={editForm.coord_y} onChange={(v) => handleFieldChange("coord_y", v)} />
                  <EditInput label="Zona (ex: 23S)" value={editForm.utm_zona} onChange={(v) => handleFieldChange("utm_zona", v)} />
                </div>
              ) : (
                <Grid>
                  <Info label="Este (X)" value={data.coord_x} />
                  <Info label="Norte (Y)" value={data.coord_y} />
                  <Info label="Zona" value={data.utm_zona} />
                </Grid>
              )}
            </Section>
          </div>

          {/* TABELA DE CAMADAS (mantenha a lógica de camadas que já existia) */}
          <div className="mt-8">
            <Section title="Camadas Estratigráficas">
               {/* ... lógica da tabela de camadas que você já tem ... */}
            </Section>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// === COMPONENTES DE SUPORTE ===
function Section({ title, children }: any) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 h-full">
      <h2 className="text-sm font-extrabold text-[#391e2a] uppercase tracking-wider mb-5">{title}</h2>
      {children}
    </div>
  );
}

function Grid({ children }: any) {
  return <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-sm">{children}</div>;
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold text-gray-400 tracking-wide uppercase mb-1">{label}</span>
      <span className="font-semibold text-gray-800">{value || "-"}</span>
    </div>
  );
}

function EditInput({ label, value, onChange, type = "text" }: { label: string, value: string, onChange: (v: string) => void, type?: string }) {
  return (
    <div className="flex flex-col">
      <label className="text-[11px] font-bold text-gray-400 tracking-wide uppercase mb-1">{label}</label>
      <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none" />
    </div>
  );
}