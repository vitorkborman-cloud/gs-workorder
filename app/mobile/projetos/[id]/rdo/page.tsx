"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import MobileShell from "@/components/layout/MobileShell";
import SignaturePad from "@/components/SignaturePad";

// Ícones simples em SVG para manter o código portátil
const Icons = {
  Calendar: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Photo: () => <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
  Loader: () => <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
};

/* ================= TYPES ================= */

type Clima = { periodo: string; tempo: string; condicao: string; razao: string; };
type Envolvido = { empresa: string; colaboradores: string; funcao: string; };
type Atividade = { atividade: string; empresa: string; status: string; obs: string; };

// Nova estrutura de Foto otimizada para Storage e Memória
type FotoMobile = {
  id: string; // ID único temporário
  previewUrl: string; // Blob URL temporária (leve)
  storagePath: string | null; // Caminho no Supabase Storage se já subiu
  legenda: string;
  file: File | null; // Arquivo comprimido pronto para upload
  status: "idle" | "uploading" | "success" | "error";
};

type Assinatura = { empresa: string; assinatura?: string; };

/* ================= CONSTANTES ================= */

const tempos = ["Claro", "Chuva", "Tempestade", "Nublado"];
const condicoes = ["Praticável", "Não praticável", "Parcial"];
const statusList = ["Concluído", "Em andamento", "Não iniciado", "Impedido"];

// Cores da Marca Greensoil
const colors = {
  purple: "#391e2a",
  green: "#80b02d",
};

/* ================= PAGE ================= */

