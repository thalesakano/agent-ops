import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST, DELETE, GET } from "../src/app/api/live/session/route";
import { GET as snapshot } from "../src/app/api/live/snapshot/route";

test("live APIs require operator login, reject cross-site login, and expire logout cookie", async (t) => {
  const before = { ...process.env };
  process.env.AGENT_OPS_PASSWORD = "route-test-password-123";
  process.env.AGENT_OPS_SESSION_SECRET = "r".repeat(48);
  process.env.AGENT_OPS_ORIGIN = "http://localhost:3000";
  t.after(() => {
    process.env = before;
  });
  const request = (
    path: string,
    init?: ConstructorParameters<typeof NextRequest>[1],
  ) => new NextRequest(`http://localhost:3000/api/live/${path}`, init);
  assert.equal(
    (await snapshot(request("snapshot?provider=hermes"))).status,
    401,
  );
  assert.equal(
    (
      await POST(
        request("session", {
          method: "POST",
          headers: { Origin: "https://attacker.example" },
          body: JSON.stringify({ password: process.env.AGENT_OPS_PASSWORD }),
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await POST(
        request("session", {
          method: "POST",
          headers: { Origin: "http://localhost:3000" },
          body: JSON.stringify({ password: "wrong" }),
        }),
      )
    ).status,
    401,
  );
  const login = await POST(
    request("session", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      body: JSON.stringify({ password: process.env.AGENT_OPS_PASSWORD }),
    }),
  );
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=strict/i);
  assert.equal(login.headers.get("cache-control"), "no-store");
  const headers = {
    Cookie: cookie.split(";", 1)[0],
    Origin: "http://localhost:3000",
  };
  const session = await GET(request("session", { headers }));
  const sessionData = await session.json();
  assert.equal(sessionData.authenticated, true);
  assert.equal(
    (await snapshot(request("snapshot?provider=arbitrary", { headers })))
      .status,
    400,
  );
  const logout = await DELETE(
    request("session", { method: "DELETE", headers }),
  );
  assert.match(logout.headers.get("set-cookie")!, /Max-Age=0/i);
  assert.ok(
    !JSON.stringify(sessionData).includes(process.env.AGENT_OPS_PASSWORD!),
  );
});
