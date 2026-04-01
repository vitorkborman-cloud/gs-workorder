"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import AdminShell from "../../../../../components/layout/AdminShell";
import { Button } from "../../../../../components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Layer = {
  de: string;
  ate: string;
  tipo: string;
  coloracao?: string;
  leitura_voc?: string;
};

const tiposSolo = [
  "Areia", "Areia de granulação variada argilosa", "Areia de granulação variada pouco argilosa",
  "Areia de granulação variada pouco siltosa", "Areia de granulação variada silto argilosa",
  "Areia de granulação variada siltosa", "Areia de granulação variada muito argilosa",
  "Areia fina", "Areia fina argilosa", "Areia fina e média argilosa", "Areia fina e média pouco argilosa",
  "Areia fina e média pouco siltosa", "Areia fina e média silto argilosa", "Areia fina e média siltosa",
  "Areia fina e média muito argilosa", "Areia fina pouco argilosa", "Areia fina pouco siltosa",
  "Areia fina silto argilosa", "Areia fina siltosa", "Areia fina muito argilosa", "Areia grossa",
  "Areia grossa argilosa", "Areia grossa pouco argilosa", "Areia grossa pouco siltosa",
  "Areia grossa silto argilosa", "Areia grossa siltosa", "Areia grossa muito argilosa", "Areia média",
  "Argila", "Argila orgânica", "Argila plástica", "Argila silto arenosa", "Argila siltosa",
  "Argila siltosa pouco arenosa", "Argila siltosa muito arenosa", "Aterro", "Britas", "Concreto",
  "Rachão", "Silte", "Silte argilo arenoso", "Silte argiloso", "Silte areno argiloso",
  "Silte arenoso", "Silte muito arenoso"
];

