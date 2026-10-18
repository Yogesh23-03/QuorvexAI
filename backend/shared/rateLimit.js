import redis from "./redis/redis.js";
import { logger } from "./logger.js";

/**
 * Fixed-window rate limiter backed by Redis (in-memory fallback).
 * Fails open: a limiter outage must not take the API down.
 */
export function rateLimit({
  max = 60,
  windowSeconds = 60,
  prefix = "rl",
  keyGenerator = (req) => req.user?.userId || req.ip,
  message = "Too many requests. Please slow down and try again.",
}) {
  return async function limiter(req, res, next) {
    const window = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `${prefix}:${keyGenerator(req)}:${window}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      const ttl = Math.max(await redis.ttl(key), 1);

      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", Math.max(max - count, 0));
      res.setHeader("X-RateLimit-Reset", ttl);

      if (count > max) {
        res.setHeader("Retry-After", ttl);
        const error = new Error(message);
        error.status = 429;
        error.code = "RATE_LIMITED";
        error.details = { retryAfter: ttl };
        return next(error);
      }
    } catch (error) {
      logger.warn({ err: error.message }, "rate limiter unavailable, failing open");
    }

    return next();
  };
}
