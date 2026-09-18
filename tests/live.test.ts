import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPublicKey, verify } from "node:crypto";
import { WebSocketServer } from "ws";
import { openclawSnapshot } from "../src/server/live/openclaw";
import { hermesSnapshot } from "../src/server/live/hermes";
import { loadIdentity } from "../src/server/live/identity";
import {
  issueSession,
  verifySession,
  validPassword,
} from "../src/server/live/auth";
import { endpoint } from "../src/server/live/common";

test("operator authentication fails closed and rejects tampered/expired cookies", () => {
  const env = {
    AGENT_OPS_PASSWORD: "a-long-test-password",
    AGENT_OPS_SESSION_SECRET: "s".repeat(48),
  };
  assert.equal(validPassword("anything", {}), false);
  assert.equal(validPassword(env.AGENT_OPS_PASSWORD, env), true);
  assert.equal(validPassword("wrong", env), false);
  const cookie = issueSession(env, 1000);
  assert.equal(verifySession(cookie, env, 1001), true);
  assert.equal(verifySession(cookie + "x", env, 1001), false);
  assert.equal(verifySession(cookie, env, 1000 + 9 * 3600 * 1000), false);
  assert.equal(verifySession(cookie, {}, 1001), false);
});

test("endpoints reject cleartext remote hosts and URL credentials", () => {
  assert.throws(() => endpoint("http://example.com", "http"));
  assert.throws(() => endpoint("https://token@example.com", "http"));
  assert.throws(() => endpoint("https://example.com/?token=secret", "http"));
  assert.equal(endpoint("ws://127.0.0.1:1234", "ws").protocol, "ws:");
});

test("OpenClaw signs the challenge and reads only agents/sessions; identity survives reconnect", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ops-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "device.json");
  const device = await loadIdentity(file);
  assert.equal((await loadIdentity(file)).id, device.id);
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(() => {
    for (const client of server.clients) client.terminate();
    server.close();
  });
  const calls: string[] = [];
  server.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "event",
        event: "connect.challenge",
        payload: { nonce: "test-nonce", ts: 1000 },
      }),
    );
    socket.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      calls.push(msg.method);
      let payload;
      if (msg.method === "connect") {
        const p = msg.params;
        assert.deepEqual(p.scopes, ["operator.read"]);
        assert.equal(p.auth.token, "test-gateway-token");
        assert.equal(p.device.signedAt, 1000);
        const data = [
          "v3",
          device.id,
          "cli",
          "backend",
          "operator",
          "operator.read",
          "1000",
          "test-gateway-token",
          "test-nonce",
          process.platform,
          "",
        ].join("|");
        const publicKey = createPublicKey({
          key: Buffer.concat([
            Buffer.from("302a300506032b6570032100", "hex"),
            Buffer.from(p.device.publicKey, "base64url"),
          ]),
          type: "spki",
          format: "der",
        });
        assert.equal(
          verify(
            null,
            Buffer.from(data),
            publicKey,
            Buffer.from(p.device.signature, "base64url"),
          ),
          true,
        );
        payload = {
          type: "hello-ok",
          protocol: 3,
          server: { version: "test" },
          auth: { scopes: ["operator.read"] },
        };
      } else if (msg.method === "agents.list")
        payload = {
          agents: [{ id: "main", name: "Main", secret: "never-send" }],
        };
      else if (msg.method === "sessions.list")
        payload = {
          sessions: [
            {
              key: "agent:main:main",
              label: "Example",
              model: "test-model",
              totalTokens: 23,
              systemPrompt: "never-send",
            },
          ],
        };
      else assert.fail("Unexpected RPC: " + msg.method);
      socket.send(
        JSON.stringify({ type: "res", id: msg.id, ok: true, payload }),
      );
    });
  });
  const port = (server.address() as { port: number }).port;
  const snapshot = await openclawSnapshot({
    OPENCLAW_GATEWAY_URL: `ws://127.0.0.1:${port}`,
    OPENCLAW_TOKEN: "test-gateway-token",
    OPENCLAW_DEVICE_FILE: file,
  });
  assert.equal(snapshot.sessions[0].title, "Example");
  assert.equal(snapshot.sessions[0].tokens, 23);
  assert.equal(snapshot.agents[0].id, "main");
  assert.deepEqual(calls, ["connect", "agents.list", "sessions.list"]);
  assert.ok(!JSON.stringify(snapshot).includes("never-send"));
  assert.ok(!JSON.stringify(snapshot).includes("test-gateway-token"));
});

