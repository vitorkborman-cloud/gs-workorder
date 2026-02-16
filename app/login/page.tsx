"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
      setMsg("Email ou senha inválidos");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen bg-[#2b1720] flex items-center justify-center p-6">

      <div className="w-full max-w-md rounded-2xl bg-[#391e2a] border border-white/10 shadow-2xl p-8">

        <div className="mb-8 text-center">
          <img src="/logo.png" className="h-10 mx-auto brightness-0 invert mb-4"/>
          <p className="text-sm text-white/70">
            Acesse com seu e-mail e senha
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">

          <div>
            <label className="text-sm text-white/80">Email</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#80b02d]"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm text-white/80">Senha</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#80b02d]"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#80b02d] text-black py-2 font-semibold hover:brightness-110 transition"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {msg && (
            <div className="text-sm text-red-200 bg-red-900/40 border border-red-900 rounded-lg p-3">
              {msg}
            </div>
          )}
        </form>

      </div>
    </div>
  );
}
