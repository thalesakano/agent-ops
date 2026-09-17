"use client";
import { useEffect, useRef } from "react";
import { Check, Download, Terminal, X } from "lucide-react";
import { agents, scenarios, statusNames, type Locale, type Run } from "./model";
export const opsButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-40";
export const statusStyle = {
  queued: "text-zinc-400 bg-zinc-400/10",
  running: "text-cyan-300 bg-cyan-300/10",
  approval: "text-amber-300 bg-amber-300/10",
  completed: "text-emerald-300 bg-emerald-300/10",
  failed: "text-rose-300 bg-rose-300/10",
  rejected: "text-orange-300 bg-orange-300/10",
  cancelled: "text-zinc-400 bg-zinc-400/10",
};
export function StatusBadge({ run, locale }: { run: Run; locale: Locale }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[10px] ${statusStyle[run.status]}`}
    >
      <span className="h-1 w-1 rounded-full bg-current" />
      {statusNames[locale][run.status]}
    </span>
  );
}
export function RunDetail({
  run,
  locale,
  onClose,
  onDecision,
  onCancel,
  onRetry,
}: {
  run: Run;
  locale: Locale;
  onClose: () => void;
  onDecision: (approve: boolean) => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pt = locale === "pt";
  const agent = agents.find((item) => item.id === run.agentId)!;
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  function download() {
    const blob = new Blob(
      [JSON.stringify({ mode: "simulation", ...run }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agent-ops-${run.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-labelledby="run-title"
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-auto rounded-2xl border border-white/10 bg-[#111720] p-0 text-zinc-200 shadow-2xl backdrop:bg-black/70"
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-cyan-300">
            {pt ? "Execução simulada" : "Simulated execution"} /{" "}
            {run.id.slice(0, 12)}
          </p>
          <h2 id="run-title" className="text-xl font-semibold">
            {scenarios[run.scenario][locale]}
          </h2>
          <p className="mt-2 text-xs text-zinc-500">
            {agent.name} · {agent.provider} · {pt ? "Tentativa" : "Attempt"}{" "}
            {run.attempt + 1}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={pt ? "Fechar" : "Close"}
          className={opsButton}
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge run={run} locale={locale} />
          <span className="font-mono text-xs text-zinc-500">
            {run.tokens.toLocaleString()} tokens ·{" "}
            {pt ? "simulados" : "simulated"}
          </span>
        </div>
        <h3 className="mb-5 mt-8 flex items-center gap-2 text-sm font-medium">
          <Terminal size={16} className="text-cyan-300" />
          {pt ? "Linha do tempo" : "Execution timeline"}
        </h3>
        <ol className="space-y-0">
          {run.events.map((event, index) => (
            <li
              key={index}
              className="relative ml-2 border-l border-white/10 pb-6 pl-6 last:border-transparent"
            >
              <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-[#111720] bg-cyan-400/70" />
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-zinc-500">
                <span>{String(index + 1).padStart(2, "0")}</span>
                {event.tool && (
                  <code className="rounded bg-white/5 px-1.5 py-0.5 text-cyan-300/80">
                    {event.tool}
                  </code>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                {event[locale]}
              </p>
            </li>
          ))}
        </ol>
        {run.status === "approval" && (
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-5">
            <h3 className="text-sm font-semibold text-amber-200">
              {pt ? "Sua decisão é necessária" : "Your decision is needed"}
            </h3>
            <p className="my-3 text-xs leading-5 text-zinc-400">
              {pt
                ? "O agente propõe reaplicar uma configuração fictícia. Nenhum serviço real será alterado."
                : "The agent proposes reapplying a fictional configuration. No real service will be changed."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onDecision(true)}
                className={`${opsButton} !border-cyan-300/30 !bg-cyan-300 !text-slate-950`}
              >
                <Check size={14} />
                {pt ? "Aprovar ação" : "Approve action"}
              </button>
              <button onClick={() => onDecision(false)} className={opsButton}>
                {pt ? "Rejeitar ação" : "Reject action"}
              </button>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {["queued", "running"].includes(run.status) && (
            <button onClick={onCancel} className={opsButton}>
              {pt ? "Cancelar execução" : "Cancel execution"}
            </button>
          )}
          {["failed", "rejected", "cancelled"].includes(run.status) && (
            <button onClick={onRetry} className={opsButton}>
              {pt ? "Tentar novamente" : "Retry"}
            </button>
          )}
          {run.status === "completed" && (
            <button onClick={download} className={opsButton}>
              <Download size={14} />
              {pt ? "Baixar relatório" : "Download report"}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
