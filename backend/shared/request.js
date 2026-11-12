import crypto from "node:crypto";
import { logger } from "./logger.js";
import { envMs } from "./timeout.js";

const MAX_ID_LENGTH = 128;

/**
 * Every request carries an id. The gateway generates one and forwards it as
 * `x-request-id`, so a single browser action can be followed across services.
 * Never trust an oversized or non-string header.
 */
export function requestId(req, res, next) {
  const incoming = req.headers["x-request-id"];
  req.id =
    typeof incoming === "string" && incoming.length > 0 && incoming.length <= MAX_ID_LENGTH
      ? incoming
      : crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
}

/** One structured line per completed request; never logs bodies or headers. */
export function requestLogger(req, res, next) {
  if (process.env.NODE_ENV === "test" || process.env.LOG_LEVEL === "silent") return next();

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info(
      {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      },
      "request completed",
    );
  });

  return next();
}

/**
 * A handler that awaits a wedged dependency must become a logged 503, never a
 * silent hang. This middleware is the last line of defence: if nothing has been
 * sent by the time the budget is spent, the caller gets a clear JSON error and
 * the stuck handler is logged with its path and request id.
 *
 * @param {number} [budgetMs] default REQUEST_TIMEOUT_MS (30s)
 * @param {(req: import("express").Request) => boolean} [skip] routes that
 *        legitimately stream for minutes (agent runs) opt out.
 */
export function requestTimeout(budgetMs = envMs("REQUEST_TIMEOUT_MS", 30000), skip) {
  return function timeoutGuard(req, res, next) {
    if (req.method === "OPTIONS" || (skip && skip(req))) return next();
    if (!Number.isFinite(budgetMs) || budgetMs <= 0) return next();

    const timer = setTimeout(() => {
      if (res.headersSent || res.writableEnded) return;
      logger.error(
        {
          requestId: req.id,
          method: req.method,
          path: req.originalUrl,
          budgetMs,
        },
        "request exceeded its time budget and was answered with 503",
      );
      res.status(503).json({
        success: false,
        error: {
          code: "REQUEST_TIMEOUT",
          message: "That request took too long. Please try again.",
        },
        requestId: req.id,
      });
    }, budgetMs);

    timer.unref?.();
    const clear = () => clearTimeout(timer);
    res.on("finish", clear);
    res.on("close", clear);

    return next();
  };
}
