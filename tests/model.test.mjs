import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const code = await readFile(
  new URL("../src/features/agent-ops/model.ts", import.meta.url),
  "utf8",
).catch(() => "export {};");
const { outputText } = ts.transpileModule(code, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const model = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
test("sensitive scenario pauses until explicit approval", () => {
  assert.equal(typeof model.createRun, "function");
  let run = model.createRun("integration", "atlas", "test");
  for (let i = 0; i < 10; i++) run = model.advance(run);
  assert.equal(run.status, "approval");
  assert.equal(model.advance(run), run);
  run = model.decide(run, true);
  for (let i = 0; i < 10; i++) run = model.advance(run);
  assert.equal(run.status, "completed");
});
test("rejecting an approval is terminal and cannot later be approved", () => {
  assert.equal(typeof model.createRun, "function");
  let run = model.createRun("integration", "atlas", "test");
  for (let i = 0; i < 10; i++) run = model.advance(run);
  run = model.decide(run, false);
  assert.equal(run.status, "rejected");
  assert.equal(model.advance(run), run);
  assert.equal(model.decide(run, true), run);
});
test("failure and retry are separate attempts; retry can complete", () => {
  assert.equal(typeof model.createRun, "function");
  let run = model.createRun("audit", "sentinel", "original");
  for (let i = 0; i < 10; i++) run = model.advance(run);
  assert.equal(run.status, "failed");
  let retry = model.createRun(
    run.scenario,
    run.agentId,
    "retry",
    run.attempt + 1,
  );
  for (let i = 0; i < 10; i++) retry = model.advance(retry);
  assert.equal(retry.status, "completed");
  assert.equal(run.id, "original");
});
