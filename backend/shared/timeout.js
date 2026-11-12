/**
 * Bounded waiting.
 *
 * Every dependency call in this codebase goes through one of these helpers so a
 * half-open socket, a TLS mismatch or a blackholed security group can only ever
 * cost a bounded number of seconds. An unbounded await is a request that never
 * finishes and a log line that never appears — the failure mode this module
 * exists to prevent.
 */

export class TimeoutError extends Error {
  constructor(message = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
    this.code = "TIMEOUT";
    this.status = 504;
  }
}

/** True when `error` came from withDeadline (or a native abort). */
export function isTimeout(error) {
  return error instanceof TimeoutError || error?.code === "TIMEOUT" || error?.name === "AbortError";
}

/**
 * Rejects with TimeoutError after `ms`. The original promise keeps running (JS
 * cannot cancel it), so its eventual rejection is swallowed to avoid an
 * unhandled-rejection crash in a process that has already moved on.
 */
export function withDeadline(promise, ms, message) {
  const target = Promise.resolve(promise);

  if (!Number.isFinite(ms) || ms <= 0) return target;

  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    timer.unref?.();
  });

  return Promise.race([target, timeout]).finally(() => {
    clearTimeout(timer);
    target.catch(() => {});
  });
}

/** Reads a positive integer from the environment, falling back to a default. */
export function envMs(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Sleep helper for bounded retry loops; unref'd so it never pins the process. */
export function sleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}
