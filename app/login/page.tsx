"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

// ================= ÍCONES =================
const Icons = {
  Mail: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Lock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Alert: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ESTADOS DA SPLASH SCREEN (ULTRA DESAFIO)
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);

  useEffect(() => {
    // Aos 2.5 segundos, começa a desaparecer (fade out)
    const timer1 = setTimeout(() => setFadeSplash(true), 2500);
    // Aos 3.0 segundos exatos, remove a Splash Screen do código para poder clicar no login
    const timer2 = setTimeout(() => setShowSplash(false), 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMsg("Email ou senha inválidos. Tente novamente.");
      return;
    }

    // Sucesso! Redireciona para o painel
    window.location.href = "/dashboard";
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#1a0e13] via-[#2b1720] to-[#1a0e13] overflow-hidden">
      
      {/* ================= ULTRA DESAFIO: SPLASH SCREEN ANIMADA ================= */}
      {showSplash && (
        <div 
          className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#1a0e13] transition-opacity duration-500 ease-in-out ${fadeSplash ? 'opacity-0' : 'opacity-100'}`}
        >
          {/* Brilho no fundo do Logo */}
          <div className="absolute w-64 h-64 bg-[#80b02d] rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse" />
          
          {/* Logo (Entra dando Zoom) */}
          <div className="animate-in zoom-in-50 fade-in duration-1000 ease-out relative z-10">
            <img src="/logo.png" alt="Logo GreenSoil" className="h-20 brightness-0 invert drop-shadow-2xl" />
          </div>

          {/* Textos (Entram deslizando de baixo pra cima, com delay) */}
          <div className="mt-8 flex flex-col items-center animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-500 fill-mode-both relative z-10">
            <h1 className="text-4xl font-black tracking-widest text-white uppercase">
              Green<span className="text-[#80b02d]">Soil</span>
            </h1>
            <p className="text-sm tracking-[0.4em] text-white/60 mt-2 uppercase font-bold">
              Mobile System
            </p>
          </div>

          {/* Bolinhas de carregamento nativo no rodapé */}
          <div className="absolute bottom-16 flex gap-2 animate-in fade-in duration-1000 delay-1000 fill-mode-both">
            <div className="w-2.5 h-2.5 rounded-full bg-[#80b02d] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2.5 h-2.5 rounded-full bg-[#80b02d] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2.5 h-2.5 rounded-full bg-[#80b02d] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}


      {/* ================= TELA DE LOGIN (Fica por baixo da Splash) ================= */}
      {/* Esse div só aparece (fade-in) quando a Splash Screen começa a sumir */}
      <div className={`flex items-center justify-center min-h-screen p-6 transition-opacity duration-1000 ease-in-out ${!showSplash || fadeSplash ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* EFEITOS DE LUZ NO FUNDO DO LOGIN */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#80b02d] rounded-full mix-blend-screen filter blur-[120px] opacity-10 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#391e2a] rounded-full mix-blend-screen filter blur-[120px] opacity-40" />

        {/* CARD PRINCIPAL (Glassmorphism) */}
        <div className="w-full max-w-md relative z-10 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-300 fill-mode-both">
          
          <div className="rounded-[2rem] bg-[#391e2a]/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-10">

            <div className="mb-10 text-center">
              <div className="inline-block p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner mb-6">
                <img src="/logo.png" alt="Logo" className="h-10 mx-auto brightness-0 invert" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Bem-vindo de volta</h2>
              <p className="text-sm text-white/50 mt-2 font-medium">
                Insira suas credenciais para acessar o sistema
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">

              {/* CAMPO EMAIL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold tracking-wide text-white/70 uppercase ml-1">E-mail</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-[#80b02d] transition-colors">
                    <Icons.Mail />
                  </div>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-black/20 py-3.5 pl-11 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#80b02d]/50 focus:border-[#80b02d] transition-all focus:bg-black/40"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* CAMPO SENHA */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold tracking-wide text-white/70 uppercase ml-1">Senha</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-[#80b02d] transition-colors">
                    <Icons.Lock />
                  </div>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-black/20 py-3.5 pl-11 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#80b02d]/50 focus:border-[#80b02d] transition-all focus:bg-black/40"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* MENSAGEM DE ERRO (Com animação) */}
              {msg && (
                <div className="animate-in slide-in-from-top-2 flex items-center gap-3 text-sm text-red-200 bg-red-900/30 border border-red-500/30 rounded-xl p-4 shadow-inner font-medium">
                  <div className="text-red-400 shrink-0"><Icons.Alert /></div>
                  {msg}
                </div>
              )}

              {/* BOTÃO ENTRAR */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full rounded-xl bg-gradient-to-r from-[#80b02d] to-[#6c9526] text-white py-4 font-bold text-sm tracking-wide shadow-[0_4px_14px_rgba(128,176,45,0.4)] hover:shadow-[0_6px_20px_rgba(128,176,45,0.6)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-not-allowed transition-all duration-200 overflow-hidden group"
                >
                  <div className="absolute inset-0 -translate-x-full bg-white/20 skew-x-12 group-hover:animate-[shimmer_1.5s_infinite]" />
                  {loading ? "Autenticando..." : "ENTRAR NO SISTEMA"}
                </button>
              </div>

            </form>
          </div>

          <p className="text-center text-white/30 text-xs font-medium mt-8 tracking-widest uppercase">
            GreenSoil Mobile System
          </p>

        </div>
      </div>
    </div>
  );
}