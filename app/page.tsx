"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { Leaf } from "lucide-react";

export default function LoginScreen() {
  const router = useRouter();
  
  // Estado para alternar entre "Entrar" e "Cadastrar"
  const [isLogin, setIsLogin] = useState(true); 
  
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");
    
    try {
      if (isLogin) {
        // Tenta fazer o Login
        await signInWithEmailAndPassword(auth, email, senha);
      } else {
        // Tenta Criar a Conta
        await createUserWithEmailAndPassword(auth, email, senha);
        alert("Conta criada com sucesso! Bem-vindo ao Phoda.");
      }
      router.push("/mapa"); // Entra no mapa se der tudo certo
    } catch (error: any) {
      console.error(error);
      // Tratamento de erros comuns do Firebase em português
      if (error.code === 'auth/email-already-in-use') {
        setErro("Este e-mail já está cadastrado.");
      } else if (error.code === 'auth/weak-password') {
        setErro("A senha é muito fraca. Use pelo menos 6 caracteres.");
      } else if (error.code === 'auth/invalid-credential') {
        setErro("E-mail ou senha incorretos.");
      } else {
        setErro(isLogin ? "Erro ao acessar. Verifique seus dados." : "Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fundo decorativo verde */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-emerald-800 rounded-b-[100px] shadow-2xl"></div>
      
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-emerald-100 p-4 rounded-full text-emerald-700 mb-4 shadow-inner">
            <Leaf size={40} />
          </div>
          {/* O NOME DO APP ATUALIZADO AQUI */}
          <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">Phoda</h1>
          <p className="text-gray-500 font-medium text-sm mt-1 text-center">Gestão de Paisagismo e Áreas Verdes</p>
        </div>

        {erro && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold mb-4 text-center border border-red-200">
            {erro}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">E-mail Institucional</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
              placeholder="voce@unb.br"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Senha de Acesso</label>
            <input 
              type="password" 
              value={senha} 
              onChange={(e) => setSenha(e.target.value)} 
              required 
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
              placeholder="Mínimo de 6 caracteres"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg mt-2 disabled:bg-emerald-400"
          >
            {loading ? "Processando..." : (isLogin ? "Acessar Sistema" : "Criar Nova Conta")}
          </button>
        </form>

        {/* BOTÃO DE ALTERNAR ENTRE LOGIN E CADASTRO */}
        <div className="mt-6 text-center border-t border-gray-100 pt-6">
          <p className="text-sm text-gray-500 mb-2">
            {isLogin ? "Ainda não faz parte da equipe?" : "Já possui um acesso?"}
          </p>
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin); // Inverte o modo
              setErro(""); // Limpa os erros ao trocar
              setSenha(""); // Limpa a senha por segurança
            }}
            className="text-emerald-700 font-bold hover:text-emerald-500 hover:underline transition-all"
          >
            {isLogin ? "Cadastre-se agora" : "Voltar para o Login"}
          </button>
        </div>

      </div>
    </div>
  );
}