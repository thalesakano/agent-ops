export type Locale = "pt" | "en";
export type Status =
  | "queued"
  | "running"
  | "approval"
  | "completed"
  | "failed"
  | "rejected"
  | "cancelled";
export type Scenario = "integration" | "research" | "audit";
export type Run = {
  id: string;
  scenario: Scenario;
  agentId: string;
  status: Status;
  step: number;
  attempt: number;
  approved: boolean;
  tokens: number;
  events: { pt: string; en: string; tool?: string }[];
};
export const agents = [
  {
    id: "atlas",
    name: "Atlas",
    provider: "OpenClaw",
    role: { pt: "Integrações & operações", en: "Integrations & operations" },
    model: "Model A",
    color: "cyan",
  },
  {
    id: "hermes",
    name: "Hermes",
    provider: "Hermes",
    role: { pt: "Pesquisa & síntese", en: "Research & synthesis" },
    model: "Model B",
    color: "violet",
  },
  {
    id: "sentinel",
    name: "Sentinel",
    provider: "OpenClaw",
    role: { pt: "Qualidade & diagnóstico", en: "Quality & diagnostics" },
    model: "Model A",
    color: "emerald",
  },
] as const;
export const scenarios: Record<Scenario, { pt: string; en: string }> = {
  integration: {
    pt: "Investigar falha de integração",
    en: "Investigate integration failure",
  },
  research: {
    pt: "Pesquisar tendências de mercado",
    en: "Research market trends",
  },
  audit: { pt: "Auditar serviço de pagamentos", en: "Audit payment service" },
};
export const statusNames: Record<Locale, Record<Status, string>> = {
  pt: {
    queued: "Na fila",
    running: "Executando",
    approval: "Aguardando aprovação",
    completed: "Concluída",
    failed: "Falhou",
    rejected: "Rejeitada",
    cancelled: "Cancelada",
  },
  en: {
    queued: "Queued",
    running: "Running",
    approval: "Awaiting approval",
    completed: "Completed",
    failed: "Failed",
    rejected: "Rejected",
    cancelled: "Cancelled",
  },
};
const event = (pt: string, en: string, tool?: string) => ({ pt, en, tool });
export function createRun(
  scenario: Scenario,
  agentId: string,
  id: string,
  attempt = 0,
): Run {
  return {
    id,
    scenario,
    agentId,
    status: "queued",
    step: 0,
    attempt,
    approved: false,
    tokens: 0,
    events: [
      event(
        "Tarefa adicionada à fila de simulação.",
        "Task added to the simulation queue.",
      ),
    ],
  };
}
export function advance(run: Run): Run {
  if (run.status !== "queued" && run.status !== "running") return run;
  const step = run.step + 1;
  let status: Status = "running";
  let next = event(
    "Contexto carregado. Planejando execução.",
    "Context loaded. Planning execution.",
    "context.load",
  );
  if (step === 2) {
    if (run.scenario === "audit" && run.attempt === 0) {
      status = "failed";
      next = event(
        "Timeout simulado ao consultar o serviço. Uma nova tentativa pode recuperar a execução.",
        "Simulated service timeout. A retry can recover this execution.",
        "service.inspect",
      );
    } else
      next =
        run.scenario === "research"
          ? event(
              "Três fontes fictícias consultadas e comparadas.",
              "Three fictional sources reviewed and compared.",
              "search.query",
            )
          : event(
              "Logs de exemplo analisados; identificada configuração divergente.",
              "Sample logs analyzed; configuration mismatch identified.",
              "logs.read",
            );
  }
  if (step === 3 && run.scenario === "integration" && !run.approved) {
    status = "approval";
    next = event(
      "Proposta: reaplicar configuração no ambiente de demonstração. Aguardando decisão humana.",
      "Proposal: reapply configuration in the demo environment. Waiting for human decision.",
      "approval.request",
    );
  } else if (step >= 3) {
    status = "completed";
    next = event(
      "Simulação concluída. Relatório de exemplo disponível.",
      "Simulation completed. Sample report available.",
      "report.create",
    );
  }
  return {
    ...run,
    step,
    status,
    tokens: run.tokens + 480 + step * 120,
    events: [...run.events, next],
  };
}
export function decide(run: Run, approved: boolean): Run {
  if (run.status !== "approval") return run;
  return {
    ...run,
    approved,
    status: approved ? "running" : "rejected",
    events: [
      ...run.events,
      approved
        ? event(
            "Ação aprovada pelo operador (simulação).",
            "Action approved by operator (simulation).",
            "approval.resolve",
          )
        : event(
            "Ação rejeitada; nenhuma alteração aplicada.",
            "Action rejected; no changes applied.",
            "approval.resolve",
          ),
    ],
  };
}
export function cancel(run: Run): Run {
  if (!["queued", "running", "approval"].includes(run.status)) return run;
  return {
    ...run,
    status: "cancelled",
    events: [
      ...run.events,
      event(
        "Execução cancelada pelo operador.",
        "Execution cancelled by operator.",
      ),
    ],
  };
}
export function seedRuns(): Run[] {
  const seed: [Scenario, string, string, number][] = [
    ["integration", "atlas", "demo-006", 3],
    ["research", "hermes", "demo-005", 3],
    ["audit", "sentinel", "demo-004", 2],
    ["research", "hermes", "demo-003", 3],
    ["integration", "atlas", "demo-002", 0],
    ["research", "hermes", "demo-001", 3],
  ];
  return seed.map(([scenario, agent, id, count]) => {
    let run = createRun(scenario, agent, id);
    for (let i = 0; i < count; i++) run = advance(run);
    return id === "demo-002"
      ? {
          ...run,
          status: "cancelled",
          events: [
            ...run.events,
            event(
              "Cancelada na demonstração anterior.",
              "Cancelled in the previous demo.",
            ),
          ],
        }
      : run;
  });
}
export function summary(runs: Run[]) {
  const completed = runs.filter((run) => run.status === "completed").length;
  const terminal = runs.filter((run) =>
    ["completed", "failed", "rejected", "cancelled"].includes(run.status),
  ).length;
  return {
    active: runs.filter((run) => ["queued", "running"].includes(run.status))
      .length,
    approvals: runs.filter((run) => run.status === "approval").length,
    completed,
    rate: terminal ? Math.round((completed / terminal) * 100) : 0,
    tokens: runs.reduce((sum, run) => sum + run.tokens, 0),
  };
}
