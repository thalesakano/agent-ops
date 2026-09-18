import { createHash } from "node:crypto";
import {
  endpoint,
  isLoopback,
  LiveError,
  number,
  record,
  rows,
  text,
  timestamp,
  type Env,
  type Snapshot,
} from "./common";

type Connection = {
  key: string;
  cookies: Map<string, string>;
  authenticated: boolean;
  pending?: Promise<Snapshot>;
};
let connection: Connection | undefined;

export async function hermesSnapshot(
  env: Env = process.env,
  timeout = 15_000,
): Promise<Snapshot> {
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        env.HERMES_DASHBOARD_URL,
        env.HERMES_AUTH_MODE,
        env.HERMES_AUTH_PROVIDER,
        env.HERMES_USERNAME,
        env.HERMES_PASSWORD,
        env.HERMES_SESSION_COOKIE,
      ]),
    )
    .digest("hex");
  if (connection?.key !== key)
    connection = { key, cookies: new Map(), authenticated: false };
  const current = connection;
  if (!current.pending)
    current.pending = readSnapshot(env, timeout, current).finally(() => {
      current.pending = undefined;
    });
  return current.pending;
}

async function readSnapshot(
  env: Env,
  timeout: number,
  connection: Connection,
): Promise<Snapshot> {
  const base = endpoint(env.HERMES_DASHBOARD_URL, "http");
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  const mode = env.HERMES_AUTH_MODE ?? "password";
  if (!["password", "cookie", "local"].includes(mode))
    throw new LiveError(
      "CONFIGURATION",
      "HERMES_AUTH_MODE deve ser password, cookie ou local.",
    );
  if (mode === "local" && !isLoopback(base))
    throw new LiveError(
      "CONFIGURATION",
      "O modo local sem autenticação só é permitido em loopback.",
    );
  const cookieJar = connection.cookies;
  if (mode === "cookie" && !connection.authenticated) {
    if (!env.HERMES_SESSION_COOKIE || /[\r\n]/.test(env.HERMES_SESSION_COOKIE))
      throw new LiveError(
        "CONFIGURATION",
        "Configure HERMES_SESSION_COOKIE no servidor.",
      );
    for (const part of env.HERMES_SESSION_COOKIE.split(";")) {
      const separator = part.indexOf("=");
      if (separator > 0)
        cookieJar.set(
          part.slice(0, separator).trim(),
          part.slice(separator + 1).trim(),
        );
    }
    connection.authenticated = true;
  }
  const signal = AbortSignal.timeout(timeout);
  async function request(
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(new URL(path, base), {
        method: body ? "POST" : "GET",
        redirect: "manual",
        cache: "no-store",
        signal,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookieJar.size
            ? { Cookie: [...cookieJar].map(([k, v]) => `${k}=${v}`).join("; ") }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new LiveError(
        "NETWORK",
        "Não foi possível consultar o Hermes dentro do tempo limite. Verifique rede e endereço.",
      );
    }
    // Authentication may refresh successfully even when the downstream handler fails.
    for (const entry of response.headers.getSetCookie()) {
      const pair = entry.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator > 0) {
        if (
          /;\s*max-age=0(?:;|$)/i.test(entry) ||
          pair.slice(separator + 1) === ""
        )
          cookieJar.delete(pair.slice(0, separator));
        else cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status >= 300 && response.status < 400)
        throw new LiveError(
          "REDIRECT",
          "O Hermes retornou um redirecionamento. Use a URL final do dashboard e revise a autenticação.",
        );
      if ([401, 403].includes(response.status))
        throw new LiveError(
          "AUTHENTICATION",
          "O Hermes recusou a autenticação. Revise usuário/senha ou renove o cookie da sessão.",
        );
      throw new LiveError(
        "UPSTREAM",
        `O dashboard Hermes retornou HTTP ${response.status}. Verifique versão, autenticação e disponibilidade.`,
      );
    }
    // Do not buffer unbounded upstream bodies or follow redirects carrying cookies.
    const reader = response.body?.getReader();
    if (!reader)
      throw new LiveError("PROTOCOL", "Resposta vazia do dashboard Hermes.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          throw new LiveError(
            "PROTOCOL",
            "Resposta do Hermes excedeu o limite de 2 MB.",
          );
        }
        chunks.push(chunk.value);
      }
      return record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch (error) {
      if (error instanceof LiveError) throw error;
      throw new LiveError(
        "PROTOCOL",
        "Resposta inválida do dashboard Hermes. Verifique a versão e a URL da API.",
      );
    }
  }
  async function login() {
    if (
      !env.HERMES_USERNAME ||
      !env.HERMES_PASSWORD ||
      !env.HERMES_AUTH_PROVIDER
    )
      throw new LiveError(
        "CONFIGURATION",
        "Configure HERMES_AUTH_PROVIDER, HERMES_USERNAME e HERMES_PASSWORD.",
      );
    const login = await request("auth/password-login", {
      provider: env.HERMES_AUTH_PROVIDER,
      username: env.HERMES_USERNAME,
      password: env.HERMES_PASSWORD,
    });
    if (login.ok !== true || !cookieJar.size)
      throw new LiveError(
        "AUTHENTICATION",
        "O Hermes não emitiu uma sessão autenticada.",
      );
    connection.authenticated = true;
  }
  if (mode === "password" && !connection.authenticated) await login();
  // /api/status is public. Only a successful protected session listing establishes access.
  let data: Record<string, unknown>;
  try {
    data = await request("api/sessions?limit=100");
  } catch (error) {
    if (
      mode !== "password" ||
      !(error instanceof LiveError) ||
      error.code !== "AUTHENTICATION"
    )
      throw error;
    connection.authenticated = false;
    cookieJar.clear();
    await login();
    data = await request("api/sessions?limit=100");
  }
  const sessions = rows(data.sessions).map((session) => {
    const input = number(session.input_tokens),
      output = number(session.output_tokens);
    return {
      id: text(session.id),
      title: text(session.title, text(session.id)),
      model: text(session.model) || null,
      tokens:
        number(session.total_tokens) ??
        (input !== null && output !== null ? input + output : null),
      updatedAt: timestamp(session.last_active ?? session.started_at, true),
      state:
        session.is_active === true
          ? ("active" as const)
          : session.is_active === false
            ? ("idle" as const)
            : ("unknown" as const),
    };
  });
  const status = await request("api/status");
  return {
    provider: "hermes",
    fetchedAt: new Date().toISOString(),
    version: text(status.version) || null,
    gatewayState:
      status.gateway_running === true
        ? "Gateway ativo"
        : status.gateway_running === false
          ? "Dashboard acessível · gateway parado"
          : "Dashboard acessível",
    agents: [],
    sessions,
    note: "Até 100 sessões do perfil padrão. A API do dashboard não fornece um catálogo de agentes equivalente ao OpenClaw.",
  };
}