test("OpenClaw reports pairing safely and times out silent gateways", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ops-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(() => {
    for (const client of server.clients) client.terminate();
    server.close();
  });
  let silent = false;
  server.on("connection", (socket) => {
    if (silent) return;
    socket.send(
      JSON.stringify({
        type: "event",
        event: "connect.challenge",
        payload: { nonce: "nonce", ts: 1000 },
      }),
    );
    socket.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      socket.send(
        JSON.stringify({
          type: "res",
          id: msg.id,
          ok: false,
          error: {
            code: "NOT_PAIRED",
            message: "secret upstream detail",
            details: { code: "PAIRING_REQUIRED", requestId: "request-123" },
          },
        }),
      );
    });
  });
  const env = {
    OPENCLAW_GATEWAY_URL: `ws://127.0.0.1:${(server.address() as { port: number }).port}`,
    OPENCLAW_TOKEN: "test-token",
    OPENCLAW_DEVICE_FILE: join(dir, "device.json"),
  };
  await assert.rejects(
    openclawSnapshot(env),
    (error: unknown) =>
      String(error).includes("pareamento") && !String(error).includes("secret"),
  );
  silent = true;
  await assert.rejects(openclawSnapshot(env, 100), /tempo/i);
});

test("Hermes logs into its password provider and reads authenticated sessions", async (t) => {
  const calls: string[] = [];
  const server = createServer(async (req, res) => {
    calls.push(req.url!);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/auth/password-login") {
      let body = "";
      for await (const chunk of req) body += chunk;
      assert.deepEqual(JSON.parse(body), {
        provider: "basic",
        username: "operator",
        password: "test-password",
      });
      res.setHeader("Set-Cookie", [
        "hermes_session_at=test-access; HttpOnly; Path=/",
        "hermes_session_provider=basic; Path=/",
      ]);
      res.end('{"ok":true}');
    } else {
      assert.ok(req.headers.cookie?.includes("hermes_session_at=test-access"));
      if (req.url === "/api/status")
        res.end(
          '{"version":"test","gateway_running":true,"secret":"never-send"}',
        );
      else
        res.end(
          JSON.stringify({
            sessions: [
              {
                id: "session-1",
                title: "Live session",
                model: "test-model",
                input_tokens: 8,
                output_tokens: 5,
                is_active: true,
                system_prompt: "never-send",
              },
            ],
            total: 1,
          }),
        );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const snapshot = await hermesSnapshot({
    HERMES_DASHBOARD_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    HERMES_AUTH_MODE: "password",
    HERMES_AUTH_PROVIDER: "basic",
    HERMES_USERNAME: "operator",
    HERMES_PASSWORD: "test-password",
  });
  assert.equal(snapshot.sessions[0].tokens, 13);
  assert.equal(snapshot.sessions[0].state, "active");
  assert.ok(calls.includes("/auth/password-login"));
  assert.ok(!JSON.stringify(snapshot).includes("never-send"));
  assert.ok(!JSON.stringify(snapshot).includes("test-access"));
});

test("Hermes rejects redirects, unauthorized and unexpected responses instead of showing connected", async (t) => {
  let status = 302;
  const server = createServer((_req, res) => {
    res.writeHead(status, {
      Location: "https://example.com/login",
      "Content-Type": "application/json",
    });
    res.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const env = {
    HERMES_DASHBOARD_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    HERMES_AUTH_MODE: "cookie",
    HERMES_SESSION_COOKIE: "hermes_session_at=test-access",
  };
  await assert.rejects(hermesSnapshot(env), /redirecionamento/i);
  status = 401;
  await assert.rejects(hermesSnapshot(env), /autenticação/i);
  status = 200;
  await assert.rejects(hermesSnapshot(env), /resposta/i);
});

test("Hermes reuses password sessions and preserves rotated cookies across refreshes", async (t) => {
  let logins = 0,
    expectedCookie = "initial";
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/auth/password-login") {
      logins++;
      res.setHeader("Set-Cookie", "hermes_session_at=initial; Path=/");
      res.end('{"ok":true}');
      return;
    }
    assert.ok(
      req.headers.cookie?.includes(`hermes_session_at=${expectedCookie}`),
    );
    if (req.url?.startsWith("/api/sessions")) {
      expectedCookie += "-rotated";
      res.setHeader(
        "Set-Cookie",
        `hermes_session_at=${expectedCookie}; Path=/`,
      );
      res.end('{"sessions":[]}');
    } else res.end('{"version":"test"}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const env = {
    HERMES_DASHBOARD_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    HERMES_AUTH_MODE: "password",
    HERMES_AUTH_PROVIDER: "basic",
    HERMES_USERNAME: "operator",
    HERMES_PASSWORD: "test-password",
  };
  await hermesSnapshot(env);
  await hermesSnapshot(env);
  assert.equal(logins, 1);
});

test("Hermes preserves refresh cookies even when the authenticated endpoint returns 503", async (t) => {
  let failing = true;
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (failing) {
      res.statusCode = 503;
      res.setHeader("Set-Cookie", "hermes_session_at=renewed; Path=/");
      res.end("{}");
    } else {
      assert.ok(req.headers.cookie?.includes("hermes_session_at=renewed"));
      res.end(
        req.url?.startsWith("/api/sessions")
          ? '{"sessions":[]}'
          : '{"version":"test"}',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const env = {
    HERMES_DASHBOARD_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    HERMES_AUTH_MODE: "cookie",
    HERMES_SESSION_COOKIE: "hermes_session_at=initial",
  };
  await assert.rejects(hermesSnapshot(env), /503/);
  failing = false;
  await hermesSnapshot(env);
});
