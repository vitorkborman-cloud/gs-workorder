"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../../components/layout/AdminShell";
import { isMobileDevice } from "../../../lib/isMobile";

type WorkOrder = { id: string; title: string; finalized: boolean; created_at: string; };
type Perfil = { id: string; nome_sondagem: string; nomenclatura_poco: string; created_at: string; };
type RDO = { id: string; data: string; created_at: string; };
type CampanhaFQ = { data: string; quantidade: number; };
type ProjectDoc = { id: string; name: string; file_url: string; file_type: string; file_size: number; created_at: string; };
type TelemetryDevice = { id: string; name: string; configuration_id: string; reference_id: string; status: string; last_reading: any; last_checked_at: string | null; };

function formatDateBr(d: string) {
  if (!d) return "Sem data";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, count, action }: { title: string; subtitle: string; count: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <h2 className="text-xl font-bold text-[#391e2a] tracking-tight flex items-center gap-2">
          {title}
          <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {count}
          </span>
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-3">
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p className="text-sm font-medium text-gray-400">{message}</p>
    </div>
  );
}

function DeleteBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-red-200 text-red-400 text-xs font-bold shadow-sm hover:bg-red-500 hover:text-white hover:border-red-500 opacity-0 group-hover:opacity-100 transition-all z-10 flex items-center justify-center"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProjetoPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [rdos, setRdos] = useState<RDO[]>([]);
  const [campanhasFQ, setCampanhasFQ] = useState<CampanhaFQ[]>([]);
  const [docs, setDocs] = useState<ProjectDoc[]>([]);
  const [telemetryDevices, setTelemetryDevices] = useState<TelemetryDevice[]>([]);
  const [loadingTelemetry, setLoadingTelemetry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setMobile(isMobileDevice());
    load();
  }, []);

  async function load() {
    const [{ data: wo }, { data: sd }, { data: rdoData }, { data: fqData }, { data: docsData }, { data: telData }] = await Promise.all([
      supabase.from("work_orders").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("soil_descriptions").select("id, nome_sondagem, nomenclatura_poco, created_at").eq("project_id", projectId).eq("finalized", true).order("created_at", { ascending: false }),
      supabase.from("rdo_reports").select("id, data, created_at").eq("project_id", projectId).eq("draft", false).order("created_at", { ascending: false }),
      supabase.from("water_samplings").select("id, data").eq("project_id", projectId).eq("finalized", true),
      supabase.from("project_documents").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("telemetry_devices").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);

    if (wo) setWorkOrders(wo);
    if (docsData) setDocs(docsData);
    if (sd) setPerfis(sd);
    if (rdoData) setRdos(rdoData);
    if (telData) setTelemetryDevices(telData);
    if (fqData) {
      const grouped = fqData.reduce((acc: any, curr: any) => { acc[curr.data] = (acc[curr.data] || 0) + 1; return acc; }, {});
      setCampanhasFQ(Object.keys(grouped).map(d => ({ data: d, quantidade: grouped[d] })).sort((a, b) => b.data.localeCompare(a.data)));
    }
    setLoading(false);
  }

  async function refreshTelemetry(device: TelemetryDevice) {
    setLoadingTelemetry(device.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        `telemetria?action=dados&configId=${device.configuration_id}`,
        { method: "GET" }
      );
      if (error) {
        const detail = await error.context?.json?.().catch(() => null);
        throw new Error(detail?.error || error.message);
      }

      await supabase
        .from("telemetry_devices")
        .update({ status: "online", last_reading: data, last_checked_at: new Date().toISOString() })
        .eq("id", device.id);
    } catch (err: any) {
      await supabase
        .from("telemetry_devices")
        .update({ status: "offline", last_checked_at: new Date().toISOString() })
        .eq("id", device.id);
      alert("Não foi possível buscar a leitura: " + (err.message || err));
    } finally {
      setLoadingTelemetry(null);
      load();
    }
  }

  async function createWorkOrder() {
    const title = prompt("Nome da Work Order:");
    if (!title) return;
    await supabase.from("work_orders").insert({ title, project_id: projectId });
    load();
  }

  async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${projectId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("project-documents").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("project-documents").getPublicUrl(path);
      await supabase.from("project_documents").insert({
        project_id: projectId,
        name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
      });
      load();
    } catch (err: any) {
      alert("Erro ao fazer upload: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function deleteDoc(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return;
    await supabase.from("project_documents").delete().eq("id", id);
    load();
  }

  function formatSize(bytes: number) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function deleteWorkOrder(id: string, title: string) {
    if (!confirm(`Excluir "${title}"?`)) return;
    await supabase.from("work_orders").delete().eq("id", id);
    load();
  }

  async function deletePerfil(id: string, nome: string) {
    if (!confirm(`Excluir o perfil "${nome}"?`)) return;
    await supabase.from("soil_descriptions").delete().eq("id", id);
    load();
  }

  async function deleteRDO(id: string, data: string) {
    if (!confirm(`Excluir RDO do dia ${data}?`)) return;
    await supabase.from("rdo_reports").delete().eq("id", id);
    load();
  }

  async function deleteFisicoQuimico(dataCampanha: string) {
    if (!confirm(`Excluir todas as amostragens do dia ${formatDateBr(dataCampanha)}?`)) return;
    await supabase.from("water_samplings").delete().eq("project_id", projectId).eq("data", dataCampanha);
    load();
  }

  if (loading) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse">Carregando projeto...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="space-y-10 max-w-7xl">

        {/* ── WORK ORDERS ── */}
        <section>
          <SectionHeader
            title="Work Orders"
            subtitle="Checklists de visitas e atividades de campo"
            count={workOrders.length}
            action={!mobile && (
              <button
                onClick={createWorkOrder}
                className="flex items-center gap-2 bg-[#80b02d] hover:bg-[#6c9526] text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all hover:-translate-y-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                Nova Work Order
              </button>
            )}
          />
          {workOrders.length === 0 ? <EmptyState message="Nenhum Work Order criado." /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {workOrders.map((wo) => (
                <div key={wo.id} className="relative group">
                  {!mobile && <DeleteBtn onClick={(e) => { e.stopPropagation(); deleteWorkOrder(wo.id, wo.title); }} />}
                  <button
                    onClick={() => router.push(`/work-orders/${wo.id}`)}
                    className="w-full text-left bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group/card"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-[#80b02d]/10 flex items-center justify-center text-[#80b02d] shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${wo.finalized ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {wo.finalized ? "Finalizada" : "Em andamento"}
                      </span>
                    </div>
                    <p className="font-bold text-[#391e2a] text-sm leading-snug">{wo.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(wo.created_at).toLocaleDateString("pt-BR")}</p>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="border-t border-gray-100" />

        {/* ── FÍSICO-QUÍMICOS ── */}
        <section>
          <SectionHeader title="Físico-Químicos" subtitle="Amostragens de água subterrânea" count={campanhasFQ.length} />
          {campanhasFQ.length === 0 ? <EmptyState message="Nenhuma amostragem recebida." /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {campanhasFQ.map((c) => (
                <div key={c.data} className="relative group">
                  {!mobile && <DeleteBtn onClick={(e) => { e.stopPropagation(); deleteFisicoQuimico(c.data); }} />}
                  <button
                    onClick={() => router.push(`/projetos/${projectId}/fisico-quimicos`)}
                    className="w-full text-left bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#2f7ea1]/10 flex items-center justify-center text-[#2f7ea1] mb-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </div>
                    <p className="font-bold text-[#391e2a] text-sm">Campanha FQ</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDateBr(c.data)}</p>
                    <div className="mt-3 inline-flex items-center gap-1 bg-[#2f7ea1]/10 text-[#2f7ea1] text-[10px] font-bold px-2 py-1 rounded-full">
                      {c.quantidade} {c.quantidade === 1 ? "poço" : "poços"} amostrado{c.quantidade !== 1 ? "s" : ""}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="border-t border-gray-100" />

        {/* ── PERFIS DESCRITIVOS ── */}
        <section>
          <SectionHeader title="Perfis Descritivos" subtitle="Perfis estratigráficos de sondagem" count={perfis.length} />
          {perfis.length === 0 ? <EmptyState message="Nenhum perfil gerado." /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {perfis.map((p) => (
                <div key={p.id} className="relative group">
                  <DeleteBtn onClick={(e) => { e.stopPropagation(); deletePerfil(p.id, p.nome_sondagem || p.nomenclatura_poco); }} />
                  <button
                    onClick={() => router.push(`/projetos/${projectId}/solo/${p.id}`)}
                    className="w-full text-left bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#391e2a]/10 flex items-center justify-center text-[#391e2a] mb-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <p className="font-bold text-[#391e2a] text-sm leading-snug">
                      {p.nomenclatura_poco || p.nome_sondagem || "Sem identificação"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {telemetryDevices.length > 0 && (
          <>
            <div className="border-t border-gray-100" />

            {/* ── TELEMETRIA ── */}
            <section>
              <div className="flex items-start justify-between gap-4 mb-4">
                <SectionHeader
                  title="Telemetria"
                  subtitle="Status e leituras em tempo real dos equipamentos (HI Tecnologia)"
                  count={telemetryDevices.length}
                />
                <button
                  onClick={async () => {
                    const { error } = await supabase.functions.invoke("test-push", { method: "POST" });
                    if (error) alert("Erro ao enviar teste: " + error.message);
                    else alert("Notificação de teste enviada! Verifique os celulares.");
                  }}
                  className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl border border-orange-300 text-orange-600 hover:bg-orange-50 transition"
                >
                  Testar push
                </button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {telemetryDevices.map((dev) => (
                  <div key={dev.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        dev.status === "online" ? "bg-green-100 text-green-700" :
                        dev.status === "offline" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {dev.status === "online" ? "● Online" : dev.status === "offline" ? "● Offline" : "— Sem dados"}
                      </span>
                    </div>
                    <p className="font-bold text-[#391e2a] text-sm">{dev.name}</p>
                    <p className="text-xs text-gray-400 mt-1">Config ID: {dev.configuration_id}</p>

                    {dev.last_reading && (
                      <pre className="mt-3 text-[10px] bg-gray-50 rounded-lg p-2 overflow-x-auto max-h-24 text-gray-600">
                        {JSON.stringify(dev.last_reading, null, 1)}
                      </pre>
                    )}

                    {dev.last_checked_at && (
                      <p className="text-[10px] text-gray-300 mt-2">
                        Última checagem: {new Date(dev.last_checked_at).toLocaleString("pt-BR")}
                      </p>
                    )}

                    <button
                      onClick={() => refreshTelemetry(dev)}
                      disabled={loadingTelemetry === dev.id}
                      className="mt-3 w-full text-xs font-bold py-2 rounded-xl bg-[#391e2a] text-white hover:bg-[#2a161f] transition disabled:opacity-50"
                    >
                      {loadingTelemetry === dev.id ? "Buscando..." : "Atualizar leitura"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="border-t border-gray-100" />

        {/* ── DOCUMENTOS ── */}
        <section>
          <SectionHeader
            title="Documentos"
            subtitle="Arquivos disponíveis para consulta em campo"
            count={docs.length}
            action={
              <label className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer ${uploading ? "bg-gray-200 text-gray-400" : "bg-indigo-500 hover:bg-indigo-600 text-white hover:-translate-y-0.5"}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {uploading ? "Enviando..." : "Anexar arquivo"}
                <input type="file" className="hidden" onChange={uploadDoc} disabled={uploading} />
              </label>
            }
          />

          {docs.length === 0 ? (
            <EmptyState message="Nenhum documento anexado ainda." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {docs.map((doc) => (
                <div key={doc.id} className="relative group">
                  <DeleteBtn onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id, doc.name); }} />
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 h-full"
                  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-3 shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="font-bold text-[#391e2a] text-sm leading-snug break-all flex-1">{doc.name}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="border-t border-gray-100" />

        {/* ── RDOS ── */}
        <section>
          <SectionHeader title="Relatórios Diários" subtitle="RDOs finalizados" count={rdos.length} />
          {rdos.length === 0 ? <EmptyState message="Nenhum relatório finalizado." /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rdos.map((r) => (
                <div key={r.id} className="relative group">
                  {!mobile && <DeleteBtn onClick={(e) => { e.stopPropagation(); deleteRDO(r.id, r.data || "Sem data"); }} />}
                  <button
                    onClick={() => router.push(`/projetos/${projectId}/rdo/${r.id}`)}
                    className="w-full text-left bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#4b5563]/10 flex items-center justify-center text-[#4b5563] mb-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                    </div>
                    <p className="font-bold text-[#391e2a] text-sm">RDO — {formatDateBr(r.data)}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
                    <div className="mt-3 inline-flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full">
                      ✓ Finalizado
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </AdminShell>
  );
}
