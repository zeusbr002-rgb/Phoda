"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { Search, Plus, X, Leaf, History, LocateFixed, LogOut, Calendar as CalendarIcon, Download, Edit2, Trash2, Camera } from "lucide-react";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const containerStyle = { width: "100vw", height: "100vh" };
const unbCenter = { lat: -15.7624, lng: -47.8664 };
const iconMorta = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2236%22%20viewBox%3D%220%200%2024%2036%22%3E%3Cpath%20fill%3D%22%23000000%22%20stroke%3D%22%23FFFFFF%22%20stroke-width%3D%222%22%20d%3D%22M12%200C5.373%200%200%205.373%200%2012c0%208.542%2012%2024%2012%2024s12-15.458%2012-24c0-6.627-5.373-12-12-12z%22%2F%3E%3Ccircle%20fill%3D%22%23FFFFFF%22%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%224%22%2F%3E%3C%2Fsvg%3E';

// Ícone dinâmico azul (Estilo Radar do Google Maps)
const iconUsuario = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2212%22%20fill%3D%22%234285F4%22%20opacity%3D%220.3%22%2F%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%226%22%20fill%3D%22%234285F4%22%20stroke%3D%22%23FFFFFF%22%20stroke-width%3D%222%22%2F%3E%3C%2Fsvg%3E';

