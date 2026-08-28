"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, onSnapshot, doc, getDoc, addDoc, query, where, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ArrowLeft, Plus, Leaf, ClipboardCheck, Calendar, Skull, Camera, Edit2, X } from "lucide-react";

const listaConflitos = [
  "Vias", "Estacionamento", "Prédios", "Calçadas", 
  "Rede Elétrica", "Vistas", "Iluminação", "Arborização"
];

function HistoricoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const arvoreId = searchParams.get("id");

  const [arvore, setArvore] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // CONTROLE DE EDIÇÃO
  const [modoEdicao, setModoEdicao] = useState(false);
  const [servicoEditandoId, setServicoEditandoId] = useState<string | null>(null);

  const [tipoServico, setTipoServico] = useState("Poda");
  const [objetivoPoda, setObjetivoPoda] = useState("");
  const [tipoPoda, setTipoPoda] = useState("");
  const [motivoQueda, setMotivoQueda] = useState("");
  const [dap, setDap] = useState("");
  const [conflitos, setConflitos] = useState<string[]>([]);
  const [equipe, setEquipe] = useState("");
  const [equipamentos, setEquipamentos] = useState("");
  const [detalhes, setDetalhes] = useState("");

  const [fotoAntes, setFotoAntes] = useState("");
  const [fotoDepois, setFotoDepois] = useState("");
  const [uploadingAntes, setUploadingAntes] = useState(false);
  const [uploadingDepois, setUploadingDepois] = useState(false);

  useEffect(() => {
    if (!arvoreId) return;
    const fetchArvore = async () => {
      const docSnap = await getDoc(doc(db, "arvores", arvoreId));
      if (docSnap.exists()) setArvore({ id: docSnap.id, ...docSnap.data() });
      else router.push("/mapa");
    };
    fetchArvore();
  }, [arvoreId, router]);

  useEffect(() => {
    if (!arvoreId) return;
    const q = query(collection(db, "historico_servicos"), where("arvoreId", "==", arvoreId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lista.sort((a: any, b: any) => b.dataExecucao?.toMillis() - a.dataExecucao?.toMillis());
      setHistorico(lista);
    });
    return () => unsubscribe();
  }, [arvoreId]);

  const toggleConflito = (nome: string) => {
    if (conflitos.includes(nome)) {
      setConflitos(conflitos.filter(c => c !== nome));
    } else {
      setConflitos([...conflitos, nome]);
    }
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, tipo: 'antes' | 'depois') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (tipo === 'antes') setUploadingAntes(true);
    else setUploadingDepois(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("https://api.imgbb.com/1/upload?key=d13032e91594a9d0b158de4f6c5245b2", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success) {
        if (tipo === 'antes') setFotoAntes(data.data.url);
        else setFotoDepois(data.data.url);
      } else {
        alert("Erro ao enviar foto: " + data.error.message);
      }
    } catch (error) {
      alert("Erro na conexão com o servidor de imagens.");
    } finally {
      if (tipo === 'antes') setUploadingAntes(false);
      else setUploadingDepois(false);
    }
  };

  // FUNÇÃO DE PREENCHER O FORMULÁRIO COM O SERVIÇO ANTIGO PARA EDITAR
  const abrirEdicao = (servico: any) => {
    setModoEdicao(true);
    setServicoEditandoId(servico.id);
    
    setTipoServico(servico.tipoServico || "Poda");
    setObjetivoPoda(servico.objetivoPoda || "");
    setTipoPoda(servico.tipoPoda || "");
    setMotivoQueda(servico.motivoQueda || "");
    setDap(servico.dap || "");
    setConflitos(servico.conflitos || []);
    setEquipe(servico.equipe || "");
    setEquipamentos(servico.equipamentos || "");
    setDetalhes(servico.detalhes || "");
    setFotoAntes(servico.fotoAntes || "");
    setFotoDepois(servico.fotoDepois || "");

    // Rola a página suavemente para o topo para a pessoa ver o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicao = () => {
    setModoEdicao(false);
    setServicoEditandoId(null);
    resetarFormulario();
  };

  const resetarFormulario = () => {
    setTipoServico("Poda"); setObjetivoPoda(""); setTipoPoda(""); setMotivoQueda(""); setDap(""); 
    setConflitos([]); setEquipe(""); setEquipamentos(""); setDetalhes(""); 
    setFotoAntes(""); setFotoDepois("");
  };

  const handleSalvarServico = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dadosServico = {
        tipoServico,
        objetivoPoda: tipoServico === "Poda" ? objetivoPoda : null,
        tipoPoda: tipoServico === "Poda" ? tipoPoda : null,
        motivoQueda: tipoServico === "Queda" ? motivoQueda : null,
        dap,
        conflitos,
        equipe,
        equipamentos,
        detalhes,
        fotoAntes,
        fotoDepois
      };

      if (modoEdicao && servicoEditandoId) {
        // ATUALIZANDO UM SERVIÇO EXISTENTE
        await updateDoc(doc(db, "historico_servicos", servicoEditandoId), dadosServico);
        alert("Serviço atualizado com sucesso!");
        setModoEdicao(false);
        setServicoEditandoId(null);
      } else {
        // CRIANDO UM SERVIÇO NOVO
        await addDoc(collection(db, "historico_servicos"), {
          ...dadosServico,
          arvoreId: arvoreId,
          dataExecucao: new Date()
        });
        
        if (tipoServico === "Supressão") {
          await updateDoc(doc(db, "arvores", arvoreId as string), { estadoSanitario: "Morta" });
          setArvore({...arvore, estadoSanitario: "Morta"});
          alert("Serviço registrado! A árvore foi marcada como Morta no mapa.");
        } else {
          alert("Serviço registrado com sucesso!");
        }
      }

      resetarFormulario();

    } catch (error) {
      console.error(error);
      alert("Erro ao salvar o serviço.");
    } finally {
      setLoading(false);
    }
  };

  if (!arvore) return <div className="min-h-screen flex items-center justify-center font-bold text-emerald-800">Carregando prontuário...</div>;

  return (
    <div className="min-h-screen bg-emerald-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-start gap-4 mb-8">
          <button onClick={() => router.push('/mapa')} className="bg-white p-3 rounded-full shadow hover:bg-gray-50 text-emerald-700 mt-1">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-emerald-900 flex items-center gap-2">
              {arvore.estadoSanitario === "Morta" ? <Skull className="text-gray-800"/> : <Leaf className="text-emerald-600"/>} 
              Prontuário: {arvore.especie}
            </h1>
            <p className="text-emerald-700 font-medium mb-3">
              Condição: <span className={`font-bold ${arvore.estadoSanitario === "Morta" ? "text-red-600" : ""}`}>{arvore.estadoSanitario}</span>
            </p>
            {arvore.fotoUrl && (
              <div className="w-full md:w-64 h-40 bg-gray-200 rounded-xl overflow-hidden border-2 border-emerald-100 shadow-sm">
                <img src={arvore.fotoUrl} alt={`Foto de ${arvore.especie}`} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className={`lg:col-span-7 bg-white p-6 rounded-2xl shadow-lg border-t-4 ${modoEdicao ? 'border-amber-500' : 'border-blue-500'}`}>
            <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${modoEdicao ? 'text-amber-600' : 'text-gray-800'}`}>
              {modoEdicao ? <Edit2 size={20}/> : <Plus size={20} className="text-blue-500"/>} 
              {modoEdicao ? "Editando Registro de Serviço" : "Registrar Serviço Executado"}
            </h2>
            
            <form onSubmit={handleSalvarServico} className="flex flex-col gap-6">
              
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">1. Ação Executada</label>
                <div className="flex gap-4 flex-wrap">
                  {["Poda", "Queda", "Supressão"].map(tipo => (
                    <label key={tipo} className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100 hover:bg-blue-50 transition-colors">
                      <input type="radio" name="tipoServico" value={tipo} checked={tipoServico === tipo} onChange={(e) => setTipoServico(e.target.value)} className="w-5 h-5 text-blue-600"/>
                      <span className="font-bold text-gray-800">{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>

              {tipoServico === "Poda" && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Objetivo da Poda</label>
                    <div className="flex gap-4">
                      {["Preventiva", "Corretiva"].map(obj => (
                        <label key={obj} className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-blue-200">
                          <input type="radio" name="objetivo" value={obj} checked={objetivoPoda === obj} onChange={(e) => setObjetivoPoda(e.target.value)} required className="w-4 h-4"/>
                          <span className="text-sm font-medium text-gray-700">{obj}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Poda</label>
                    <select value={tipoPoda} onChange={(e) => setTipoPoda(e.target.value)} required className="w-full p-3 bg-white border border-blue-200 rounded-lg outline-none font-medium text-gray-700">
                      <option value="">Selecione o tipo...</option>
                      <option value="Limpeza">Limpeza</option>
                      <option value="Raleamento">Raleamento</option>
                      <option value="Levantamento">Levantamento</option>
                      <option value="Redução">Redução</option>
                      <option value="Emergencial">Emergencial</option>
                      <option value="Condução">Condução</option>
                    </select>
                  </div>
                </div>
              )}

              {tipoServico === "Queda" && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Motivo da Queda (Marcar)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["Ventania", "Chuva forte", "Risco estrutural", "Doença/Apodrecimento"].map(motivo => (
                      <label key={motivo} className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded border border-orange-200">
                        <input type="radio" name="motivoQueda" value={motivo} checked={motivoQueda === motivo} onChange={(e) => setMotivoQueda(e.target.value)} required className="w-4 h-4"/>
                        <span className="text-sm font-medium text-gray-700">{motivo}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">DAP (Diâmetro)</label>
                  <div className="flex flex-col gap-2">
                    {["< 40cm", "40cm a 75cm", "> 75cm"].map(medida => (
                      <label key={medida} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="dap" value={medida} checked={dap === medida} onChange={(e) => setDap(e.target.value)} required className="w-4 h-4"/>
                        <span className="text-sm text-gray-700">{medida}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Conflitos</label>
                  <div className="grid grid-cols-2 gap-2">
                    {listaConflitos.map(conflito => (
                      <label key={conflito} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={conflitos.includes(conflito)} onChange={() => toggleConflito(conflito)} className="w-4 h-4 text-blue-600 rounded"/>
                        <span className="text-sm text-gray-700">{conflito}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* CAMPOS DE TEXTO AGORA SÃO OPCIONAIS (sem o required) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Equipe / Responsável <span className="font-normal text-xs text-gray-400">(Opcional)</span></label>
                  <input type="text" value={equipe} onChange={(e) => setEquipe(e.target.value)} placeholder="Ex: João, Matrícula 123" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none"/>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Equipamentos Usados <span className="font-normal text-xs text-gray-400">(Opcional)</span></label>
                  <input type="text" value={equipamentos} onChange={(e) => setEquipamentos(e.target.value)} placeholder="Ex: Motosserra" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none"/>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Observações Finais <span className="font-normal text-xs text-gray-400">(Opcional)</span></label>
                <textarea value={detalhes} onChange={(e) => setDetalhes(e.target.value)} placeholder="Informações adicionais da execução..." className="w-full p-3 h-20 bg-gray-50 border border-gray-200 rounded-lg outline-none resize-none"/>
              </div>

              {/* SEÇÃO DE FOTOS (OPCIONAIS) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Foto: ANTES <span className="font-normal text-xs text-gray-400">(Opcional)</span></label>
                  <label className={`w-full flex flex-col items-center justify-center gap-2 p-3 h-28 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${fotoAntes ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'}`}>
                    {uploadingAntes ? (
                      <span className="font-medium text-sm text-gray-600">Enviando imagem...</span>
                    ) : fotoAntes ? (
                      <span className="font-bold text-sm text-center">✓ Antes Anexado<br/><span className="text-xs font-normal opacity-70">(Clique para trocar)</span></span>
                    ) : (
                      <>
                        <Camera size={28} />
                        <span className="font-medium text-sm text-center">Tirar Foto do Antes</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFotoUpload(e, 'antes')} disabled={uploadingAntes || uploadingDepois} />
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Foto: DEPOIS <span className="font-normal text-xs text-gray-400">(Opcional)</span></label>
                  <label className={`w-full flex flex-col items-center justify-center gap-2 p-3 h-28 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${fotoDepois ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'}`}>
                    {uploadingDepois ? (
                      <span className="font-medium text-sm text-gray-600">Enviando imagem...</span>
                    ) : fotoDepois ? (
                      <span className="font-bold text-sm text-center">✓ Depois Anexado<br/><span className="text-xs font-normal opacity-70">(Clique para trocar)</span></span>
                    ) : (
                      <>
                        <Camera size={28} />
                        <span className="font-medium text-sm text-center">Tirar Foto do Depois</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFotoUpload(e, 'depois')} disabled={uploadingAntes || uploadingDepois} />
                  </label>
                </div>
              </div>

              {/* BOTOES DE AÇÃO */}
              <div className="flex gap-3 mt-2">
                {modoEdicao && (
                  <button type="button" onClick={cancelarEdicao} className="w-1/3 bg-gray-200 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-300 transition-all text-lg">
                    Cancelar
                  </button>
                )}
                <button type="submit" disabled={loading || uploadingAntes || uploadingDepois} className={`flex-1 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl text-lg disabled:opacity-50 ${modoEdicao ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {loading ? "Salvando..." : (modoEdicao ? "Atualizar Serviço" : "Confirmar e Salvar Histórico")}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-lg border-t-4 border-emerald-500 h-fit max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 sticky top-0 bg-white pb-2 border-b border-gray-100 z-10">
              <ClipboardCheck size={24} className="text-emerald-500"/> Histórico de Intervenções
            </h2>
            
            <div className="flex flex-col gap-4">
              {historico.length === 0 ? (
                <div className="text-center text-gray-400 font-medium py-10 border-2 border-dashed border-gray-200 rounded-xl">Nenhum serviço registrado nesta árvore.</div>
              ) : (
                historico.map((servico) => (
                  <div key={servico.id} className="bg-gray-50 p-5 rounded-xl border border-gray-200 flex flex-col gap-3 shadow-sm relative group">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2 pr-8">
                      <span className={`font-extrabold uppercase tracking-wide px-2 py-1 rounded text-sm ${
                        servico.tipoServico === 'Supressão' ? 'bg-red-100 text-red-800' :
                        servico.tipoServico === 'Queda' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {servico.tipoServico}
                      </span>
                      <span className="text-xs font-bold text-gray-500">
                        {servico.dataExecucao?.toDate().toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>

                    {/* BOTÃO DE EDITAR NO CARD DO HISTÓRICO */}
                    <button onClick={() => abrirEdicao(servico)} title="Editar este serviço" className="absolute top-4 right-4 p-2 text-gray-400 hover:text-amber-600 bg-white rounded-full shadow-sm border border-gray-100 hover:border-amber-200 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    
                    <div className="text-sm text-gray-700 grid grid-cols-1 gap-1 mt-1">
                      {servico.tipoServico === "Poda" && <p><strong>Poda {servico.objetivoPoda}:</strong> {servico.tipoPoda}</p>}
                      {servico.tipoServico === "Queda" && <p><strong>Motivo da Queda:</strong> {servico.motivoQueda}</p>}
                      <p><strong>DAP:</strong> {servico.dap}</p>
                      {servico.equipe && <p><strong>Equipe:</strong> {servico.equipe}</p>}
                      {servico.equipamentos && <p><strong>Equipamentos:</strong> {servico.equipamentos}</p>}
                    </div>
                    
                    {servico.conflitos?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {servico.conflitos.map((c: string) => (
                          <span key={c} className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-semibold">{c}</span>
                        ))}
                      </div>
                    )}
                    
                    {servico.detalhes && <p className="text-sm text-gray-600 mt-2 bg-white p-2 rounded border border-gray-100 italic">"{servico.detalhes}"</p>}

                    {(servico.fotoAntes || servico.fotoDepois) && (
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-200">
                        {servico.fotoAntes && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider text-center">Antes</span>
                            <img src={servico.fotoAntes} alt="Foto do Antes" className="w-full h-28 object-cover rounded shadow-sm border border-gray-300" />
                          </div>
                        )}
                        {servico.fotoDepois && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider text-center">Depois</span>
                            <img src={servico.fotoDepois} alt="Foto do Depois" className="w-full h-28 object-cover rounded shadow-sm border border-gray-300" />
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function DashboardScreen() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold">Carregando...</div>}>
      <HistoricoContent />
    </Suspense>
  );
}