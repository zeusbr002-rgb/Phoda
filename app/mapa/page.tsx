"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { Search, Plus, X, Leaf, Filter, Edit2, Trash2, History, LocateFixed, LogOut } from "lucide-react";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
// Importações novas de Auth
import { signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";

const containerStyle = { width: "100vw", height: "100vh" };
const unbCenter = { lat: -15.7624, lng: -47.8664 };
const iconMorta = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2236%22%20viewBox%3D%220%200%2024%2036%22%3E%3Cpath%20fill%3D%22%23000000%22%20stroke%3D%22%23FFFFFF%22%20stroke-width%3D%222%22%20d%3D%22M12%200C5.373%200%200%205.373%200%2012c0%208.542%2012%2024%2012%2024s12-15.458%2012-24c0-6.627-5.373-12-12-12z%22%2F%3E%3Ccircle%20fill%3D%22%23FFFFFF%22%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%224%22%2F%3E%3C%2Fsvg%3E';

export default function MapaScreen() {
  const router = useRouter();
  
  // Proteção de Rota (Expulsa se não estiver logado)
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
  const [novaLocalizacao, setNovaLocalizacao] = useState<{lat: number, lng: number} | null>(null);
  const [arvoreSelecionada, setArvoreSelecionada] = useState<any | null>(null);
  
  // Estados de Filtro e Pesquisa
  const [filtroMapa, setFiltroMapa] = useState("Todos");
  const [termoPesquisa, setTermoPesquisa] = useState("");

  const [especie, setEspecie] = useState("");
  const [altura, setAltura] = useState("");
  const [estadoSanitario, setEstadoSanitario] = useState("Bom");

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    // COLE A SUA CHAVE VERDADEIRA AQUI EMBAIXO:
    googleMapsApiKey: "AIzaSyBCjSPO0l2BDUCeNmBsWH05kIs21gJtGk4", 
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "arvores"), (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setArvores(lista);
    });
    return () => unsubscribe();
  }, []);

  // MOTOR DE BUSCA: Filtra pelo Estado Sanitário E pelo Texto da Barra
  const arvoresFiltradas = arvores.filter(a => {
    const matchFiltro = filtroMapa === "Todos" ? true : a.estadoSanitario === filtroMapa;
    const matchPesquisa = termoPesquisa === "" ? true : a.especie.toLowerCase().includes(termoPesquisa.toLowerCase());
    return matchFiltro && matchPesquisa;
  });

  const getIconUrl = (estado: string) => {
    if (estado === "Morta") return iconMorta;
    if (estado === "Ruim") return "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
    if (estado === "Regular") return "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
    return "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
  };

  const buscarMinhaLocalizacao = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => alert("GPS indisponível.")
      );
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setNovaLocalizacao({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      setArvoreSelecionada(null); setDrawerMode("REGISTRO"); setIsMenuOpen(true);
      setEspecie(""); setAltura(""); setEstadoSanitario("Bom");
    }
  };

  const fecharMenu = () => { setIsMenuOpen(false); setNovaLocalizacao(null); };

  const handleSalvarArvore = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (drawerMode === "EDITAR" && arvoreSelecionada) {
        await updateDoc(doc(db, "arvores", arvoreSelecionada.id), { especie, altura, estadoSanitario });
      } else {
        await addDoc(collection(db, "arvores"), { especie, altura, estadoSanitario, dataRegistro: new Date(), localizacao: novaLocalizacao || unbCenter });
      }
      setEspecie(""); setAltura(""); setEstadoSanitario("Bom"); setArvoreSelecionada(null); fecharMenu();
    } catch (error) { alert("Erro ao salvar."); } finally { setLoading(false); }
  };

  const handleExcluirArvore = async () => {
    if (!arvoreSelecionada) return;
    if (window.confirm("Excluir este registro?")) {
      await deleteDoc(doc(db, "arvores", arvoreSelecionada.id));
      setArvoreSelecionada(null);
    }
  };

  const abrirPainelEditar = () => {
    if (!arvoreSelecionada) return;
    setEspecie(arvoreSelecionada.especie); setAltura(arvoreSelecionada.altura); setEstadoSanitario(arvoreSelecionada.estadoSanitario);
    setDrawerMode("EDITAR"); setIsMenuOpen(true);
  };

  if (!isLoaded) return <div className="flex items-center justify-center min-h-screen bg-emerald-50 text-emerald-800">Carregando satélite...</div>;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      
      {/* Botões Laterais Esquerdos */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
        <button onClick={() => { setDrawerMode("REGISTRO"); setEspecie(""); setIsMenuOpen(true); }} className="bg-emerald-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:bg-emerald-700 transition-all transform hover:scale-105">
          <Plus size={30} />
        </button>
        <button onClick={buscarMinhaLocalizacao} title="Minha Localização GPS" className="bg-white text-blue-600 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:bg-gray-100 transition-all transform hover:scale-105">
          <LocateFixed size={26} />
        </button>
        {/* Botão de Logout Discreto */}
        <button onClick={handleLogout} title="Sair do Sistema" className="bg-white/80 text-gray-500 w-10 h-10 rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all mt-4 ml-2">
          <LogOut size={18} />
        </button>
      </div>

      {/* Barra de Pesquisa Integrada */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 w-10/12 max-w-2xl flex gap-3">
        <div className="relative flex-1 flex items-center">
          <input 
            type="text" 
            placeholder="Pesquisar espécie (Ex: Mangueira)..." 
            value={termoPesquisa}
            onChange={(e) => setTermoPesquisa(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white rounded-xl shadow-2xl outline-none font-medium text-gray-700" 
          />
          <Search className="absolute left-4 text-emerald-600" size={24} />
        </div>
        <div className="bg-white rounded-xl shadow-2xl flex items-center px-4 hidden md:flex">
          <Filter size={20} className="text-gray-400 mr-2" />
          <select value={filtroMapa} onChange={(e) => setFiltroMapa(e.target.value)} className="bg-transparent outline-none font-semibold text-gray-700 py-4 cursor-pointer">
            <option value="Todos">Todas</option>
            <option value="Bom">Saudáveis</option>
            <option value="Regular">Regulares</option>
            <option value="Ruim">Críticas</option>
            <option value="Morta">Suprimidas</option>
          </select>
        </div>
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
                <div className="flex gap-2 text-gray-400">
                  <button onClick={abrirPainelEditar} className="hover:text-emerald-600"><Edit2 size={16} /></button>
                  <button onClick={handleExcluirArvore} className="hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-1"><strong>Altura:</strong> {arvoreSelecionada.altura}m</p>
              <p className="text-sm text-gray-700 mb-4"><strong>Condição:</strong> <span className={`ml-1 font-bold ${arvoreSelecionada.estadoSanitario === 'Morta' ? 'text-black' : ''}`}>{arvoreSelecionada.estadoSanitario}</span></p>
              <button onClick={() => router.push(`/dashboard?id=${arvoreSelecionada.id}`)} className="w-full bg-blue-600 text-white text-sm font-bold py-2 rounded shadow hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center">
                <History size={16} /> Prontuário / Serviços
              </button>
            </div>
          </InfoWindow>
        )}
        {novaLocalizacao && drawerMode === "REGISTRO" && isMenuOpen && (<Marker position={novaLocalizacao} icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }} />)}
      </GoogleMap>

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-emerald-700">{drawerMode === "EDITAR" ? "Editar Registro" : "Novo Registro"}</h2>
            <button onClick={fecharMenu} className="text-gray-400 hover:text-gray-600"><X size={28} /></button>
          </div>
          <form onSubmit={handleSalvarArvore} className="flex-1 flex flex-col space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Espécie / Nome Popular</label>
              <input type="text" value={especie} onChange={(e) => setEspecie(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Altura Estimada (metros)</label>
              <input type="number" value={altura} onChange={(e) => setAltura(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none" required />
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
            <div className="mt-auto pt-6">
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