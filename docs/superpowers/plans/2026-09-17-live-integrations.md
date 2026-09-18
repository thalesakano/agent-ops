# Agent Ops live integrations

**Goal:** Authenticated, read-only monitoring of OpenClaw and Hermes in the standalone repository.

**Architecture:** Keep `/` as the public simulation. Add `/live` and server-only connectors, protected by an operator password and signed, expiring HTTP-only session cookie. Provider addresses and credentials are environment configuration, never browser inputs. OpenClaw uses a persistent Ed25519 device and challenge handshake, then reads agents and sessions. Hermes authenticates to its dashboard with password-provider cookies or an operator-supplied session cookie; unauthenticated mode is limited to loopback. No generic RPC proxy or task execution.

**Tech stack:** Next.js, TypeScript, Node crypto, ws, tsx and node:test, Playwright.

- [x] Write failing protocol/auth tests against local HTTP and WebSocket servers.
- [x] Implement `src/server/live/{common,identity,openclaw,hermes,auth}.ts` with bounded requests, safe errors, allowlisted output and fail-closed authentication.
- [x] Add `/api/live/session` and `/api/live/snapshot`, then `/live` with login, provider selection, refresh, real agent/session lists and configuration/error guidance.
- [x] Document environment setup, persistent identity, pairing and supported capabilities in README and `.env.example`.
- [x] Run protocol tests, browser checks, lint, build and dependency audit; review and fix findings.
- [x] Prepare reviewed source for publication to the existing public repository. Production credentials and authenticated deployment verification remain operator configuration.

Contract references: OpenClaw gateway protocol/auth and handshake docs; OpenClaw `packages/gateway-client/src/device-auth.ts` and gateway protocol schemas; Hermes `hermes_cli/dashboard_auth/routes.py`, `web_routers/status.py` and `web_routers/sessions.py`.
