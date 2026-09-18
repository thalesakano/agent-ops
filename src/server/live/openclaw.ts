import { randomUUID, sign } from "node:crypto";
import WebSocket from "ws";
import {
  endpoint,
  LiveError,
  number,
  record,
  rows,
  text,
  timestamp,
  type Env,
  type Snapshot,
} from "./common";
import { loadIdentity } from "./identity";

export async function openclawSnapshot(
  env: Env = process.env,
  timeout = 15_000,
): Promise<Snapshot> {
  const url = endpoint(env.OPENCLAW_GATEWAY_URL, "ws");
  const token = env.OPENCLAW_TOKEN;
  const password = env.OPENCLAW_PASSWORD;
  if ((!token && !password) || (token && password))
    throw new LiveError(
      "CONFIGURATION",
      "Configure exatamente uma credencial: OPENCLAW_TOKEN ou OPENCLAW_PASSWORD.",
    );
  const device = await loadIdentity(env.OPENCLAW_DEVICE_FILE);
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, {
      handshakeTimeout: timeout,
      maxPayload: 2 * 1024 * 1024,
      followRedirects: false,
    });
    const pending = new Map<
      string,
      { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();
    let finished = false;
    let challenged = false;
    const finish = (error?: Error, snapshot?: Snapshot) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      for (const promise of pending.values())
        promise.reject(error ?? new Error("Connection closed"));
      pending.clear();
      socket.terminate();
      if (error) reject(error);
      else resolve(snapshot!);
    };
    const timer = setTimeout(
      () =>
        finish(
          new LiveError(
            "TIMEOUT",
            "O gateway excedeu o tempo de resposta. Verifique WebSocket e proxy reverso.",
          ),
        ),
      timeout,
    );
    const rpc = (method: string, params: unknown) =>
      new Promise<unknown>((resolve, reject) => {
        const id = randomUUID();
        pending.set(id, { resolve, reject });
        socket.send(
          JSON.stringify({ type: "req", id, method, params }),
          (error) => {
            if (error)
              finish(
                new LiveError(
                  "NETWORK",
                  "Falha ao enviar a solicitação ao gateway.",
                ),
              );
          },
        );
      });
    socket.on("error", () =>
      finish(
        new LiveError(
          "NETWORK",
          "Não foi possível abrir o WebSocket. Verifique endereço, TLS e proxy reverso.",
        ),
      ),
    );
    socket.on("close", () =>
      finish(
        new LiveError(
          "DISCONNECTED",
          "O gateway encerrou a conexão antes de concluir a consulta.",
        ),
      ),
    );
    socket.on("message", (raw) => {
      if (finished) return;
      let msg: Record<string, unknown>;
      try {
        msg = record(JSON.parse(String(raw)));
      } catch {
        finish(new LiveError("PROTOCOL", "Resposta inválida do gateway."));
        return;
      }
      if (msg.type === "res") {
        const request = pending.get(text(msg.id));
        if (!request) return;
        pending.delete(text(msg.id));
        if (msg.ok === true) request.resolve(msg.payload);
        else {
          const error =
            msg.error && typeof msg.error === "object"
              ? (msg.error as Record<string, unknown>)
              : {};
          const details =
            error.details && typeof error.details === "object"
              ? (error.details as Record<string, unknown>)
              : {};
          const hint = `${text(error.code)} ${text(details.code)} ${text(error.message)}`;
          const pairing = /pair/i.test(hint);
          request.reject(
            new LiveError(
              pairing ? "PAIRING_REQUIRED" : "GATEWAY_REJECTED",
              pairing
                ? `O gateway exige pareamento. Aprove o dispositivo ${device.id} no OpenClaw e atualize a consulta.`
                : "O gateway recusou a solicitação. Verifique credencial, protocolo e escopo operator.read.",
            ),
          );
        }
        return;
      }
      if (
        msg.type !== "event" ||
        msg.event !== "connect.challenge" ||
        challenged
      )
        return;
      challenged = true;
      void (async () => {
        const challenge = record(msg.payload);
        const nonce = text(challenge.nonce);
        if (
          !nonce ||
          !Number.isSafeInteger(challenge.ts) ||
          (challenge.ts as number) < 0
        )
          throw new LiveError(
            "PROTOCOL",
            "Desafio de autenticação inválido do gateway.",
          );
        const scopes = ["operator.read"];
        const payload = [
          "v3",
          device.id,
          "cli",
          "backend",
          "operator",
          scopes.join(","),
          String(challenge.ts),
          token ?? "",
          nonce,
          process.platform,
          "",
        ].join("|");
        const hello = record(
          await rpc("connect", {
            minProtocol: 3,
            maxProtocol: 4,
            client: {
              id: "cli",
              displayName: "Agent Ops",
              version: "0.2.0",
              platform: process.platform,
              mode: "backend",
            },
            role: "operator",
            scopes,
            caps: [],
            commands: [],
            permissions: {},
            auth: token ? { token } : { password },
            device: {
              id: device.id,
              publicKey: device.publicKey,
              signature: sign(
                null,
                Buffer.from(payload),
                device.privateKey,
              ).toString("base64url"),
              signedAt: challenge.ts,
              nonce,
            },
          }),
        );
        if (
          hello.type !== "hello-ok" ||
          ![3, 4].includes(hello.protocol as number)
        )
          throw new LiveError(
            "PROTOCOL",
            "Versão do protocolo OpenClaw incompatível (suportadas: 3 e 4).",
          );
        if (hello.auth) {
          const auth = record(hello.auth);
          if (
            !Array.isArray(auth.scopes) ||
            (!auth.scopes.includes("operator.read") &&
              !auth.scopes.includes("operator.admin"))
          )
            throw new LiveError(
              "SCOPE",
              "O dispositivo não recebeu o escopo operator.read. Revise o pareamento.",
            );
        }
        const agentsData = record(await rpc("agents.list", {}));
        const sessionsData = record(await rpc("sessions.list", { limit: 100 }));
        const agents = rows(agentsData.agents).map((agent) => ({
          id: text(agent.id),
          name: text(agent.name, text(agent.id)),
        }));
        const sessions = rows(sessionsData.sessions).map((session) => ({
          id: text(session.key, text(session.sessionId)),
          title: text(
            session.label,
            text(session.displayName, text(session.key)),
          ),
          model: text(session.model) || null,
          tokens: number(session.totalTokens),
          updatedAt: timestamp(session.updatedAt),
          state: "unknown" as const,
        }));
        finish(undefined, {
          provider: "openclaw",
          fetchedAt: new Date().toISOString(),
          version: hello.server
            ? text(record(hello.server).version) || null
            : null,
          gatewayState: "Conectado e autenticado",
          agents,
          sessions,
          note: "Até 100 sessões. Consulta somente leitura; atividade não é inferida pela data da sessão.",
        });
      })().catch((error) =>
        finish(
          error instanceof LiveError
            ? error
            : new LiveError(
                "PROTOCOL",
                "Não foi possível interpretar a resposta do gateway.",
              ),
        ),
      );
    });
  });
}
