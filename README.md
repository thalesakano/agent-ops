# Agent Ops

A presentation-ready agent operations dashboard by Thales Sakano. Built with Next.js 16, React 19, TypeScript and Tailwind. The same UI is featured as the third project in Sakano Lab.

**This release is an interactive simulation, not a live OpenClaw or Hermes client.** It never requests tokens, connects to agents or executes external commands. Agent identities, tools, token counts, events and reports are fictional. Reloading the page resets the demo.

## Run locally

Requires Node.js 22+.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No environment variables or provider accounts required for the demo.

## Try it

- Inspect the agent roster and execution history.
- Simulate an integration investigation: it pauses until you approve or reject the proposed action.
- Simulate a payment audit: first attempt fails; retry creates a separate successful attempt.
- Cancel an active run or download the completed simulation report.
- Filter by provider/status, search tasks, and switch between Portuguese and English.

Metrics derive from simulated runs. Completion rate is completed runs divided by terminal runs (completed, failed, rejected, cancelled), excluding active and approval-waiting runs. No chain-of-thought is collected or presented; the timeline contains only authored operational demo events.

## Can it connect to my OpenClaw?

The architecture can be extended with a **server-side connector**, but authenticated live integration is **not implemented** in this release. A reachable Control UI alone does not prove an authenticated connection.

The included transport-only probe checks for a Gateway WebSocket challenge. It sends no commands and does not authenticate:

```sh
OPENCLAW_GATEWAY_URL=wss://your-gateway.example.com/ npm run probe:openclaw
```

PowerShell:

```powershell
$env:OPENCLAW_GATEWAY_URL = 'wss://your-gateway.example.com/'
npm run probe:openclaw
```

Never place tokens in URLs, `NEXT_PUBLIC_` variables, source code or the public demo. A future private backend must validate Gateway protocol version, perform the documented challenge/authentication flow, honor device pairing and request only needed scopes. Start with status/session read access behind operator authentication. Keep public simulated data separate from private real-agent data.

- [OpenClaw Gateway protocol](https://docs.openclaw.ai/gateway/protocol)
- [Hermes dashboard API](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)

Hermes needs its own version-aware authenticated API adapter. Providers do not necessarily expose equivalent operations. No adapter is claimed to exist here.

## Verify

```sh
npm test
npm run lint
npm run build
```

With the app running, browser checks use Playwright Chromium:

```sh
npx playwright install chromium
TEST_BASE_URL=http://localhost:3000 AGENT_OPS_PATH=/ npm run test:browser
```

Set those two environment variables with your shell's syntax. Test screenshots are ignored by git.

## Structure

- `src/features/agent-ops/model.ts`: pure simulation state transitions.
- `src/features/agent-ops/AgentOps.tsx`: dashboard, filters, agent roster, connection guidance.
- `src/features/agent-ops/RunDetail.tsx`: operational timeline, decisions and JSON report.
- `scripts/probe-openclaw.mjs`: optional read-only network diagnostic.

Production build: `npm run build` then `npm start`. No deployment, real-agent backend or hosted service is provisioned by this repository.
