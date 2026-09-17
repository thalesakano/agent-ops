import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const path = process.env.AGENT_OPS_PATH || "/";
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() =>
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.style.scrollBehavior = "auto";
  }),
);
try {
  const response = await page.goto(base + path);
  assert.equal(response.status(), 200);
  await page
    .getByRole("button", { name: "Simular tarefa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iniciar simulação", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Aprovar ação", exact: true })
    .waitFor({ timeout: 15000 });
  await dialog
    .getByRole("button", { name: "Aprovar ação", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Baixar relatório", exact: true })
    .waitFor({ timeout: 15000 });
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Baixar relatório", exact: true })
    .click();
  const file = await download;
  assert.match(file.suggestedFilename(), /\.json$/);
  const report = JSON.parse(await readFile(await file.path(), "utf8"));
  assert.equal(report.mode, "simulation");
  assert.equal(report.status, "completed");
  assert.ok(report.events.some((event) => event.tool === "approval.resolve"));
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Aprovações", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Investigar falha de integração",
      exact: true,
    })
    .first()
    .click();
  await dialog
    .getByRole("button", { name: "Rejeitar ação", exact: true })
    .click();
  await dialog.getByText("Rejeitada", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Execuções", exact: true }).click();
  await page
    .getByRole("button", { name: "Auditar serviço de pagamentos", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Baixar relatório", exact: true })
    .waitFor({ timeout: 15000 });
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page
    .getByRole("button", { name: "Simular tarefa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iniciar simulação", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Cancelar execução", exact: true })
    .click();
  await dialog.getByText("Cancelada", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("searchbox").fill("no-such-run");
  await page
    .getByText("Nenhuma execução encontrada.", { exact: true })
    .waitFor();
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Conexões", exact: true }).click();
  await page
    .getByText("Nenhuma conexão real configurada.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await page.screenshot({
    path: "tests/agent-ops-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "tests/agent-ops-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your agents. One clear view.", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS Agent Ops: run, approval, rejection, report, search, connection disclosure, mobile and language",
  );
} finally {
  await browser.close();
}
