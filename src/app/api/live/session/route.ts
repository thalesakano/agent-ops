import type { NextRequest } from "next/server";
import {
  allowLogin,
  authConfigured,
  issueSession,
  SESSION_COOKIE,
  SESSION_SECONDS,
  validPassword,
} from "../../../../server/live/auth";
import {
  appOrigin,
  authenticated,
  json,
  sameOrigin,
} from "../../../../server/live/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const loggedIn = authenticated(request);
  return json({
    authenticated: loggedIn,
    configured: authConfigured() && !!appOrigin(request),
    ...(loggedIn
      ? {
          providers: {
            openclaw: !!process.env.OPENCLAW_GATEWAY_URL,
            hermes: !!process.env.HERMES_DASHBOARD_URL,
          },
        }
      : {}),
  });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return json(
      { error: "Origem inválida. Confira AGENT_OPS_ORIGIN no servidor." },
      403,
    );
  if (!authConfigured())
    return json(
      { error: "Configure a autenticação do operador no servidor." },
      503,
    );
  if (!allowLogin())
    return json({ error: "Muitas tentativas. Aguarde um minuto." }, 429);
  let password: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Senha obrigatória." }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 2048) {
        await reader.cancel();
        return json({ error: "Solicitação muito grande." }, 413);
      }
      chunks.push(chunk.value);
    }
    password = JSON.parse(Buffer.concat(chunks).toString("utf8")).password;
  } catch {
    return json({ error: "Solicitação inválida." }, 400);
  }
  if (typeof password !== "string" || !validPassword(password))
    return json({ error: "Senha inválida." }, 401);
  const response = json({ authenticated: true });
  response.cookies.set(SESSION_COOKIE, issueSession(), {
    httpOnly: true,
    secure: appOrigin(request)!.startsWith("https:"),
    sameSite: "strict",
    path: "/api/live",
    maxAge: SESSION_SECONDS,
  });
  return response;
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const response = json({ authenticated: false });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: appOrigin(request)!.startsWith("https:"),
    sameSite: "strict",
    path: "/api/live",
    maxAge: 0,
  });
  return response;
}
