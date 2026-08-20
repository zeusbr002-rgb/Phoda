"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
// ADICIONEI O Trash2 (Lixeira) NA LINHA ABAIXO:
import { Search, Plus, X, Leaf, History, LocateFixed, LogOut, Calendar as CalendarIcon, Download, Edit2, Trash2 } from "lucide-react";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const containerStyle = { width: "100vw", height: "100vh" };
const unbCenter = { lat: -15.7624, lng: -47.8664 };
const iconMorta = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2236%22%20viewBox%3D%220%200%2024%2036%22%3E%3Cpath%20fill%3D%22%23000000%22%20stroke%3D%22%23FFFFFF%22%20stroke-width%3D%222%22%20d%3D%22M12%200C5.373%200%200%205.373%200%2012c0%208.542%2012%2024%2012%2024s12-15.458%2012-24c0-6.627-5.373-12-12-12z%22%2F%3E%3Ccircle%20fill%3D%22%23FFFFFF%22%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%224%22%2F%3E%3C%2Fsvg%3E';

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
  
  const [termoPesquisa, setTermoPesquisa] = useState("");
  const [dataFiltro, setDataFiltro] = useState(""); 

  const [especie, setEspecie] = useState(""); 
  const [nomeCientifico, setNomeCientifico] = useState("");
  const [origem, setOrigem] = useState("Nativa");
  const [estadoSanitario, setEstadoSanitario] = useState("Bom");

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    // COLE A SUA CHAVE VERDADEIRA AQUI EMBAIXO:
    googleMapsApiKey: "AIzaSyBCjSPO0l2BDUCeNmBsWH05kIs21gJtGk4", 
  });

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
    if (dataFiltro) {
      const temServicoNaData = historicoGlobal.some(servico => {
        if (!servico.dataExecucao || servico.arvoreId !== arvore.id) return false;
        
        const dataServico = servico.dataExecucao.toDate();
        const dia = String(dataServico.getDate()).padStart(2, '0');
        const mes = String(dataServico.getMonth() + 1).padStart(2, '0');
        const ano = dataServico.getFullYear();
        const dataFormatada = `${ano}-${mes}-${dia}`;
        
        return dataFormatada === dataFiltro;
      });
      matchData = temServicoNaData;
    }

    return matchPesquisa && matchData;
  });

  const gerarRelatorioPDF = () => {
    if (!dataFiltro) {
      alert("Por favor, selecione uma data no filtro superior para gerar o relatório.");
      return;
    }

    const servicosDoDia = historicoGlobal.filter(servico => {
      if (!servico.dataExecucao) return false;
      const d = servico.dataExecucao.toDate();
      const formatada = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return formatada === dataFiltro;
    });

    if (servicosDoDia.length === 0) {
      alert("Nenhum serviço foi registrado na data selecionada.");
      return;
    }

    const doc = new jsPDF('landscape'); 
    
    const dataBr = dataFiltro.split('-').reverse().join('/');
    doc.setFontSize(16);
    doc.text(`Relatório de Execução de Serviços - Data: ${dataBr}`, 14, 15);

    const linhasTabela = servicosDoDia.map((servico, index) => {
      const arvore = arvores.find(a => a.id === servico.arvoreId) || {};
      
      return [
        index + 1,
        arvore.especie || "-",
        arvore.nomeCientifico || "-",
        arvore.origem || "-",
        servico.tipoServico || "-",
        servico.objetivoPoda || "-",
        servico.tipoPoda || "-",
        (servico.conflitos || []).join(", ") || "-",
        servico.dap || "-",
        servico.detalhes || servico.motivoQueda || "-",
        arvore.localizacao?.lat?.toFixed(6) || "-",
        arvore.localizacao?.lng?.toFixed(6) || "-"
      ];
    });

    autoTable(doc, {
      head: [['Ponto', 'Nome comum', 'Nome Científico', 'Origem', 'Serviço', 'Objetivo', 'Tipo de Poda', 'Conflito', 'DAP', 'Motivo detalhado', 'Latitude', 'Longitude']],
      body: linhasTabela,
      startY: 22,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 244] },
    });

    doc.save(`Relatorio_Servicos_${dataFiltro}.pdf`);
  };

  const getIconUrl = (estado: string) => {
    if (estado === "Morta") return iconMorta;
    if (estado === "Ruim") return "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
    if (estado === "Regular") return "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
    return "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
  };

