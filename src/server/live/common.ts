export type Env = Record<string, string | undefined>;
export type Provider = "openclaw" | "hermes";
export type LiveSession = {
  id: string;
  title: string;
  model: string | null;
  tokens: number | null;
  updatedAt: string | null;
  state: "active" | "idle" | "unknown";
};
export type Snapshot = {
  provider: Provider;
  fetchedAt: string;
  version: string | null;
  gatewayState: string;
  agents: { id: string; name: string }[];
  sessions: LiveSession[];
  note: string;
};
export class LiveError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "LiveError";
  }
}
export function isLoopback(url: URL) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}
export function endpoint(raw: string | undefined, kind: "http" | "ws") {
  if (!raw)
    throw new LiveError(
      "NOT_CONFIGURED",
      "Configure o endereço do provedor no servidor.",
    );
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LiveError("CONFIGURATION", "Endereço do provedor inválido.");
  }
  const secure = kind === "ws" ? "wss:" : "https:";
  const local = kind === "ws" ? "ws:" : "http:";
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== secure && !(url.protocol === local && isLoopback(url)))
  ) {
    throw new LiveError(
      "CONFIGURATION",
      "Use HTTPS/WSS sem credenciais ou parâmetros na URL. HTTP/WS só é permitido em loopback.",
    );
  }
  return url;
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LiveError("PROTOCOL", "Resposta inesperada do provedor.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, 500) : fallback;
}
export function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
export function timestamp(value: unknown, seconds = false): string | null {
  const millis =
    typeof value === "number"
      ? value * (seconds ? 1000 : 1)
      : typeof value === "string"
        ? Date.parse(value)
        : NaN;
  return Number.isFinite(millis) && Math.abs(millis) < 8640000000000000
    ? new Date(millis).toISOString()
    : null;
}
export function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value))
    throw new LiveError(
      "PROTOCOL",
      "Resposta de sessões/agentes incompatível com esta versão do conector.",
    );
  return value.slice(0, 100).map(record);
}
export function safeError(error: unknown) {
  return error instanceof LiveError
    ? { code: error.code, message: error.message }
    : {
        code: "UNAVAILABLE",
        message:
          "Não foi possível consultar o provedor. Verifique endereço, rede e configuração no servidor.",
      };
}
