import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocketServer } from "ws";

const dir = await mkdtemp(join(tmpdir(), "agent-ops-browser-"));
const gateway = new WebSocketServer({ port: 0, host: "127.0.0.1" });
await new Promise((resolve) => gateway.once("listening", resolve));
let paired = false;
gateway.on("connection", (socket) => {
  socket.send(
    JSON.stringify({
      type: "event",
      event: "connect.challenge",
      payload: { ts: Date.now(), nonce: "browser-test" },
    }),
  );
  socket.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    if (!paired) {
      socket.send(
        JSON.stringify({
          type: "res",
          id: msg.id,
          ok: false,
          error: { code: "NOT_PAIRED" },
        }),
      );
      return;
    }
    const payload =
      msg.method === "connect"
        ? {
            type: "hello-ok",
            protocol: 4,
            server: { version: "test-4" },
            auth: { scopes: ["operator.read"] },
          }
        : msg.method === "agents.list"
          ? { agents: [{ id: "main", name: "Meu agente" }] }
          : {
              sessions: [
                {
                  key: "main-session",
                  label: "Investigação de integração",
                  model: "test-model",
                  totalTokens: 420,
                  updatedAt: Date.now(),
                },
              ],
            };
    socket.send(JSON.stringify({ type: "res", id: msg.id, ok: true, payload }));
  });
});
let hermesAllowed = false;
const hermes = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/auth/password-login") {
    res.setHeader(
      "Set-Cookie",
      "hermes_session_at=browser-fixture; HttpOnly; Path=/",
    );
    res.end('{"ok":true}');
  } else if (!hermesAllowed) {
    res.statusCode = 401;
    res.end("{}");
  } else if (req.url === "/api/status")
    res.end('{"version":"test-hermes","gateway_running":true}');
  else
    res.end(
      JSON.stringify({
        sessions: [
          {
            id: "hermes-1",
            title: "Relatório Hermes",
            model: "demo-model",
            input_tokens: 20,
            output_tokens: 10,
            is_active: true,
            started_at: Date.now() / 1000,
          },
        ],
      }),
    );
});
await new Promise((resolve) => hermes.listen(0, "127.0.0.1", resolve));
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString("hex");
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    String(port),
    "-H",
    "127.0.0.1",
  ],
  {
    env: {
      ...process.env,
      AGENT_OPS_ORIGIN: base,
      AGENT_OPS_PASSWORD: password,
      AGENT_OPS_SESSION_SECRET: randomBytes(32).toString("hex"),
      OPENCLAW_GATEWAY_URL: `ws://127.0.0.1:${gateway.address().port}`,
      OPENCLAW_TOKEN: "browser-fixture-token",
      OPENCLAW_PASSWORD: "",
      OPENCLAW_DEVICE_FILE: join(dir, "device.json"),
      HERMES_DASHBOARD_URL: `http://127.0.0.1:${hermes.address().port}`,
      HERMES_AUTH_MODE: "password",
      HERMES_AUTH_PROVIDER: "basic",
      HERMES_USERNAME: "test",
      HERMES_PASSWORD: "fixture-password",
    },
    stdio: "ignore",
    windowsHide: true,
  },
);
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      await fetch(`${base}/api/live/session`)
        .then((r) => r.ok)
        .catch(() => false)
    ) {
      ready = true;
      break;
    }
    await delay(200);
  }
  assert.ok(ready, "Test Next server did not start");
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/live`);
  await page.getByLabel("Senha do operador").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Consultar agora" }).click();
  await page.getByRole("alert").filter({ hasText: "pareamento" }).waitFor();
  paired = true;
  await page.getByRole("button", { name: "Consultar agora" }).click();
  await page.getByText("Investigação de integração", { exact: true }).waitFor();
  await page.getByText("Meu agente", { exact: true }).waitFor();
  await page.getByLabel("Buscar sessões").fill("does-not-exist");
  await page.getByText("Nenhuma sessão encontrada.").waitFor();
  await page.getByLabel("Buscar sessões").fill("");
  await page.screenshot({ path: "tests/live-desktop.png", fullPage: true });
  await page.getByRole("button", { name: /Hermes Dashboard/ }).click();
  assert.equal(
    await page.getByText("Investigação de integração", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Consultar agora" }).click();
  await page.getByRole("alert").filter({ hasText: "autenticação" }).waitFor();
  hermesAllowed = true;
  await page.getByRole("button", { name: "Consultar agora" }).click();
  await page.getByText("Relatório Hermes", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "tests/live-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Page overflows on mobile",
  );
  assert.ok(!(await page.content()).includes("browser-fixture-token"));
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.getByLabel("Senha do operador").waitFor();
  assert.equal(
    (
      await page.request.get(`${base}/api/live/snapshot?provider=openclaw`)
    ).status(),
    401,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Live browser checks passed: login, pairing, providers, auth failure, filtering, mobile, logout.",
  );
} finally {
  await browser?.close();
  server.kill();
  if (server.exitCode === null)
    await new Promise((resolve) => server.once("exit", resolve));
  for (const socket of gateway.clients) socket.terminate();
  gateway.close();
  hermes.closeAllConnections();
  hermes.close();
  await rm(dir, { recursive: true, force: true });
}