// NOVA LÓGICA DO BOTÃO GPS (Com Alta Precisão Ativada)
  const buscarMinhaLocalizacao = () => {
    if (navigator.geolocation) {
      // Adicionamos 'Configurações de Alta Precisão'
      const opcoesGPS = {
        enableHighAccuracy: true, // Força o uso do satélite GPS do celular
        timeout: 10000,           // Espera até 10 segundos para achar o sinal forte
        maximumAge: 0             // Impede de usar a última localização salva no cache
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          setMapCenter({ lat, lng });
          setNovaLocalizacao({ lat, lng });
          setArvoreSelecionada(null);
          
          setDrawerMode("REGISTRO");
          setIsMenuOpen(true);
          
          setEspecie(""); setNomeCientifico(""); setOrigem("Nativa"); setEstadoSanitario("Bom");
        },
        (erro) => {
          alert("GPS indisponível. Erro: " + erro.message);
        },
        opcoesGPS // <-- Passamos as regras restritas aqui
      );
    } else {
      alert("Seu navegador não suporta GPS.");
    }
  };

  const handleLogout = async () => await signOut(auth);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setNovaLocalizacao({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      setArvoreSelecionada(null); setDrawerMode("REGISTRO"); setIsMenuOpen(true);
      
      setEspecie(""); setNomeCientifico(""); setOrigem("Nativa"); setEstadoSanitario("Bom");
    }
  };

  const fecharMenu = () => { setIsMenuOpen(false); setNovaLocalizacao(null); };

  const handleSalvarArvore = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (drawerMode === "EDITAR" && arvoreSelecionada) {
        await updateDoc(doc(db, "arvores", arvoreSelecionada.id), { especie, nomeCientifico, origem, estadoSanitario });
      } else {
        await addDoc(collection(db, "arvores"), { especie, nomeCientifico, origem, estadoSanitario, dataRegistro: new Date(), localizacao: novaLocalizacao || unbCenter });
      }
      setEspecie(""); setNomeCientifico(""); setOrigem("Nativa"); setEstadoSanitario("Bom"); 
      setArvoreSelecionada(null); fecharMenu();
    } catch (error) { alert("Erro ao salvar."); } finally { setLoading(false); }
  };

  // NOVA FUNÇÃO: Excluir a árvore do Banco de Dados
  const handleExcluirArvore = async () => {
    if (!arvoreSelecionada) return;
    
    const confirmar = window.confirm(`Tem certeza que deseja excluir a árvore ${arvoreSelecionada.especie}? Esta ação não pode ser desfeita.`);
    
    if (confirmar) {
      try {
        await deleteDoc(doc(db, "arvores", arvoreSelecionada.id));
        setArvoreSelecionada(null);
        alert("Árvore excluída com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir: ", error);
        alert("Ocorreu um erro ao excluir a árvore.");
      }
    }
  };

  const abrirPainelEditar = () => {
    if (!arvoreSelecionada) return;
    setEspecie(arvoreSelecionada.especie || ""); 
    setNomeCientifico(arvoreSelecionada.nomeCientifico || ""); 
    setOrigem(arvoreSelecionada.origem || "Nativa");
    setEstadoSanitario(arvoreSelecionada.estadoSanitario || "Bom");
    setDrawerMode("EDITAR"); setIsMenuOpen(true);
  };

  if (!isLoaded) return <div className="flex items-center justify-center min-h-screen bg-emerald-50 text-emerald-800">Carregando satélite...</div>;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
        <button onClick={() => { setDrawerMode("REGISTRO"); setEspecie(""); setNomeCientifico(""); setIsMenuOpen(true); }} className="bg-emerald-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:bg-emerald-700 transition-all transform hover:scale-105">
          <Plus size={30} />
        </button>
        <button onClick={buscarMinhaLocalizacao} title="Capturar GPS e Registrar" className="bg-white text-blue-600 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:bg-gray-100 transition-all transform hover:scale-105">
          <LocateFixed size={26} />
        </button>
        <button onClick={handleLogout} className="bg-white/80 text-gray-500 w-10 h-10 rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all mt-4 ml-2">
          <LogOut size={18} />
        </button>
      </div>

      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 w-11/12 max-w-4xl flex gap-3 items-center">
        <div className="relative flex-1 flex items-center">
          <input 
            type="text" 
            placeholder="Pesquisar por Nome Comum..." 
            value={termoPesquisa}
            onChange={(e) => setTermoPesquisa(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white rounded-xl shadow-2xl outline-none font-medium text-gray-700" 
          />
          <Search className="absolute left-4 text-emerald-600" size={24} />
        </div>
        
        <div className="bg-white rounded-xl shadow-2xl flex items-center px-4 py-3 h-[56px]">
          <CalendarIcon size={20} className="text-gray-400 mr-2" />
          <input 
            type="date" 
            value={dataFiltro}
            onChange={(e) => setDataFiltro(e.target.value)}
            className="bg-transparent border-none outline-none font-semibold text-gray-700 cursor-pointer w-full"
            title="Filtrar árvores com serviço nesta data"
          />
        </div>

        <button 
          onClick={gerarRelatorioPDF}
          title="Gerar Relatório em PDF da data selecionada"
          className="bg-blue-600 text-white rounded-xl shadow-2xl px-5 h-[56px] flex items-center justify-center hover:bg-blue-700 transition-colors gap-2 font-bold"
        >
          <Download size={20} />
          <span className="hidden md:inline">Relatório</span>
        </button>
      </div>

      <GoogleMap mapContainerStyle={containerStyle} center={mapCenter} zoom={17} options={{ mapTypeId: "hybrid", disableDefaultUI: true, zoomControl: true, tilt: 45, draggableCursor: "crosshair" }} onClick={handleMapClick}>
        {arvoresFiltradas.map((arvore) => (
          <Marker key={arvore.id} position={arvore.localizacao} icon={{ url: getIconUrl(arvore.estadoSanitario) }} onClick={() => setArvoreSelecionada(arvore)} />
        ))}

        {arvoreSelecionada && (
          <InfoWindow position={arvoreSelecionada.localizacao} onCloseClick={() => setArvoreSelecionada(null)}>
            <div className="p-2 min-w-[200px]">
              <div className="flex justify-between items-start border-b border-emerald-100 pb-1 mb-2">
                <h3 className="font-bold text-lg text-emerald-800">{arvoreSelecionada.especie}</h3>
                <div className="flex gap-3 text-gray-400">
                  <button onClick={abrirPainelEditar} title="Editar" className="hover:text-emerald-600"><Edit2 size={18} /></button>
                  {/* BOTÃO DE EXCLUIR REINSERIDO AQUI: */}
                  <button onClick={handleExcluirArvore} title="Excluir" className="hover:text-red-600"><Trash2 size={18} /></button>
                </div>
              </div>
              <p className="text-sm text-gray-700 italic mb-1">{arvoreSelecionada.nomeCientifico}</p>
              <p className="text-sm text-gray-700 mb-1"><strong>Origem:</strong> {arvoreSelecionada.origem}</p>
              <p className="text-sm text-gray-700 mb-4"><strong>Condição:</strong> <span className={`ml-1 font-bold ${arvoreSelecionada.estadoSanitario === 'Morta' ? 'text-black' : ''}`}>{arvoreSelecionada.estadoSanitario}</span></p>
              <button onClick={() => router.push(`/dashboard?id=${arvoreSelecionada.id}`)} className="w-full bg-blue-600 text-white text-sm font-bold py-2 rounded shadow hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center">
                <History size={16} /> Prontuário / Serviços
              </button>
            </div>
          </InfoWindow>
        )}
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
              <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-lg hover:bg-emerald-700 transition-colors">
                {loading ? "Salvando..." : "Salvar no Banco"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}