export default function MapaScreen() {
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/");
    });
    return () => unsubscribe();
  }, [router]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"REGISTRO" | "EDITAR">("REGISTRO");
  const [loading, setLoading] = useState(false);
  
  const [mapCenter, setMapCenter] = useState(unbCenter);
  const [arvores, setArvores] = useState<any[]>([]);
  const [historicoGlobal, setHistoricoGlobal] = useState<any[]>([]);
  const [novaLocalizacao, setNovaLocalizacao] = useState<{lat: number, lng: number} | null>(null);
  const [arvoreSelecionada, setArvoreSelecionada] = useState<any | null>(null);
  
  // ESTADOS DO NOVO RASTREAMENTO CONTÍNUO
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [mapaInicializado, setMapaInicializado] = useState(false);

  const [termoPesquisa, setTermoPesquisa] = useState("");
  const [dataInicio, setDataInicio] = useState(""); 
  const [dataFim, setDataFim] = useState(""); 

  const [especie, setEspecie] = useState(""); 
  const [nomeCientifico, setNomeCientifico] = useState("");
  const [origem, setOrigem] = useState("Nativa");
  const [estadoSanitario, setEstadoSanitario] = useState("Bom");
  const [setor, setSetor] = useState("");
  
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: "AIzaSyBCjSPO0l2BDUCeNmBsWH05kIs21gJtGk4", 
  });

  // EFEITO DE RASTREAMENTO (Fica monitorando os passos da pessoa)
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const precisao = position.coords.accuracy;

          // Atualiza a bolinha azul se a precisão estiver razoável
          if (precisao <= 40) {
            setUserLocation({ lat, lng });

            // Se for a primeira vez que acha o sinal, joga a câmera para a pessoa
            if (!mapaInicializado) {
              setMapCenter({ lat, lng });
              setMapaInicializado(true);
            }
          }
        },
        (erro) => console.log("Aguardando sinal GPS...", erro),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );

      // Limpa o rastreador ao fechar o app
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [mapaInicializado]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "arvores"), (snapshot) => {
      setArvores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "historico_servicos"), (snapshot) => {
      setHistoricoGlobal(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const arvoresFiltradas = arvores.filter(arvore => {
    const matchPesquisa = termoPesquisa === "" || arvore.especie?.toLowerCase().includes(termoPesquisa.toLowerCase());
    let matchData = true;
    if (dataInicio || dataFim) {
      const temServicoNoPeriodo = historicoGlobal.some(servico => {
        if (!servico.dataExecucao || servico.arvoreId !== arvore.id) return false;
        const d = servico.dataExecucao.toDate();
        const formatada = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        if (dataInicio && dataFim) return formatada >= dataInicio && formatada <= dataFim;
        if (dataInicio) return formatada === dataInicio;
        if (dataFim) return formatada === dataFim;
        return false;
      });
      matchData = temServicoNoPeriodo;
    }
    return matchPesquisa && matchData;
  });

  const gerarRelatorioPDF = () => {
    if (!dataInicio && !dataFim) {
      alert("Por favor, selecione ao menos uma data no filtro superior para gerar o relatório.");
      return;
    }
    const servicosDoPeriodo = historicoGlobal.filter(servico => {
      if (!servico.dataExecucao) return false;
      const d = servico.dataExecucao.toDate();
      const formatada = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dataInicio && dataFim) return formatada >= dataInicio && formatada <= dataFim;
      if (dataInicio) return formatada === dataInicio;
      if (dataFim) return formatada === dataFim;
      return false;
    });

    if (servicosDoPeriodo.length === 0) {
      alert("Nenhum serviço foi registrado no período selecionado.");
      return;
    }

    const doc = new jsPDF('landscape'); 
    let textoData = dataInicio && dataFim && dataInicio !== dataFim ? `${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}` : (dataInicio || dataFim).split('-').reverse().join('/');
    doc.setFontSize(16);
    doc.text(`Relatório de Execução de Serviços - Período: ${textoData}`, 14, 15);

    const linhasTabela = servicosDoPeriodo.map((servico, index) => {
      const arvore = arvores.find(a => a.id === servico.arvoreId) || {};
      return [
        index + 1, arvore.setor || "-", arvore.especie || "-", arvore.nomeCientifico || "-", arvore.origem || "-",
        servico.tipoServico || "-", servico.objetivoPoda || "-", servico.tipoPoda || "-",
        (servico.conflitos || []).join(", ") || "-", servico.dap || "-", servico.detalhes || servico.motivoQueda || "-",
        arvore.localizacao?.lat?.toFixed(6) || "-", arvore.localizacao?.lng?.toFixed(6) || "-"
      ];
    });

    autoTable(doc, { head: [['Ponto', 'Setor', 'Nome comum', 'Nome Científico', 'Origem', 'Serviço', 'Objetivo', 'Tipo Poda', 'Conflito', 'DAP', 'Motivo detalhado', 'Latitude', 'Longitude']], body: linhasTabela, startY: 22, styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [5, 150, 105], textColor: 255 }, alternateRowStyles: { fillColor: [240, 253, 244] } });
    doc.save(`Relatorio_Servicos_${textoData.replace(/ /g, '_').replace(/\//g, '-')}.pdf`);
  };

  const getIconUrl = (estado: string) => {
    if (estado === "Morta") return iconMorta;
    if (estado === "Ruim") return "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
    if (estado === "Regular") return "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
    return "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
  };

  // BOTÃO DA MIRA: Agora usa a localização já salva pelo radar, tornando o clique instantâneo
  const buscarMinhaLocalizacao = () => {
    if (userLocation) {
      setMapCenter(userLocation);
      setNovaLocalizacao(userLocation);
      setArvoreSelecionada(null);
      setDrawerMode("REGISTRO");
      setIsMenuOpen(true);
      resetarFormulario();
    } else {
      alert("Aguardando satélite encontrar sua posição. Tente andar um pouco ou aguarde alguns segundos.");
    }
  };

  const handleLogout = async () => await signOut(auth);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setNovaLocalizacao({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      setArvoreSelecionada(null); setDrawerMode("REGISTRO"); setIsMenuOpen(true);
      resetarFormulario();
    }
  };

  // FUNÇÃO DE SALVAR AO ARRASTAR O PINO
  const handleArrastarArvore = async (e: google.maps.MapMouseEvent, id: string) => {
    if (e.latLng) {
      const novaLat = e.latLng.lat();
      const novaLng = e.latLng.lng();
      try {
        await updateDoc(doc(db, "arvores", id), {
          localizacao: { lat: novaLat, lng: novaLng }
        });
      } catch (error) {
        alert("Erro ao reposicionar a árvore no banco de dados.");
      }
    }
  };

  const resetarFormulario = () => {
    setEspecie(""); setNomeCientifico(""); setOrigem("Nativa"); setEstadoSanitario("Bom"); setSetor(""); setFotoUrl("");
  };

  const fecharMenu = () => { setIsMenuOpen(false); setNovaLocalizacao(null); };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch("https://api.imgbb.com/1/upload?key=d13032e91594a9d0b158de4f6c5245b2", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) setFotoUrl(data.data.url);
      else alert("Erro ao enviar foto.");
    } catch (error) { alert("Erro na conexão com o servidor."); } finally { setUploadingFoto(false); }
  };

  const handleSalvarArvore = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (drawerMode === "EDITAR" && arvoreSelecionada) {
        await updateDoc(doc(db, "arvores", arvoreSelecionada.id), { especie, nomeCientifico, origem, estadoSanitario, setor, fotoUrl });
      } else {
        await addDoc(collection(db, "arvores"), { especie, nomeCientifico, origem, estadoSanitario, setor, fotoUrl, dataRegistro: new Date(), localizacao: novaLocalizacao || unbCenter });
      }
      resetarFormulario(); 
      setArvoreSelecionada(null); fecharMenu();
    } catch (error) { alert("Erro ao salvar."); } finally { setLoading(false); }
  };

  const handleExcluirArvore = async () => {
    if (!arvoreSelecionada) return;
    if (window.confirm(`Excluir a árvore ${arvoreSelecionada.especie}?`)) {
      try { await deleteDoc(doc(db, "arvores", arvoreSelecionada.id)); setArvoreSelecionada(null); alert("Árvore excluída."); } 
      catch (error) { alert("Erro ao excluir."); }
    }
  };

  const abrirPainelEditar = () => {
    if (!arvoreSelecionada) return;
    setEspecie(arvoreSelecionada.especie || ""); setNomeCientifico(arvoreSelecionada.nomeCientifico || ""); setOrigem(arvoreSelecionada.origem || "Nativa");
    setEstadoSanitario(arvoreSelecionada.estadoSanitario || "Bom"); setSetor(arvoreSelecionada.setor || ""); setFotoUrl(arvoreSelecionada.fotoUrl || "");
    setDrawerMode("EDITAR"); setIsMenuOpen(true);
  };

  if (!isLoaded) return <div className="flex items-center justify-center min-h-screen bg-emerald-50 text-emerald-800">Carregando satélite...</div>;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
        <button onClick={() => { setDrawerMode("REGISTRO"); resetarFormulario(); setIsMenuOpen(true); }} className="bg-emerald-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:bg-emerald-700 transition-all transform hover:scale-105">
          <Plus size={30} />
        </button>
        <button onClick={buscarMinhaLocalizacao} title="Capturar GPS e Registrar" className="bg-white text-blue-600 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:bg-gray-100 transition-all transform hover:scale-105">
          <LocateFixed size={26} />
        </button>
        <button onClick={handleLogout} className="bg-white/80 text-gray-500 w-10 h-10 rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all mt-4 ml-2">
          <LogOut size={18} />
        </button>
      </div>

      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 w-11/12 max-w-5xl flex gap-3 items-center">
        <div className="relative flex-1 flex items-center hidden sm:flex">
          <input type="text" placeholder="Pesquisar..." value={termoPesquisa} onChange={(e) => setTermoPesquisa(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white rounded-xl shadow-2xl outline-none font-medium text-gray-700 h-[56px]" />
          <Search className="absolute left-3 text-emerald-600" size={20} />
        </div>
        
        <div className="bg-white rounded-xl shadow-2xl flex items-center px-3 py-2 h-[56px] space-x-2 flex-1 sm:flex-none justify-center">
          <CalendarIcon size={20} className="text-emerald-600 hidden md:block mr-1" />
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-bold uppercase leading-none mb-1">De</span>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-transparent border-none outline-none font-semibold text-gray-700 cursor-pointer text-sm w-[110px]" />
          </div>
          <div className="flex flex-col border-l border-gray-200 pl-2">
            <span className="text-[10px] text-gray-500 font-bold uppercase leading-none mb-1">Até</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-transparent border-none outline-none font-semibold text-gray-700 cursor-pointer text-sm w-[110px]" />
          </div>
        </div>

        <button onClick={gerarRelatorioPDF} title="Gerar Relatório em PDF do período" className="bg-blue-600 text-white rounded-xl shadow-2xl px-5 h-[56px] flex items-center justify-center hover:bg-blue-700 transition-colors gap-2 font-bold">
          <Download size={20} />
          <span className="hidden md:inline">Relatório</span>
        </button>
      </div>

      <GoogleMap mapContainerStyle={containerStyle} center={mapCenter} zoom={17} options={{ mapTypeId: "hybrid", disableDefaultUI: true, zoomControl: true, tilt: 45, draggableCursor: "crosshair" }} onClick={handleMapClick}>
        
        {/* RADAR DE LOCALIZAÇÃO DO USUÁRIO */}
        {userLocation && (
          <Marker position={userLocation} icon={{ url: iconUsuario }} zIndex={999} />
        )}

        {/* LISTAGEM DAS ÁRVORES NO BANCO */}
        {arvoresFiltradas.map((arvore) => (
          <Marker 
            key={arvore.id} 
            position={arvore.localizacao} 
            icon={{ url: getIconUrl(arvore.estadoSanitario) }} 
            onClick={() => setArvoreSelecionada(arvore)}
            draggable={true} // TORNA O PINO ARRASTÁVEL
            onDragEnd={(e) => handleArrastarArvore(e, arvore.id)} // SALVA A NOVA POSIÇÃO AO SOLTAR
          />
        ))}

        {arvoreSelecionada && (
          <InfoWindow position={arvoreSelecionada.localizacao} onCloseClick={() => setArvoreSelecionada(null)}>
            <div className="p-2 min-w-[200px]">
              {arvoreSelecionada.fotoUrl && (
                <div className="mb-3 w-full h-28 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <img src={arvoreSelecionada.fotoUrl} alt="Foto da árvore" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex justify-between items-start border-b border-emerald-100 pb-1 mb-2">
                <h3 className="font-bold text-lg text-emerald-800">{arvoreSelecionada.especie}</h3>
                <div className="flex gap-3 text-gray-400">
                  <button onClick={abrirPainelEditar} title="Editar" className="hover:text-emerald-600"><Edit2 size={18} /></button>
                  <button onClick={handleExcluirArvore} title="Excluir" className="hover:text-red-600"><Trash2 size={18} /></button>
                </div>
              </div>
              <p className="text-sm text-gray-700 italic mb-1">{arvoreSelecionada.nomeCientifico}</p>
              
              {arvoreSelecionada.setor && (
                <p className="text-sm text-gray-700 mb-1"><strong>Setor:</strong> {arvoreSelecionada.setor}</p>
              )}
              
              <p className="text-sm text-gray-700 mb-1"><strong>Origem:</strong> {arvoreSelecionada.origem}</p>
              <p className="text-sm text-gray-700 mb-4"><strong>Condição:</strong> <span className={`ml-1 font-bold ${arvoreSelecionada.estadoSanitario === 'Morta' ? 'text-black' : ''}`}>{arvoreSelecionada.estadoSanitario}</span></p>
              <button onClick={() => router.push(`/dashboard?id=${arvoreSelecionada.id}`)} className="w-full bg-blue-600 text-white text-sm font-bold py-2 rounded shadow hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center">
                <History size={16} /> Prontuário / Serviços
              </button>
            </div>
          </InfoWindow>
        )}
        
        {/* PINO DE NOVO REGISTRO */}
        {novaLocalizacao && drawerMode === "REGISTRO" && isMenuOpen && (<Marker position={novaLocalizacao} icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }} />)}
      </GoogleMap>

      <div className={`fixed top-0 right-0 h-full w-full md:w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-6 h-full flex flex-col overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-emerald-700">{drawerMode === "EDITAR" ? "Editar Registro" : "Novo Registro"}</h2>
            <button onClick={fecharMenu} className="text-gray-400 hover:text-gray-600"><X size={28} /></button>
          </div>
          <form onSubmit={handleSalvarArvore} className="flex-1 flex flex-col space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Foto da Árvore (Opcional)</label>
              <label className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${fotoUrl ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'}`}>
                {uploadingFoto ? (
                  <span className="font-medium text-sm text-gray-600">Enviando imagem...</span>
                ) : fotoUrl ? (
                  <span className="font-bold text-sm">✓ Foto Anexada (Clique para trocar)</span>
                ) : (
                  <>
                    <Camera size={20} />
                    <span className="font-medium text-sm">Abrir Câmera / Galeria</span>
                  </>
                )}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoUpload} disabled={uploadingFoto} />
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Qual é o setor?</label>
              <input type="text" value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex: ICC Norte, Reitoria..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none" required />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Comum</label>
              <input type="text" value={especie} onChange={(e) => setEspecie(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Científico</label>
              <input type="text" value={nomeCientifico} onChange={(e) => setNomeCientifico(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Origem</label>
              <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none">
                <option value="Nativa">Nativa</option>
                <option value="Exótica">Exótica</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Condição Fitossanitária</label>
              <select value={estadoSanitario} onChange={(e) => setEstadoSanitario(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none">
                <option value="Bom">Bom (Saudável)</option>
                <option value="Regular">Regular (Atenção)</option>
                <option value="Ruim">Ruim (Risco/Doente)</option>
                <option value="Morta">Morta (Suprimida)</option>
              </select>
            </div>
            <div className="mt-auto pt-6 pb-4">
              <button type="submit" disabled={loading || uploadingFoto} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {loading ? "Salvando..." : "Salvar no Banco"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}