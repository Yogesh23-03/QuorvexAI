import { envMs } from "./timeout.js";

/**
 * Keeps a long-running JSON response alive across proxies.
 *
 * THE PROBLEM
 * CloudFront's origin-response timeout is 30s and the ALB idle timeout is 60s.
 * An agent run can take minutes, so a plain `res.json()` at the end is killed
 * long before it is written.
 *
 * THE FIX
 * Send the response head immediately and write a newline every 15s. JSON allows
 * surrounding whitespace, so the client's JSON.parse still succeeds on the
 * final document — the streaming adds nothing the frontend has to understand.
 * Bytes flowing reset both proxy timers.
 *
 * Only start this once the request has passed validation and credit checks, so
 * a 402 "out of credits" still reaches the browser as a real 402 instead of
 * being flattened into a 200.
 */
export function beginKeepAlive(res, options = {}) {
  const intervalMs = options.intervalMs ?? envMs("STREAM_HEARTBEAT_MS", 15000);
  const enabled = options.enabled ?? process.env.NODE_ENV !== "test";

  if (!enabled || intervalMs <= 0 || res.headersSent) {
    return { started: false, stop() {} };
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  // nginx/CloudFront style buffering hints; harmless elsewhere.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const timer = setInterval(() => {
    if (res.writableEnded) return;
    res.write("\n");
  }, intervalMs);
  timer.unref?.();

  return {
    started: true,
    stop() {
      clearInterval(timer);
    },
  };
}

/** Writes the final JSON body and ends the response exactly once. */
export function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  if (res.headersSent) {
    // Status is already on the wire (keep-alive started): the payload carries
    // success:false instead, which the client maps back to an error.
    res.write(JSON.stringify(payload));
    res.end();
    return;
  }
  res.status(status).json(payload);
}

export default beginKeepAlive;
