"use client";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Cpu,
  GitBranch,
  Layers3,
  Network,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Terminal,
  Workflow,
  X,
} from "lucide-react";
import {
  advance,
  agents,
  cancel,
  createRun,
  decide,
  scenarios,
  seedRuns,
  statusNames,
  summary,
  type Locale,
  type Run,
  type Scenario,
} from "./model";
import { opsButton, RunDetail, StatusBadge } from "./RunDetail";
type View = "overview" | "runs" | "agents" | "connections" | "approvals";
const selectStyle =
  "rounded-lg border border-white/10 bg-[#111720] px-3 py-2.5 text-xs text-zinc-300 outline-none focus:ring-2 focus:ring-cyan-300/50";

function NewRun({
  locale,
  onClose,
  onStart,
}: {
  locale: Locale;
  onClose: () => void;
  onStart: (scenario: Scenario, agent: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pt = locale === "pt";
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-labelledby="new-run-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-white/10 bg-[#111720] p-6 text-zinc-200 backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="new-run-title" className="text-lg font-semibold">
          {pt ? "Simular uma tarefa" : "Simulate a task"}
        </h2>
        <button
          onClick={onClose}
          aria-label={pt ? "Fechar" : "Close"}
          className={opsButton}
        >
          <X size={16} />
        </button>
      </div>
      <p className="my-4 text-sm leading-6 text-zinc-400">
        {pt
          ? "Explore uma execução com eventos fictícios. Nenhum agente ou serviço externo será acionado."
          : "Explore an execution with fictional events. No external agent or service will be invoked."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onStart(data.get("scenario") as Scenario, String(data.get("agent")));
        }}
        className="space-y-5"
      >
        <label className="block text-xs text-zinc-400">
          {pt ? "Cenário" : "Scenario"}
          <select
            name="scenario"
            aria-label={pt ? "Cenário" : "Scenario"}
            className={`${selectStyle} mt-2 w-full`}
          >
            {Object.entries(scenarios).map(([id, label]) => (
              <option key={id} value={id}>
                {label[locale]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-400">
          {pt ? "Agente" : "Agent"}
          <select
            name="agent"
            aria-label={pt ? "Agente" : "Agent"}
            className={`${selectStyle} mt-2 w-full`}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} · {agent.provider}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className={`${opsButton} !w-full !bg-cyan-300 !text-slate-950`}
        >
          <Play size={14} />
          {pt ? "Iniciar simulação" : "Start simulation"}
        </button>
      </form>
    </dialog>
  );
}
function AgentCards({
  locale,
  runs,
  onSelect,
}: {
  locale: Locale;
  runs: Run[];
  onSelect: (id: string) => void;
}) {
  const pt = locale === "pt";
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {agents.map((agent) => {
        const active = runs.filter(
          (run) =>
            run.agentId === agent.id &&
            ["running", "queued", "approval"].includes(run.status),
        );
        return (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className="group rounded-xl border border-white/10 bg-[#10161f] p-5 text-left transition hover:border-cyan-300/30"
          >
            <div className="flex items-center gap-3">
              <span
                className={`rounded-xl border p-3 ${agent.color === "cyan" ? "border-cyan-300/20 bg-cyan-300/5 text-cyan-300" : agent.color === "violet" ? "border-violet-300/20 bg-violet-300/5 text-violet-300" : "border-emerald-300/20 bg-emerald-300/5 text-emerald-300"}`}
              >
                <Bot size={21} />
              </span>
              <div>
                <h3 className="font-semibold text-zinc-100">{agent.name}</h3>
                <p className="mt-1 font-mono text-[10px] text-zinc-500">
                  {agent.provider}
                </p>
              </div>
              <ArrowUpRight
                size={15}
                className="ml-auto text-zinc-600 group-hover:text-cyan-300"
              />
            </div>
            <p className="mt-5 text-xs text-zinc-400">{agent.role[locale]}</p>
            <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-[10px]">
              <span className="flex items-center gap-1.5 text-cyan-200">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${active.length ? "bg-cyan-300" : "bg-zinc-500"}`}
                />
                {active.length
                  ? `${active.length} ${pt ? "em acompanhamento" : "tracked"}`
                  : pt
                    ? "Disponível"
                    : "Available"}
              </span>
              <span className="font-mono text-zinc-600">
                {pt ? "AGENTE DEMO" : "DEMO AGENT"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
function Connections({ locale }: { locale: Locale }) {
  const pt = locale === "pt";
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.025] p-6">
        <Network className="mb-4 text-cyan-300" />
        <h2 className="text-xl font-semibold text-white">
          {pt
            ? "Nenhuma conexão real configurada."
            : "No live connection configured."}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
          {pt
            ? "Esta versão é uma demonstração local. Os agentes, eventos e métricas são simulados. Ela não solicita tokens nem acessa seus serviços."
            : "This version is a local demonstration. Agents, events and metrics are simulated. It does not request tokens or access your services."}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            name: "OpenClaw",
            transport: "WebSocket Gateway",
            url: "https://docs.openclaw.ai/gateway/protocol",
            description: pt
              ? "Um conector no servidor poderá autenticar no Gateway, respeitar o pareamento de dispositivo e consultar sessões com permissões de leitura."
              : "A server-side connector can authenticate with the Gateway, respect device pairing and query sessions with read permissions.",
          },
          {
            name: "Hermes",
            transport: "Dashboard API",
            url: "https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard",
            description: pt
              ? "Um adaptador dedicado poderá consultar status, sessões e histórico pela API autenticada da versão instalada."
              : "A dedicated adapter can query status, sessions and history through the installed version's authenticated API.",
          },
        ].map((item) => (
          <article
            key={item.name}
            className="rounded-xl border border-white/10 bg-[#10161f] p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{item.name}</h3>
              <span className="rounded bg-white/5 px-2 py-1 text-[10px] text-zinc-500">
                {pt ? "Integração futura" : "Future integration"}
              </span>
            </div>
            <p className="mt-2 font-mono text-xs text-cyan-300">
              {item.transport}
            </p>
            <p className="my-5 text-sm leading-6 text-zinc-400">
              {item.description}
            </p>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs text-cyan-300"
            >
              {pt ? "Documentação do provedor" : "Provider documentation"}
              <ArrowUpRight size={14} />
            </a>
          </article>
        ))}
      </div>
      <div className="rounded-xl border border-white/10 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck size={17} className="text-emerald-300" />
          {pt ? "Como evoluir para operação real" : "Path to live operations"}
        </h3>
        <ol className="grid gap-4 text-xs leading-6 text-zinc-400 md:grid-cols-3">
          <li>
            <span className="mr-2 text-cyan-300">01</span>
            {pt
              ? "Instalar o backend em um ambiente privado e configurar autenticação para os operadores."
              : "Install the backend in a private environment and configure operator authentication."}
          </li>
          <li>
            <span className="mr-2 text-cyan-300">02</span>
            {pt
              ? "Configurar endereço e credenciais no servidor; validar versão, protocolo e permissões."
              : "Configure server-side address and credentials; verify version, protocol and permissions."}
          </li>
          <li>
            <span className="mr-2 text-cyan-300">03</span>
            {pt
              ? "Começar por leitura de sessões. Habilitar comandos somente após validar a autorização."
              : "Start with read-only sessions. Enable commands only after verifying authorization."}
          </li>
        </ol>
      </div>
    </section>
  );
}
export function AgentOps({ locale = "pt" }: { locale?: Locale }) {
  const pt = locale === "pt";
  const [runs, setRuns] = useState<Run[]>(seedRuns);
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const info = summary(runs);
  const active = runs.some((run) => ["queued", "running"].includes(run.status));
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(
      () => setRuns((current) => current.map(advance)),
      1400,
    );
    return () => clearInterval(timer);
  }, [active]);
  const selectedRun = runs.find((run) => run.id === selected);
  const filtered = runs.filter((run) => {
    const agent = agents.find((item) => item.id === run.agentId)!;
    return (
      (view !== "approvals" || run.status === "approval") &&
      (provider === "all" || agent.provider === provider) &&
      (status === "all" || run.status === status) &&
      (agentFilter === "all" || agent.id === agentFilter) &&
      `${scenarios[run.scenario][locale]} ${agent.name} ${run.id}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
    );
  });
  function navigate(next: View) {
    setView(next);
    setSearch("");
    setProvider("all");
    setStatus("all");
    setAgentFilter("all");
  }
  function start(scenario: Scenario, agent: string, attempt = 0) {
    const run = createRun(scenario, agent, crypto.randomUUID(), attempt);
    setRuns((current) => [run, ...current]);
    setCreating(false);
    setSelected(run.id);
  }
  function updateRun(id: string, fn: (run: Run) => Run) {
    setRuns((current) => current.map((run) => (run.id === id ? fn(run) : run)));
  }
  const nav = [
    { id: "overview", pt: "Visão geral", en: "Overview", icon: Layers3 },
    { id: "runs", pt: "Execuções", en: "Executions", icon: Workflow },
    { id: "agents", pt: "Agentes", en: "Agents", icon: Bot },
    { id: "approvals", pt: "Aprovações", en: "Approvals", icon: ShieldCheck },
    { id: "connections", pt: "Conexões", en: "Connections", icon: Network },
  ] as const;
  return (
    <main className="min-h-screen bg-[#090e15] text-zinc-200 selection:bg-cyan-300/20">
      <div className="flex">
        <aside className="hidden min-h-screen w-52 shrink-0 flex-col border-r border-white/[0.07] bg-[#0c1119] px-4 py-7 xl:flex">
          <div className="mb-10 flex items-center gap-3 px-2">
            <span className="rounded-lg bg-cyan-300 p-2 text-slate-950">
              <Radio size={22} />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              agent<span className="text-cyan-300">ops</span>
              <span className="ml-1 text-xs text-zinc-600">/</span>
            </span>
          </div>
          <p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">
            Control center
          </p>
          <nav className="space-y-1">
            {nav.map((item) => (
              <button
                key={item.id}
                aria-label={item[locale]}
                onClick={() => navigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-xs ${view === item.id ? "bg-cyan-300/10 text-cyan-200" : "text-zinc-500 hover:bg-white/5 hover:text-white"}`}
              >
                <item.icon size={16} />
                {item[locale]}
                {item.id === "approvals" && info.approvals > 0 && (
                  <span className="ml-auto rounded bg-amber-300/15 px-1.5 text-[10px] text-amber-300">
                    {info.approvals}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto pt-12">
            <div className="rounded-xl border border-white/10 p-4">
              <CircleHelp size={17} className="mb-3 text-cyan-300" />
              <p className="text-xs font-medium">
                {pt ? "Explore sem configurar" : "Explore without setup"}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                {pt
                  ? "Simule tarefas, acompanhe eventos e decida o próximo passo."
                  : "Simulate tasks, follow events and decide what happens next."}
              </p>
            </div>
            <a
              href="https://github.com/thalesakano/agent-ops"
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex items-center justify-between px-2 text-[11px] text-zinc-500"
            >
              GitHub
              <ArrowUpRight size={13} />
            </a>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4 md:px-8">
            <p className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="text-zinc-300">Agent Ops</span>
              <ChevronRight size={12} />
              {nav.find((item) => item.id === view)?.[locale]}
            </p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-cyan-300">
                <span className="h-1 w-1 rounded-full bg-cyan-300" />
                {pt ? "Modo demonstração" : "Demo mode"}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-[9px]">
                TS
              </span>
            </div>
          </header>
          <nav
            aria-label={pt ? "Navegação Agent Ops" : "Agent Ops navigation"}
            className="flex gap-1 overflow-x-auto border-b border-white/5 p-3 xl:hidden"
          >
            {nav.map((item) => (
              <button
                key={item.id}
                aria-label={item[locale]}
                onClick={() => navigate(item.id)}
                className={`${opsButton} shrink-0 ${view === item.id ? "!border-cyan-300/20 !text-cyan-300" : ""}`}
              >
                <item.icon size={14} />
                {item[locale]}
              </button>
            ))}
          </nav>
          <div className="mx-auto max-w-[1500px] p-5 md:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
              <div>
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                  Observe. Understand. Act.
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
                  {view === "overview"
                    ? pt
                      ? "Seus agentes. Uma visão clara."
                      : "Your agents. One clear view."
                    : nav.find((item) => item.id === view)?.[locale]}
                </h1>
                <p className="mt-3 text-sm text-zinc-500">
                  {pt
                    ? "Da primeira instrução ao resultado. Cada execução, sob seu olhar."
                    : "From first instruction to outcome. Every execution in sight."}
                </p>
              </div>
              <button
                onClick={() => setCreating(true)}
                className={`${opsButton} !border-cyan-300 !bg-cyan-300 !px-4 !py-3 !text-slate-950`}
              >
                <Plus size={15} />
                {pt ? "Simular tarefa" : "Simulate task"}
              </button>
            </div>
            <div className="mb-7 flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-[11px] leading-5 text-zinc-500">
              <GitBranch
                size={14}
                className="mt-0.5 shrink-0 text-cyan-300/60"
              />
              {pt
                ? "Ambiente fictício · Nenhum agente conectado · Tokens e resultados simulados · Reiniciar a página restaura os exemplos."
                : "Fictional environment · No agents connected · Simulated tokens and outcomes · Reload restores examples."}
            </div>
            {view === "connections" ? (
              <Connections locale={locale} />
            ) : (
              <>
                {view === "overview" && (
                  <>
                    <section
                      aria-label={
                        pt ? "Indicadores simulados" : "Simulated metrics"
                      }
                      className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4"
                    >
                      {[
                        {
                          label: pt ? "Em execução" : "Running",
                          value: info.active,
                          sub: pt
                            ? "Tarefas em andamento"
                            : "Tasks in progress",
                          icon: Activity,
                          color: "text-cyan-300",
                        },
                        {
                          label: pt ? "Taxa de conclusão" : "Completion rate",
                          value: `${info.rate}%`,
                          sub: pt
                            ? "Concluídas / finalizadas"
                            : "Completed / terminal runs",
                          icon: CheckCheck,
                          color: "text-emerald-300",
                        },
                        {
                          label: pt
                            ? "Aguardando decisão"
                            : "Awaiting decision",
                          value: info.approvals,
                          sub: pt
                            ? "Aprovações pendentes"
                            : "Pending approvals",
                          icon: ShieldCheck,
                          color: "text-amber-300",
                        },
                        {
                          label: pt ? "Tokens simulados" : "Simulated tokens",
                          value: `${(info.tokens / 1000).toFixed(1)}k`,
                          sub: pt
                            ? "Consumo fictício acumulado"
                            : "Cumulative fictional usage",
                          icon: Cpu,
                          color: "text-violet-300",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-white/10 bg-[#10161f] p-4 md:p-5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                            <span>{item.label}</span>
                            <item.icon size={16} className={item.color} />
                          </div>
                          <p className="mt-4 font-mono text-3xl font-medium tracking-tight text-zinc-100">
                            {item.value}
                          </p>
                          <p className="mt-3 text-[10px] text-zinc-600">
                            {item.sub}
                          </p>
                        </div>
                      ))}
                    </section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-medium">
                        {pt ? "Sua equipe de agentes" : "Your agent team"}
                      </h2>
                      <span className="font-mono text-[10px] text-zinc-600">
                        03 {pt ? "AGENTES DEMO" : "DEMO AGENTS"}
                      </span>
                    </div>
                  </>
                )}
                {(view === "agents" || view === "overview") && (
                  <AgentCards
                    locale={locale}
                    runs={runs}
                    onSelect={(id) => {
                      navigate("runs");
                      setAgentFilter(id);
                    }}
                  />
                )}
                {view !== "agents" && (
                  <section className="mt-8">
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="text-sm font-medium">
                        {view === "approvals"
                          ? pt
                            ? "Fila de aprovações"
                            : "Approval queue"
                          : pt
                            ? "Execuções recentes"
                            : "Recent executions"}
                      </h2>
                      <span className="font-mono text-[10px] text-zinc-600">
                        {filtered.length} {pt ? "REGISTROS" : "RECORDS"}
                      </span>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-3">
                      <label className="relative min-w-48 flex-1">
                        <Search
                          size={14}
                          className="absolute left-3 top-3 text-zinc-600"
                        />
                        <input
                          type="search"
                          aria-label={
                            pt ? "Buscar execuções" : "Search executions"
                          }
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder={
                            pt
                              ? "Buscar tarefa, agente ou ID…"
                              : "Search task, agent or ID…"
                          }
                          className={`${selectStyle} w-full pl-9`}
                        />
                      </label>
                      <select
                        aria-label={pt ? "Filtrar provedor" : "Filter provider"}
                        value={provider}
                        onChange={(event) => setProvider(event.target.value)}
                        className={selectStyle}
                      >
                        <option value="all">
                          {pt ? "Todos os provedores" : "All providers"}
                        </option>
                        <option>OpenClaw</option>
                        <option>Hermes</option>
                      </select>
                      {view !== "approvals" && (
                        <select
                          aria-label={pt ? "Filtrar estado" : "Filter status"}
                          value={status}
                          onChange={(event) => setStatus(event.target.value)}
                          className={selectStyle}
                        >
                          <option value="all">
                            {pt ? "Todos os estados" : "All statuses"}
                          </option>
                          {Object.entries(statusNames[locale]).map(
                            ([id, label]) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      )}
                      {agentFilter !== "all" && (
                        <button
                          onClick={() => setAgentFilter("all")}
                          className={opsButton}
                        >
                          {agents.find((a) => a.id === agentFilter)?.name}
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                      <table className="w-full min-w-[670px] text-left text-xs">
                        <thead className="border-b border-white/10 bg-white/[0.025] text-[10px] uppercase tracking-wider text-zinc-600">
                          <tr>
                            {[
                              pt ? "Tarefa / execução" : "Task / execution",
                              pt ? "Agente" : "Agent",
                              pt ? "Estado" : "Status",
                              "Tokens",
                              pt ? "Eventos" : "Events",
                            ].map((label) => (
                              <th
                                key={label}
                                scope="col"
                                className="px-5 py-4 font-medium"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filtered.map((run) => {
                            const agent = agents.find(
                              (a) => a.id === run.agentId,
                            )!;
                            return (
                              <tr
                                key={run.id}
                                className="hover:bg-white/[0.025]"
                              >
                                <td className="px-5 py-4">
                                  <button
                                    onClick={() => setSelected(run.id)}
                                    className="text-left font-medium text-zinc-200 hover:text-cyan-300"
                                  >
                                    {scenarios[run.scenario][locale]}
                                  </button>
                                  <p className="mt-2 font-mono text-[9px] text-zinc-600">
                                    {run.id.slice(0, 12)} · #{run.attempt + 1}
                                  </p>
                                </td>
                                <td className="px-5 py-4 text-zinc-400">
                                  {agent.name}
                                  <span className="mt-1 block text-[10px] text-zinc-600">
                                    {agent.provider}
                                  </span>
                                </td>
                                <td className="px-5 py-4">
                                  <StatusBadge run={run} locale={locale} />
                                </td>
                                <td className="px-5 py-4 font-mono text-zinc-500">
                                  {run.tokens.toLocaleString()}
                                </td>
                                <td className="px-5 py-4 font-mono text-zinc-500">
                                  {run.events.length}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filtered.length === 0 && (
                        <p className="px-5 py-12 text-center text-sm text-zinc-500">
                          {pt
                            ? "Nenhuma execução encontrada."
                            : "No executions found."}
                        </p>
                      )}
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[10px] text-zinc-600">
                      <span className="flex items-center gap-2">
                        <Terminal size={13} />
                        {pt
                          ? "Abra uma execução para inspecionar eventos e ferramentas."
                          : "Open an execution to inspect events and tools."}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <RotateCcw size={11} />
                        {pt
                          ? "Atualização automática da simulação"
                          : "Simulation updates automatically"}
                      </span>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {creating && (
        <NewRun
          locale={locale}
          onClose={() => setCreating(false)}
          onStart={start}
        />
      )}{" "}
      {selectedRun && (
        <RunDetail
          key={selectedRun.id}
          run={selectedRun}
          locale={locale}
          onClose={() => setSelected(null)}
          onDecision={(approved) =>
            updateRun(selectedRun.id, (run) => decide(run, approved))
          }
          onCancel={() => updateRun(selectedRun.id, cancel)}
          onRetry={() =>
            start(
              selectedRun.scenario,
              selectedRun.agentId,
              selectedRun.attempt + 1,
            )
          }
        />
      )}
    </main>
  );
}
