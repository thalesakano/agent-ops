import type { NextRequest } from "next/server";
import { authenticated, json } from "../../../../server/live/http";
import { openclawSnapshot } from "../../../../server/live/openclaw";
import { hermesSnapshot } from "../../../../server/live/hermes";
import {
  safeError,
  type Provider,
  type Snapshot,
} from "../../../../server/live/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const inFlight = new Map<Provider, Promise<Snapshot>>();
export async function GET(request: NextRequest) {
  if (!authenticated(request))
    return json(
      { error: "Entre como operador para consultar dados reais." },
      401,
    );
  const provider = request.nextUrl.searchParams.get("provider");
  if (provider !== "openclaw" && provider !== "hermes")
    return json({ error: "Provedor inválido." }, 400);
  try {
    let pending = inFlight.get(provider);
    if (!pending) {
      pending = (
        provider === "openclaw" ? openclawSnapshot() : hermesSnapshot()
      ).finally(() => inFlight.delete(provider));
      inFlight.set(provider, pending);
    }
    return json(await pending);
  } catch (error) {
    return json({ error: safeError(error) }, 502);
  }
}
