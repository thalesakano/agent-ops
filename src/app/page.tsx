"use client";
import { useState } from "react";
import { AgentOps } from "../features/agent-ops/AgentOps";
import type { Locale } from "../features/agent-ops/model";
export default function Page() {
  const [locale, setLocale] = useState<Locale>("pt");
  return (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs text-zinc-500">
        <a href="https://sakano.tec.br" className="hover:text-white">
          Thales Sakano / Agent Ops
        </a>
        <div className="flex gap-2">
          {(["pt", "en"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setLocale(lang);
                document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
              }}
              aria-pressed={locale === lang}
              className={`rounded-full px-3 py-1 uppercase ${locale === lang ? "bg-cyan-300 text-slate-950" : "text-zinc-400"}`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <AgentOps locale={locale} />
    </>
  );
}
