"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import AppShell from "../../components/AppShell";
import Button from "../../components/Button";
import Card from "../../components/Card";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      alert("Erro ao entrar");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm">
          <Card title="GS Work Order">
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                className="w-full border rounded-xl p-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="Senha"
                className="w-full border rounded-xl p-3"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />

              <Button text="Entrar" type="submit" />
            </form>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