export default function SoloDetailPage() {
  const params = useParams();
  const soloId = params.soloId as string;

  const [data, setData] = useState<any>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [loading, setLoading] = useState(true);

  // === ESTADOS DO MODO EDIÇÃO ===
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

  useEffect(() => {
    load();
  }, []);

  // === FUNÇÕES DE EDIÇÃO ===
  function startEditing() {
    setEditForm({ ...data });
    setEditLayers(layers.length > 0 ? JSON.parse(JSON.stringify(layers)) : [{ de: "", ate: "", tipo: "", coloracao: "", leitura_voc: "" }]);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("soil_descriptions")
        .update({ ...editForm, layers: editLayers })
        .eq("id", soloId);
      
      if (error) throw error;
      
      await load(); // Recarrega os dados novos do banco
      setIsEditing(false);
    } catch (error) {
      alert("Erro ao salvar alterações.");
      console.error(error);
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

  function addLayer() {
    setEditLayers([...editLayers, { de: "", ate: "", tipo: "", coloracao: "", leitura_voc: "" }]);
  }

  function removeLayer(index: number) {
    setEditLayers(editLayers.filter((_, i) => i !== index));
  }

  /* ================= CORES AUTOMÁTICAS E PDF ================= */
  function gerarCor(nome: string): [number, number, number] {
    const n = nome.toLowerCase();
    if (n.includes("concreto")) return [200, 200, 200];
    if (n.includes("rachão") || n.includes("rachao")) return [100, 100, 100];
    if (n.includes("brita")) return [140, 140, 140];
    if (n.includes("cascalho")) return [120, 120, 120];
    if (n.includes("argila")) {
      if (n.includes("silt")) return [220, 120, 120];
      if (n.includes("aren")) return [200, 70, 70];
      return [150, 40, 40];
    }
    if (n.includes("silte")) {
      if (n.includes("silt")) return [185, 120, 95];
      if (n.includes("aren")) return [200, 140, 90];
      return [170, 95, 70];
    }
    if (n.includes("areia")) {
      if (n.includes("fina")) return [235, 210, 140];
      if (n.includes("grossa")) return [220, 190, 110];
      return [230, 200, 120];
    }
    if (n.includes("orgânica") || n.includes("organica")) return [60, 60, 60];
    if (n.includes("turfa")) return [40, 40, 40];
    return [200, 180, 140];
  }

  async function gerarPDF() {
  if (!data) return;

  try {
    // Alerta opcional para avisar que está gerando (pode trocar por um estado de loading)
    console.log("Solicitando PDF para a API...");

    // 1. Chama a rota do nosso servidor Next.js
    const response = await fetch('/api/gerar-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, layers }) // Enviamos os dados e as camadas
    });

    if (!response.ok) throw new Error("Falha ao gerar o arquivo no servidor");

    // 2. Recebe o arquivo e força o download no navegador do usuário
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Perfil_${data.nome_sondagem}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error(error);
    alert("Erro ao exportar PDF.");
  }
}

  if (loading) return <AdminShell><p className="p-10 text-center text-gray-500">Carregando...</p></AdminShell>;
  if (!data) return <AdminShell><p className="p-10 text-center text-red-500">Perfil não encontrado.</p></AdminShell>;

  // ================= RENDERIZAÇÃO PRINCIPAL =================
  return (
    <AdminShell>
      <div className="bg-gray-50 min-h-screen pb-12">
        
        {/* HEADER */}
        <div className="bg-[#391e2a] text-white px-10 py-8 shadow-md transition-all">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold">{isEditing ? "Modo Edição" : "Visualização do Perfil"}</h1>
              <p className="opacity-80 mt-1">Sondagem: {data.nome_sondagem}</p>
            </div>
            
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <Button onClick={cancelEditing} variant="outline" className="text-[#391e2a] bg-white hover:bg-gray-100 font-bold px-6 h-12">
                    Cancelar
                  </Button>
                  <Button onClick={saveChanges} disabled={saving} className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold px-8 h-12 shadow-lg">
                    {saving ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={startEditing} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-6 h-12 backdrop-blur-sm">
                    Editar Perfil
                  </Button>
                  <Button onClick={gerarPDF} className="bg-[#80b02d] hover:bg-[#6c9526] text-white font-bold px-8 h-12 shadow-lg">
                    Baixar PDF
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* MODO EDIÇÃO VS MODO LEITURA */}
        <div className="max-w-6xl mx-auto mt-10 px-6">
          {isEditing ? (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="grid md:grid-cols-3 gap-6">
                
                <Section title="Dados da Sondagem">
                  <div className="space-y-4">
                    <EditInput label="Nomenclatura do poço" value={editForm.nomenclatura_poco} onChange={(v) => handleFieldChange("nomenclatura_poco", v)} />
                    <EditInput label="Sondagem" value={editForm.nome_sondagem} onChange={(v) => handleFieldChange("nome_sondagem", v)} />
                    <EditInput label="Tipo" value={editForm.tipo_sondagem} onChange={(v) => handleFieldChange("tipo_sondagem", v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <EditInput label="Data" type="date" value={editForm.data} onChange={(v) => handleFieldChange("data", v)} />
                      <EditInput label="Hora" type="time" value={editForm.hora} onChange={(v) => handleFieldChange("hora", v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <EditInput label="Nível d'água (m)" type="number" value={editForm.nivel_agua} onChange={(v) => handleFieldChange("nivel_agua", v)} />
                      <EditInput label="Prof. Total (m)" type="number" value={editForm.profundidade_total} onChange={(v) => handleFieldChange("profundidade_total", v)} />
                    </div>
                  </div>
                </Section>

                <Section title="Dados de Instalação">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <EditInput label="Ø Sondagem" value={editForm.diametro_sondagem} onChange={(v) => handleFieldChange("diametro_sondagem", v)} />
                      <EditInput label="Ø Poço" value={editForm.diametro_poco} onChange={(v) => handleFieldChange("diametro_poco", v)} />
                    </div>
                    <EditInput label="Pré-filtro (m)" type="number" value={editForm.pre_filtro} onChange={(v) => handleFieldChange("pre_filtro", v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <EditInput label="Filtro Topo (m)" type="number" value={editForm.secao_filtrante_topo} onChange={(v) => handleFieldChange("secao_filtrante_topo", v)} />
                      <EditInput label="Filtro Base (m)" type="number" value={editForm.secao_filtrante_base} onChange={(v) => handleFieldChange("secao_filtrante_base", v)} />
                    </div>
                  </div>
                </Section>

                <Section title="Geolocalização">
                  <div className="space-y-4">
                    <EditInput label="Coord. X" value={editForm.coord_x} onChange={(v) => handleFieldChange("coord_x", v)} />
                    <EditInput label="Coord. Y" value={editForm.coord_y} onChange={(v) => handleFieldChange("coord_y", v)} />
                  </div>
                </Section>
              </div>

              <Section title="Planilha de Camadas Estratigráficas">
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm border-collapse text-left bg-white">
                    <thead>
                      <tr className="bg-[#391e2a]/5 border-b border-gray-200">
                        <th className="p-3 font-bold text-[#391e2a] text-xs">De (m)</th>
                        <th className="p-3 font-bold text-[#391e2a] text-xs">Até (m)</th>
                        <th className="p-3 font-bold text-[#391e2a] text-xs w-[30%]">Tipo de Solo</th>
                        <th className="p-3 font-bold text-[#391e2a] text-xs">Observações</th>
                        <th className="p-3 font-bold text-[#391e2a] text-xs">VOC (ppm)</th>
                        <th className="p-3 font-bold text-[#391e2a] text-xs text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editLayers.map((layer, index) => (
                        <tr key={index} className="hover:bg-gray-50/50">
                          <td className="p-2"><input type="number" className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-[#80b02d]" value={layer.de} onChange={(e) => handleLayerChange(index, "de", e.target.value)} /></td>
                          <td className="p-2"><input type="number" className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-[#80b02d]" value={layer.ate} onChange={(e) => handleLayerChange(index, "ate", e.target.value)} /></td>
                          <td className="p-2">
                            <select className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-[#80b02d]" value={layer.tipo} onChange={(e) => handleLayerChange(index, "tipo", e.target.value)}>
                              <option value="">Selecione...</option>
                              {tiposSolo.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </td>
                          <td className="p-2"><input type="text" className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-[#80b02d]" value={layer.coloracao || ""} onChange={(e) => handleLayerChange(index, "coloracao", e.target.value)} /></td>
                          <td className="p-2"><input type="number" className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-[#80b02d]" value={layer.leitura_voc || ""} onChange={(e) => handleLayerChange(index, "leitura_voc", e.target.value)} /></td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeLayer(index)} className="text-red-400 hover:text-red-600 font-bold p-2 bg-red-50 rounded-md">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button onClick={addLayer} variant="outline" className="w-full mt-4 border-dashed border-2 text-[#391e2a] font-bold">
                  + Adicionar Nova Linha
                </Button>
              </Section>
            </div>
          ) : (
            // === MODO LEITURA (VISUALIZAÇÃO NORMAL) ===
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid md:grid-cols-3 gap-6">
                <Section title="Dados da Sondagem">
                  <Grid>
                    <Info label="Nomenclatura do poço" value={data.nomenclatura_poco} />
                    <Info label="Sondagem" value={data.nome_sondagem} />
                    <Info label="Tipo" value={data.tipo_sondagem} />
                    <Info label="Data" value={data.data} />
                    <Info label="Hora" value={data.hora} />
                    <Info label="Nível d’água" value={data.nivel_agua ? `${data.nivel_agua} m` : "-"} />
                    <Info label="Profundidade Total" value={`${data.profundidade_total} m`} />
                  </Grid>
                </Section>
                <Section title="Dados de Instalação">
                  <Grid>
                    <Info label="Ø Sondagem" value={data.diametro_sondagem} />
                    <Info label="Ø Poço" value={data.diametro_poco} />
                    <Info label="Pré-filtro" value={data.pre_filtro ? `${data.pre_filtro} m` : "-"} />
                    <Info label="Seção Filtrante" value={`${data.secao_filtrante_topo ?? "-"} a ${data.secao_filtrante_base ?? "-"} m`} />
                  </Grid>
                </Section>
                <Section title="Geolocalização">
                  <Grid>
                    <Info label="Coord. X" value={data.coord_x} />
                    <Info label="Coord. Y" value={data.coord_y} />
                  </Grid>
                </Section>
              </div>

              <Section title="Camadas Estratigráficas">
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm border-collapse text-left bg-white">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">De (m)</th>
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">Até (m)</th>
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">Tipo de Solo</th>
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">Observações</th>
                        <th className="p-4 font-bold text-gray-600 uppercase text-xs tracking-wider">VOC (ppm)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {layers.map((layer, index) => (
                        <tr key={index} className="hover:bg-gray-50/50 transition">
                          <td className="p-4 text-gray-700">{layer.de}</td>
                          <td className="p-4 text-gray-700">{layer.ate}</td>
                          <td className="p-4 font-medium text-[#391e2a]">{layer.tipo}</td>
                          <td className="p-4 text-gray-600">{layer.coloracao || "-"}</td>
                          <td className="p-4 text-[#80b02d] font-bold">{layer.leitura_voc || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

// === COMPONENTES DE UI COMPARTILHADOS ===

function Section({ title, children }: any) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 h-full">
      <h2 className="text-sm font-extrabold text-[#391e2a] uppercase tracking-wider mb-5">
        {title}
      </h2>
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

// Mini input interno para o modo de edição (Desktop friendly)
function EditInput({ label, value, onChange, type = "text" }: { label: string, value: string, onChange: (v: string) => void, type?: string }) {
  return (
    <div className="flex flex-col">
      <label className="text-[11px] font-bold text-gray-400 tracking-wide uppercase mb-1">{label}</label>
      <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#80b02d] outline-none" />
    </div>
  );
}