"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  LockKeyhole,
  LogOut,
  Radio,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { Provider, Snapshot } from "../../server/live/common";
import { LiveSnapshot } from "../../features/live/LiveSnapshot";

type Session = {
  authenticated: boolean;
  configured: boolean;
  providers?: Record<Provider, boolean>;
};
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:border-cyan-300/50 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40";
const panel = "rounded-2xl border border-white/10 bg-white/[0.025]";

export default function LivePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [password, setPassword] = useState("");
  const [provider, setProvider] = useState<Provider>("openclaw");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const checkSession = useCallback(async () => {
    const response = await fetch("/api/live/session", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível verificar o login.");
    const data: Session = await response.json();
    setSession(data);
    return data;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/live/session", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: Session) => setSession(data))
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Não foi possível acessar o servidor. Recarregue a página.");
      });
    return () => controller.abort();
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPassword("");
      await checkSession();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao entrar.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    generation.current++;
    setBusy(true);
    try {
      const response = await fetch("/api/live/session", { method: "DELETE" });
      if (!response.ok)
        throw new Error("Falha ao encerrar a sessão. Tente novamente.");
      setSnapshot(null);
      setError("");
      setSession({ authenticated: false, configured: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao sair.");
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setSnapshot(null);
    try {
      const response = await fetch(`/api/live/snapshot?provider=${provider}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (current !== generation.current) return;
      if (response.status === 401) {
        setSession({ authenticated: false, configured: true });
        throw new Error("Sua sessão expirou. Entre novamente.");
      }
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : (data.error?.message ?? "Não foi possível consultar o provedor."),
        );
      setSnapshot(data);
    } catch (error) {
      if (current === generation.current)
        setError(error instanceof Error ? error.message : "Falha de rede.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8 text-zinc-200 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={16} /> Voltar à demo
        </Link>
        <span className="flex items-center gap-2 text-xs uppercase tracking-[.2em] text-cyan-300">
          <ShieldCheck size={15} /> Área privada · somente leitura
        </span>
      </header>
      <div className="flex flex-wrap items-end justify-between gap-5 py-10">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[.3em] text-cyan-300">
            Agent Ops / Live
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Seus agentes. Dados reais.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            Consulte agentes e sessões do OpenClaw ou o dashboard do Hermes. As
            credenciais dos provedores ficam no servidor.
          </p>
        </div>
        {session?.authenticated && (
          <button className={button} onClick={logout} disabled={busy}>
            <LogOut size={16} /> Sair
          </button>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="mb-6 break-words rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm leading-6 text-amber-200"
        >
          {error}
        </div>
      )}
      {!session ? (
        <p role="status" className="text-zinc-400">
          Verificando acesso…
        </p>
      ) : !session.authenticated ? (
        <section className={`${panel} max-w-lg p-7`}>
          <LockKeyhole className="mb-5 text-cyan-300" size={28} />
          <h2 className="text-xl font-semibold">Acesso do operador</h2>
          <p className="mb-6 mt-3 text-sm leading-6 text-zinc-400">
            Use a senha definida para esta instalação do Agent Ops.
          </p>
          {!session.configured ? (
            <div className="rounded-xl bg-white/5 p-4 text-sm leading-6 text-zinc-300">
              O modo Live ainda não foi configurado. Defina a senha do operador,
              a chave de sessão e a origem da aplicação no arquivo de ambiente
              do servidor. O{" "}
              <a
                className="text-cyan-300 underline"
                href="https://github.com/thalesakano/agent-ops#modo-live"
                target="_blank"
                rel="noreferrer"
              >
                guia de instalação
              </a>{" "}
              explica cada etapa.
            </div>
          ) : (
            <form onSubmit={login} className="space-y-4">
              <label className="block text-sm">
                Senha do operador
                <input
                  autoComplete="current-password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 outline-none focus:border-cyan-300"
                />
              </label>
              <button
                disabled={busy}
                className={`${button} w-full bg-cyan-300 text-slate-950 hover:text-slate-950`}
              >
                {busy ? "Entrando…" : "Entrar"}
              </button>
            </form>
          )}
        </section>
      ) : (
        <>
          <section
            aria-label="Provedores"
            className="grid gap-4 sm:grid-cols-2"
          >
            {(["openclaw", "hermes"] as const).map((item) => (
              <button
                key={item}
                disabled={busy}
                aria-pressed={provider === item}
                onClick={() => {
                  generation.current++;
                  setProvider(item);
                  setSnapshot(null);
                  setError("");
                }}
                className={`${panel} flex items-center gap-4 p-5 text-left transition disabled:opacity-50 ${provider === item ? "border-cyan-300/60 bg-cyan-300/5" : "hover:border-white/25"}`}
              >
                <Radio
                  size={24}
                  className={
                    provider === item ? "text-cyan-300" : "text-zinc-600"
                  }
                />
                <div>
                  <h2 className="font-semibold">
                    {item === "openclaw"
                      ? "OpenClaw Gateway"
                      : "Hermes Dashboard"}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    {session.providers?.[item]
                      ? "Configurado · aguardando consulta"
                      : "Sem configuração no servidor"}
                  </p>
                </div>
              </button>
            ))}
          </section>
          <div className="my-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-zinc-500">
              {snapshot
                ? `Última consulta: ${new Date(snapshot.fetchedAt).toLocaleString("pt-BR")}`
                : "A conexão será validada ao consultar o provedor."}
            </p>
            <button
              disabled={busy || !session.providers?.[provider]}
              onClick={refresh}
              className={`${button} bg-cyan-300 text-slate-950 hover:text-slate-950`}
            >
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
              {busy ? "Consultando…" : "Consultar agora"}
            </button>
          </div>
          {!session.providers?.[provider] && (
            <div className={`${panel} p-6 text-sm leading-6 text-zinc-400`}>
              Configure{" "}
              {provider === "openclaw"
                ? "OPENCLAW_GATEWAY_URL e a credencial do gateway"
                : "HERMES_DASHBOARD_URL e o método de autenticação"}{" "}
              no servidor e reinicie a aplicação.{" "}
              <a
                className="text-cyan-300 underline"
                href="https://github.com/thalesakano/agent-ops#modo-live"
              >
                Ver guia de configuração
              </a>
              .
            </div>
          )}
          {busy && (
            <p role="status" className="py-8 text-center text-sm text-zinc-400">
              Autenticando e consultando dados reais…
            </p>
          )}
          {snapshot && <LiveSnapshot key={provider} snapshot={snapshot} />}
        </>
      )}
    </main>
  );
}
