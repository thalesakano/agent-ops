// Transport-only diagnostic. No authentication, session requests or commands.
const value = process.env.OPENCLAW_GATEWAY_URL;
if (!value) {
  console.error("Set OPENCLAW_GATEWAY_URL to your wss:// gateway address.");
  process.exit(1);
}
let url;
try {
  url = new URL(value);
} catch {
  console.error("Invalid gateway URL.");
  process.exit(1);
}
if (
  url.protocol !== "wss:" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
) {
  console.error(
    "Use a wss:// URL without credentials, query strings or fragments.",
  );
  process.exit(1);
}
const socket = new WebSocket(url);
let finished = false;
function finish(ok, message) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  console.log(message);
  socket.close();
  process.exitCode = ok ? 0 : 1;
}
const timer = setTimeout(
  () => finish(false, "Timed out before receiving a Gateway challenge."),
  12000,
);
socket.addEventListener("error", () =>
  finish(
    false,
    "WebSocket connection failed. Check DNS, TLS and proxy configuration.",
  ),
);
socket.addEventListener("close", () => {
  if (!finished)
    finish(false, "Connection closed before receiving a challenge.");
});
socket.addEventListener("message", (event) => {
  try {
    const frame = JSON.parse(String(event.data));
    if (
      frame.type === "event" &&
      frame.event === "connect.challenge" &&
      typeof frame.payload?.nonce === "string"
    )
      finish(
        true,
        "Gateway transport reachable. Authentication, permissions and pairing are NOT verified.",
      );
  } catch {
    finish(false, "Unexpected non-JSON Gateway message.");
  }
});
