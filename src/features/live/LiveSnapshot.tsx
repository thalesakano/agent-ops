import { useState } from "react";
import { Activity, Bot, Database } from "lucide-react";
import type { Snapshot } from "../../server/live/common";

const panel = "rounded-2xl border border-white/10 bg-white/[0.025]";
export function LiveSnapshot({ snapshot }: { snapshot: Snapshot }) {
  const [filter, setFilter] = useState("");
  const sessions = snapshot.sessions.filter((item) =>
    `${item.id} ${item.title} ${item.model ?? ""}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Activity, label: "Conexão", value: snapshot.gatewayState },
          {
            icon: Database,
            label: "Sessões retornadas",
            value: String(snapshot.sessions.length),
          },
          {
            icon: Bot,
            label: "Versão do provedor",
            value: snapshot.version ?? "Não informada",
          },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className={`${panel} p-5`}>
            <p className="flex items-center gap-2 text-xs text-zinc-400">
              <Icon size={15} />
              {label}
            </p>
            <p className="mt-3 break-words text-xl font-medium">{value}</p>
          </div>
        ))}
      </section>
      {snapshot.provider === "openclaw" && (
        <section className={`${panel} mt-6 p-5`}>
          <h2 className="mb-4 font-medium">
            Agentes configurados ({snapshot.agents.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {snapshot.agents.map((agent) => (
              <span
                key={agent.id}
                className="max-w-full break-words rounded-lg border border-white/10 px-3 py-2 text-sm"
              >
                <span className="text-cyan-200">{agent.name}</span>
                <span className="ml-2 text-xs text-zinc-500">{agent.id}</span>
              </span>
            ))}
            {!snapshot.agents.length && (
              <p className="text-sm text-zinc-500">
                Nenhum agente retornado pelo gateway.
              </p>
            )}
          </div>
        </section>
      )}
      <section className={`${panel} mt-6 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <h2 className="font-medium">Sessões</h2>
          <input
            aria-label="Buscar sessões"
            placeholder="Buscar por nome, ID ou modelo"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-cyan-300 sm:w-72"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-y border-white/10 bg-white/[0.025] text-xs text-zinc-500">
              <tr>
                {["Sessão", "Modelo", "Atividade", "Tokens", "Atualização"].map(
                  (label) => (
                    <th key={label} className="px-5 py-3 font-normal">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {sessions.map((item) => (
                <tr key={item.id} className="border-b border-white/5">
                  <td className="max-w-xs break-words px-5 py-4">
                    <p>{item.title || item.id}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.id}</p>
                  </td>
                  <td className="max-w-40 break-words px-5 py-4 text-zinc-400">
                    {item.model ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-400">
                    {item.state === "active"
                      ? "Ativa"
                      : item.state === "idle"
                        ? "Inativa"
                        : "Não informada"}
                  </td>
                  <td className="px-5 py-4 tabular-nums">
                    {item.tokens?.toLocaleString("pt-BR") ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-400">
                    {item.updatedAt
                      ? new Date(item.updatedAt).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!sessions.length && (
          <p className="p-8 text-center text-sm text-zinc-500">
            Nenhuma sessão encontrada.
          </p>
        )}
        <p className="border-t border-white/10 p-5 text-xs leading-5 text-zinc-500">
          {snapshot.note}
        </p>
      </section>
    </>
  );
}
