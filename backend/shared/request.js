import crypto from "node:crypto";
import { logger } from "./logger.js";

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