export default function RdoPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados do Relatório
  const [draftId, setDraftId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Carregando...");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assinaturaAberta, setAssinaturaAberta] = useState<number | null>(null);

  // Dados do Formulário
  const [dataRelatorio, setDataRelatorio] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [clima, setClima] = useState<Clima[]>([
    { periodo: "Manhã", tempo: "", condicao: "", razao: "" },
    { periodo: "Tarde", tempo: "", condicao: "", razao: "" },
    { periodo: "Noite", tempo: "", condicao: "", razao: "" },
  ]);
  const [envolvidos, setEnvolvidos] = useState<Envolvido[]>([{ empresa: "Greensoil", colaboradores: "", funcao: "" }]);
  const [atividades, setAtividades] = useState<Atividade[]>([{ atividade: "", empresa: "", status: "", obs: "" }]);
  const [sheq, setSheq] = useState({ incidente: "Não", incidenteObs: "", vazamento: "Não", vazamentoObs: "" });
  const [comentarios, setComentarios] = useState("");
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([{ empresa: "Greensoil" }]);

  // 🔥 ESTADO DE FOTOS OTIMIZADO (SEM BASE64)
  const [fotos, setFotos] = useState<FotoMobile[]>([]);
  // Lista para rastrear fotos que precisam ser deletadas do storage ao salvar
  const [fotosParaDeletar, setFotosParaDeletar] = useState<string[]>([]);

  useEffect(() => {
    if (!projectId) return;
    initializeRDO();
  }, [projectId]);

  async function initializeRDO() {
    setLoading(true);
    try {
      await loadProject();
      await loadDraft();
    } finally {
      setLoading(false);
    }
  }

  async function loadProject() {
    const { data } = await supabase.from("projects").select("name").eq("id", projectId).single();
    if (data) setProjectName(data.name);
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
    if (data.clima) setClima(data.clima);
    if (data.envolvidos) setEnvolvidos(data.envolvidos);
    if (data.atividades) setAtividades(data.atividades);
    if (data.sheq) setSheq(data.sheq);
    setComentarios(data.comentarios || "");
    if (data.assinaturas) setAssinaturas(data.assinaturas);

    // Carregar fotos existentes do banco (salvas como storage paths)
    if (data.fotos && Array.isArray(data.fotos)) {
      const fotosExistentes: FotoMobile[] = data.fotos.map((f: any, index: number) => ({
        id: `existente_${index}`,
        storagePath: f.storagePath, // O banco salva o path
        legenda: f.legenda,
        // Gera URL pública para preview
        previewUrl: f.storagePath ? supabase.storage.from('rdo_photos').getPublicUrl(f.storagePath).data.publicUrl : "",
        file: null, // Sem arquivo para upload
        status: "success"
      }));
      setFotos(fotosExistentes);
    }
  }

  // ================= FOTOS: LÓGICA DE MEMÓRIA E UPLOAD =================

  // 1. Seleção e Compressão (Retorna Blob leve, não Base64)
  async function handleFileSelection(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const novosArquivos = Array.from(files);
    
    // Feedback visual imediato
    alert(`Processando e comprimindo ${novosArquivos.length} imagens...`);

    for (const file of novosArquivos) {
      try {
        const compressedBlob = await compressImageProcess(file);
        
        // Cria um objeto File a partir do Blob comprimido
        const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });

        const novaFoto: FotoMobile = {
          id: `new_${Date.now()}_${Math.random()}`,
          previewUrl: URL.createObjectURL(compressedFile), // URL temporária browser (leve)
          storagePath: null,
          legenda: "",
          file: compressedFile, // Mantém referência do arquivo para upload
          status: "idle",
        };

        setFotos(prev => [...prev, novaFoto]);
      } catch (error) {
        console.error("Erro ao processar imagem:", error);
      }
    }
    
    // Limpa o input para permitir selecionar as mesmas fotos
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Função Promissificada de Compressão (Canvas) -> Retorna Blob
  function compressImageProcess(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          // 🔥 Nível extremamente profissional: Resolução equilibrada
          const MAX_WIDTH = 1200; // Aumentado para melhor qualidade no PDF, mas ainda otimizado
          const scale = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // 🔥 Retorna Blob binário comprimido (Jpeg 0.7)
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Falha na compressão"));
          }, "image/jpeg", 0.7);
        };
      };
      reader.onerror = (e) => reject(e);
    });
  }

  // 2. Upload em lote para o Storage (Orquestração)
  async function uploadPendingPhotos(): Promise<{ storagePath: string, legenda: string }[]> {
    const fotosAtualizadas = [...fotos];
    const resultadosFinal: { storagePath: string, legenda: string }[] = [];

    for (let i = 0; i < fotosAtualizadas.length; i++) {
      const foto = fotosAtualizadas[i];

      // Se já tem path, é existente, só adiciona ao resultado
      if (foto.storagePath) {
        resultadosFinal.push({ storagePath: foto.storagePath, legenda: foto.legenda });
        continue;
      }

      // Se não tem arquivo, ignora (segurança)
      if (!foto.file) continue;

      // Inicia Upload visual
      updateFotoStatus(foto.id, "uploading");

      try {
        // 🔥 Nome único profissional: projeto/data/timestamp_nome
        const fileExt = foto.file.name.split('.').pop();
        const fileName = `${projectId}/${dataRelatorio || 'rascunho'}/${Date.now()}_${i}.${fileExt}`;
        
        // Upload para Bucket 'rdo_photos' (Necessário criar no Supabase)
        const { data, error } = await supabase.storage
          .from('rdo_photos')
          .upload(fileName, foto.file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        updateFotoStatus(foto.id, "success", data.path);
        resultadosFinal.push({ storagePath: data.path, legenda: foto.legenda });

      } catch (error) {
        console.error("Erro upload:", error);
        updateFotoStatus(foto.id, "error");
        throw new Error("Falha no upload de fotos. Rascunho salvo, mas fotos novas podem estar pendentes.");
      }
    }
    
    return resultadosFinal;
  }

  // Helper para atualizar status da foto na UI
  const updateFotoStatus = (id: string, status: FotoMobile["status"], path: string | null = null) => {
    setFotos(prev => prev.map(f => f.id === id ? { ...f, status, storagePath: path || f.storagePath } : f));
  };

  // 3. Deletar fotos removidas do Storage (Limpeza)
  async function deleteRemovedPhotosFromStorage() {
    if (fotosParaDeletar.length === 0) return;
    // Supabase permite deletar em lote enviando array de paths
    const { error } = await supabase.storage.from('rdo_photos').remove(fotosParaDeletar);
    if (error) console.error("Erro ao limpar storage:", error);
    else setFotosParaDeletar([]); // Limpa lista de exclusão
  }

  function removerFotoUI(index: number) {
    const foto = fotos[index];
    // Se a foto já estava salva no storage, adiciona à lista de exclusão física
    if (foto.storagePath) {
      setFotosParaDeletar(prev => [...prev, foto.storagePath!]);
    }
    // Se for Blob URL, libera memória
    if (foto.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(foto.previewUrl);
    }
    removeItem(setFotos, index, fotos);
  }

  // ================= SALVAR / FINALIZAR (ORQUESTRADO) =================

  async function handleSalvar(finalizar = false) {
    if (finalizar && !confirm("Deseja finalizar o RDO? Não será mais possível editar.")) return;
    
    setSaving(true);
    try {
      // 1. 🔥 Processo Crítico: Upload de fotos novas
      const fotosDataForDB = await uploadPendingPhotos();
      
      // 2. Limpeza física do storage
      await deleteRemovedPhotosFromStorage();

      // 3. Preparar dados para o banco (Banco salva o Path, não Base64)
      const rdoData = {
        project_id: projectId,
        data: dataRelatorio,
        inicio,
        fim,
        clima,
        envolvidos,
        atividades,
        sheq,
        comentarios,
        fotos: fotosDataForDB, // Array de {storagePath, legenda}
        assinaturas,
        draft: !finalizar,
      };

      let error;
      if (draftId) {
        const { error: upsError } = await supabase.from("rdo_reports").update(rdoData).eq("id", draftId);
        error = upsError;
      } else {
        const { data: newRdo, error: insError } = await supabase.from("rdo_reports").insert(rdoData).select("id").single();
        error = insError;
        if (newRdo) setDraftId(newRdo.id);
      }

      if (error) throw error;

      alert(finalizar ? "RDO Finalizado com sucesso!" : "Rascunho salvo com sucesso!");
      
      if (finalizar) router.push(`/mobile/projetos/${projectId}`);
      else await loadDraft(); // Recarrega para limpar arquivos da memória e pegar paths

     } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  /* ================= UI HELPERS ================= */

  const empresasOptions = envolvidos.map(e => e.empresa).filter(Boolean);
  if (empresasOptions.length === 0) empresasOptions.push("Greensoil");

  function removeItem(setter: any, index: number, list: any[]) {
    const copy = [...list];
    copy.splice(index, 1);
    setter(copy);
  }

  if (loading) return <MobileShell title="Carregando"><div className="p-10 text-center text-gray-500 animate-pulse">Carregando dados do relatório...</div></MobileShell>;

  /* ================= UI RENDER ================= */

  return (
    <MobileShell
      title={projectName}
      subtitle="Diário de Obra Digital"
      backHref={`/mobile/projetos/${projectId}`}
    >
      <div className="space-y-6 pb-20 bg-gray-50 -m-4 p-4 min-h-screen">

        {/* ================= INFORMAÇÕES GERAIS (Layout Cardizado) ================= */}
        <FormSection title="Logística e Período" icon={<Icons.Calendar />}>
          <InputMobile label="Data do Relatório *" type="date" value={dataRelatorio} onChange={setDataRelatorio} icon={<Icons.Calendar />} />
          <div className="grid grid-cols-2 gap-4">
            <InputMobile label="Hora Início *" type="time" value={inicio} onChange={setInicio} icon={<Icons.Clock />} />
            <InputMobile label="Hora Término *" type="time" value={fim} onChange={setFim} icon={<Icons.Clock />} />
          </div>
        </FormSection>

        {/* ================= CLIMA ================= */}
        <FormSection title="Condições Climáticas" icon={<Icons.Clock />}>
          <div className="space-y-4">
            {clima.map((c, i) => (
              <div key={i} className="border border-gray-100 p-4 rounded-2xl bg-gray-50/50">
                <div className="text-sm font-bold text-[#391e2a] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#80b02d]"></span>
                  Período: {c.periodo}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectMobile label="Tempo" value={c.tempo} options={tempos} onChange={(v: string) => { const copy = [...clima]; copy[i].tempo = v; setClima(copy); }} />
                  <SelectMobile label="Trabalhabilidade" value={c.condicao} options={condicoes} onChange={(v: string) => { const copy = [...clima]; copy[i].condicao = v; setClima(copy); }} />
                </div>
                {c.condicao === "Não praticável" && (
                  <div className="mt-3"><InputMobile label="Razão da paralisação" value={c.razao} onChange={(v: string) => { const copy = [...clima]; copy[i].razao = v; setClima(copy); }} placeholder="Ex: Chuva forte impossibilitou escavação" /></div>
                )}
              </div>
            ))}
          </div>
        </FormSection>

        {/* ================= ENVOLVIDOS ================= */}
        <FormSection title="Efetivo e Recursos Humanos" icon={<Icons.Check />}>
          <div className="space-y-4">
            {envolvidos.map((e, i) => (
              <div key={i} className="relative bg-white border border-gray-100 p-4 rounded-2xl shadow-inner">
                {i !== 0 && <RemoveButtonMobile onClick={() => removeItem(setEnvolvidos, i, envolvidos)} />}
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-4"><InputMobile label="Empresa" value={e.empresa} onChange={(v: string) => { const copy = [...envolvidos]; copy[i].empresa = v; setEnvolvidos(copy); }} /></div>
                  <div className="col-span-2"><InputMobile label="N° Colab." type="number" value={e.colaboradores} onChange={(v: string) => { const copy = [...envolvidos]; copy[i].colaboradores = v; setEnvolvidos(copy); }} /></div>
                  <div className="col-span-6"><InputMobile label="Função Principal" value={e.funcao} onChange={(v: string) => { const copy = [...envolvidos]; copy[i].funcao = v; setEnvolvidos(copy); }} placeholder="Ex: Operador de Escavadeira, Servente" /></div>
                </div>
              </div>
            ))}
            <AddButton label="Adicionar Empresa/Efetivo" onClick={() => setEnvolvidos([...envolvidos, { empresa: "", colaboradores: "", funcao: "" }])} />
          </div>
        </FormSection>

        {/* ================= ATIVIDADES (Layout Dinâmico com Cores) ================= */}
        <FormSection title="Relato de Atividades" icon={<Icons.Loader />}>
          <div className="space-y-4">
            {atividades.map((a, i) => {
              // 🔥 Nível Diretoria: Cor de borda baseada no status
              const statusColor = a.status === "Concluído" ? "border-l-green-500" : a.status === "Em andamento" ? "border-l-yellow-500" : a.status === "Impedido" ? "border-l-red-500" : "border-l-gray-300";
              
              return (
                <div key={i} className={`relative bg-white border border-gray-100 border-l-4 ${statusColor} p-4 rounded-xl shadow-sm space-y-3`}>
                  <RemoveButtonMobile onClick={() => removeItem(setAtividades, i, atividades)} />
                  <InputMobile label="Descrição da Atividade" value={a.atividade} onChange={(v: string) => { const copy = [...atividades]; copy[i].atividade = v; setAtividades(copy); }} placeholder="Ex: Escavação da valeta setor A" />
                  <div className="grid grid-cols-2 gap-3">
                    <SelectMobile label="Executante" value={a.empresa} options={empresasOptions} onChange={(v: string) => { const copy = [...atividades]; copy[i].empresa = v; setAtividades(copy); }} />
                    <SelectMobile label="Status" value={a.status} options={statusList} onChange={(v: string) => { const copy = [...atividades]; copy[i].status = v; setAtividades(copy); }} />
                  </div>
                  <InputMobile label="Observações Técnicas" value={a.obs} onChange={(v: string) => { const copy = [...atividades]; copy[i].obs = v; setAtividades(copy); }} placeholder="Opcional: Desvios, volumes, áreas..." />
                </div>
              );
             })}
            <AddButton label="Adicionar Nova Atividade" onClick={() => setAtividades([...atividades, { atividade: "", empresa: "", status: "", obs: "" }])} />
          </div>
        </FormSection>

        {/* ================= SHEQ (Segurança) ================= */}
        <FormSection title="Segurança e Meio Ambiente (SHEQ)" icon={<Icons.Check />}>
          <div className="space-y-4">
            <RadioGroupMobile label="Houve Incidente/Acidente?" value={sheq.incidente} onChange={(v: string) => setSheq({ ...sheq, incidente: v })} options={["Sim", "Não"]} />
            {sheq.incidente === "Sim" && <InputMobile label="Descrição do Incidente" value={sheq.incidenteObs} onChange={(v: string) => setSheq({ ...sheq, incidenteObs: v })} placeholder="Detalhe o ocorrido..." />}
            
            <div className="border-t border-gray-100 my-2"></div>

            <RadioGroupMobile label="Houve Vazamento/Impacto Ambiental?" value={sheq.vazamento} onChange={(v: string) => setSheq({ ...sheq, vazamento: v })} options={["Sim", "Não"]} />
            {sheq.vazamento === "Sim" && <InputMobile label="Descrição do Impacto" value={sheq.vazamentoObs} onChange={(v: string) => setSheq({ ...sheq, vazamentoObs: v })} placeholder="Detalhe o ocorrido e ações tomadas..." />}
          </div>
        </FormSection>

        {/* ================= COMENTÁRIOS ================= */}
        <FormSection title="Notas e Comentários Gerais" icon={<Icons.Photo />}>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Digite aqui observações relevantes não cobertas nas seções anteriores..."
            className="w-full h-28 border border-gray-200 rounded-xl p-4 text-sm bg-gray-50 focus:ring-2 focus:ring-[#80b02d] focus:bg-white transition"
          />
        </FormSection>

        {/* ================= FOTOS (Solução 10+ Fotos e Memória) ================= */}
        <FormSection title={`Evidências Fotográficas (${fotos.length})`} icon={<Icons.Photo />}>
          
          {/* 🔥 Grade Profissional de Fotos (2 colunas) */}
          <div className="grid grid-cols-2 gap-4">
            {fotos.map((f, i) => (
              <div key={f.id} className="relative group border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col">
                <RemoveButtonMobile onClick={() => removerFotoUI(i)} />
                
                <div className="aspect-video w-full bg-gray-100 flex items-center justify-center overflow-hidden relative">
                  {f.previewUrl ? (
                    <img src={f.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Icons.Photo />
                  )}

                  {/* 🔥 Feedback visual de Upload individual */}
                  {f.status === "uploading" && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-xs gap-2">
                      <Icons.Loader /> Subindo...
                    </div>
                  )}
                  {f.status === "success" && f.file && ( // Só mostra check em fotos que acabaram de subir
                    <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full p-1 shadow">
                      <Icons.Check />
                    </div>
                  )}
                  {f.status === "error" && (
                    <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-white text-xs text-center p-2">
                      Erro no upload. Tente salvar novamente.
                    </div>
                  )}
                </div>

                <div className="p-2 mt-auto border-t border-gray-100">
                  <input 
                    type="text"
                    value={f.legenda}
                    placeholder="Legenda da foto..."
                    onChange={(e) => { const copy = [...fotos]; copy[i].legenda = e.target.value; setFotos(copy); }}
                    className="w-full text-xs p-1.5 border rounded bg-gray-50 focus:ring-1 focus:ring-[#80b02d]"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Botão de Upload Escondido acionado pelo AddButton */}
          <input 
            type="file" 
            ref={fileInputRef} 
            multiple 
            accept="image/jpeg,image/png" 
            onChange={handleFileSelection} 
            className="hidden" 
          />
          <AddButton label="Anexar Fotos (Múltiplas)" icon={<Icons.Photo />} onClick={() => fileInputRef.current?.click()} />
          <p className="text-[10px] text-gray-400 text-center mt-1">Imagens são comprimidas automaticamente para economizar dados.</p>

        </FormSection>

        {/* ================= ASSINATURAS ================= */}
        <FormSection title="Validação e Encerramento" icon={<Icons.Check />}>
          <div className="space-y-4">
            {assinaturas.map((a, i) => (
              <div key={i} className="relative bg-gray-50 p-4 rounded-2xl border border-gray-100">
                {i !== 0 && <RemoveButtonMobile onClick={() => removeItem(setAssinaturas, i, assinaturas)} />}
                <SelectMobile label="Empresa Responsável" value={a.empresa} options={empresasOptions} onChange={(v: string) => { const copy = [...assinaturas]; copy[i].empresa = v; setAssinaturas(copy); }} />

                <div className="mt-3 bg-white p-2 rounded-xl border border-dashed border-gray-200 min-h-[100px] flex items-center justify-center">
                  {a.assinatura ? (
                    <div className="text-center w-full space-y-2">
                      <img src={a.assinatura} className="h-16 mx-auto" alt="Assinatura" />
                      <div className="text-[10px] text-green-600 font-bold flex items-center justify-center gap-1"><Icons.Check /> Assinado eletronicamente</div>
                      <button onClick={() => setAssinaturaAberta(i)} className="text-xs text-blue-600 underline">Refazer</button>
                    </div>
                  ) : assinaturaAberta === i ? (
                    <div className="w-full space-y-2">
                      {/* 🔥 SignaturePad adaptado para Mobile */}
                      <div className="border-2 border-purple-200 rounded-lg overflow-hidden bg-gray-50">
                        <SignaturePad onSave={(dataUrl: string) => { const copy = [...assinaturas]; copy[i].assinatura = dataUrl; setAssinaturas(copy); setAssinaturaAberta(null); }} />
                      </div>
                      <button onClick={() => setAssinaturaAberta(null)} className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg text-xs font-medium">Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setAssinaturaAberta(i)} className="flex items-center gap-2 bg-[#80b02d]/10 text-[#80b02d] px-5 py-2.5 rounded-full text-sm font-semibold tracking-tight shadow-sm active:scale-95 transition">
                      Tocar para Assinar
                    </button>
                  )}
                </div>
              </div>
            ))}
            <AddButton label="Adicionar Responsável/Cliente" onClick={() => setAssinaturas([...assinaturas, { empresa: "" }])} />
          </div>
        </FormSection>

        {/* ================= BARRA DE AÇÕES FIXA (Mobile First) ================= */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 border-t shadow-lg flex gap-3 z-40 max-w-md mx-auto">
          <button
            onClick={() => handleSalvar(false)}
            disabled={saving}
            className="flex-1 bg-white border-2 border-[#391e2a] text-[#391e2a] font-bold py-3.5 rounded-xl text-sm disabled:opacity-50 active:scale-95 transition flex items-center justify-center gap-2"
          >
            {saving ? <Icons.Loader /> : null}
            Salvar Rascunho
          </button>
          <button
            onClick={() => handleSalvar(true)}
            disabled={saving}
            className="flex-1 bg-[#80b02d] text-white font-bold py-3.5 rounded-xl text-sm shadow-md disabled:opacity-80 active:scale-95 transition flex items-center justify-center gap-2"
          >
            {saving ? <Icons.Loader /> : <Icons.Check />}
            Finalizar RDO
          </button>
        </div>

      </div>
    </MobileShell>
  );
}

/* ================= COMPONENTES DE UI ATUALIZADOS (EXTREMAMENTE PROFISSIONAIS) ================= */

// Botão flutuante de remoção moderno
function RemoveButtonMobile({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute -top-2 -right-2 bg-red-100 text-red-600 w-7 h-7 rounded-full text-xs flex items-center justify-center shadow-md border border-white z-10 active:scale-90 transition"
    >
      <Icons.Trash />
    </button>
  );
}

// Seção estilo "Card" com header elegante
function FormSection({ title, icon, children }: any) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 space-y-5 overflow-hidden">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-3 -mx-1">
        <div className="bg-[#391e2a]/5 text-[#391e2a] p-2.5 rounded-xl">
          {icon}
        </div>
        <h2 className="text-xs font-extrabold text-[#391e2a] uppercase tracking-wider">
          {title}
        </h2>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

// Input moderno com ícone e estados
function InputMobile({ label, value, onChange, icon, ...props }: any) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[11px] font-bold text-gray-500 ml-1 tracking-tight">{label}</label>
      <div className="relative flex items-center">
        {icon && <div className="absolute left-3.5 text-gray-400">{icon}</div>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-[46px] border border-gray-200 rounded-xl ${icon ? 'pl-10' : 'px-4'} pr-4 text-sm bg-white focus:ring-2 focus:ring-[#80b02d]/30 focus:border-[#80b02d] transition-all placeholder:text-gray-300 shadow-inner-sm`}
          {...props}
        />
      </div>
    </div>
  );
}

// Select moderno
function SelectMobile({ label, value, options, onChange }: any) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[11px] font-bold text-gray-500 ml-1 tracking-tight">{label}</label>
      <div className="relative flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-[46px] border border-gray-200 rounded-xl px-4 text-sm bg-white focus:ring-2 focus:ring-[#80b02d]/30 focus:border-[#80b02d] transition-all appearance-none shadow-inner-sm"
        >
          <option value="" className="text-gray-300">Selecionar...</option>
          {options.map((o: string) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <div className="absolute right-3.5 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    </div>
  );
}

// Radio Group estilo "Segmented Control" profissional
function RadioGroupMobile({ label, value, options, onChange }: any) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-bold text-gray-500 ml-1 tracking-tight">{label}</label>
      <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-1 shadow-inner-sm">
        {options.map((op: string) => {
          const isActive = value === op;
          // Cor especial para "Sim" em SHEQ
          const activeBg = op === "Sim" && isActive ? "bg-red-500 text-white" : isActive ? "bg-[#391e2a] text-white" : "text-gray-600 hover:bg-gray-100";
          
          return (
            <label key={op} className={`flex-1 text-center py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${activeBg} flex items-center justify-center gap-1.5`}>
              <input
                type="radio"
                value={op}
                checked={isActive}
                onChange={(e) => onChange(e.target.value)}
                className="hidden"
              />
              {isActive && <Icons.Check />}
              {op}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// Botão "Adicionar" secundário e elegante
function AddButton({ label, onClick, icon }: any) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white hover:bg-gray-50 text-[#391e2a] py-3 rounded-xl border border-gray-200 border-dashed text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-sm"
    >
      {icon || <Icons.Plus />}
      {label}
    </button>
  );
}