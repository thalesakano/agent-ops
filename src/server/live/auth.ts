import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Env } from "./common";

export const SESSION_COOKIE = "agent_ops_session";
export const SESSION_SECONDS = 8 * 3600;
export function authConfigured(env: Env = process.env) {
  return (
    (env.AGENT_OPS_PASSWORD?.length ?? 0) >= 16 &&
    (env.AGENT_OPS_SESSION_SECRET?.length ?? 0) >= 32
  );
}
function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export function validPassword(password: string, env: Env = process.env) {
  return (
    authConfigured(env) &&
    password.length <= 1024 &&
    equal(password, env.AGENT_OPS_PASSWORD!)
  );
}
function signature(payload: string, env: Env) {
  // Changing either secret invalidates every existing session.
  return createHmac("sha256", env.AGENT_OPS_SESSION_SECRET!)
    .update(env.AGENT_OPS_PASSWORD!)
    .update("\0")
    .update(payload)
    .digest("base64url");
}
export function issueSession(env: Env = process.env, now = Date.now()) {
  if (!authConfigured(env))
    throw new Error("Operator authentication is not configured");
  const payload = `${now + SESSION_SECONDS * 1000}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload, env)}`;
}
export function verifySession(
  cookie: string | undefined,
  env: Env = process.env,
  now = Date.now(),
) {
  if (!authConfigured(env) || !cookie || cookie.length > 250) return false;
  const parts = cookie.split(".");
  if (parts.length !== 3) return false;
  const expiry = Number(parts[0]);
  return (
    Number.isSafeInteger(expiry) &&
    expiry > now &&
    expiry <= now + SESSION_SECONDS * 1000 &&
    equal(parts[2], signature(parts.slice(0, 2).join("."), env))
  );
}

// A process-wide ceiling avoids trusting spoofable forwarding headers. For multiple
// replicas, also rate-limit at the reverse proxy (documented in README).
let attempts: number[] = [];
export function allowLogin(now = Date.now()) {
  attempts = attempts.filter((at) => at > now - 60_000);
  if (attempts.length >= 10) return false;
  attempts.push(now);
  return true;
}
