"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Não foi possível entrar.");
        return;
      }
      // Only ever follow an internal path — a full/protocol-relative URL here would let
      // ?next= redirect the browser off-site right after a real login (phishing setup).
      const nextParam = searchParams.get("next") ?? "/";
      const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Image src="/logo.png" alt="IMETAL" width={220} height={76} priority className="h-auto w-48" />
        </div>
        <h1 className="mb-6 text-center text-lg font-semibold text-slate-700">Gestão de Pedidos</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Usuário</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-light disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">
          <a href="https://gbcompanybr.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600">
            BY GBCOMPANYBR
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
