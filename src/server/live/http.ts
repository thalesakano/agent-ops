import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./auth";
import { isLoopback } from "./common";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function authenticated(request: NextRequest) {
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value);
}
export function appOrigin(request: NextRequest) {
  try {
    const configured = process.env.AGENT_OPS_ORIGIN;
    const url = new URL(configured ?? request.url);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(isLoopback(url) && url.protocol === "http:"))
    )
      return null;
    if (!configured && !isLoopback(url)) return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function sameOrigin(request: NextRequest) {
  const origin = appOrigin(request);
  return !!origin && request.headers.get("origin") === origin;
}
