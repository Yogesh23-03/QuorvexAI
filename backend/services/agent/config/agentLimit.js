import redis from "../../../shared/redis/redis.js";
import { AGENT_LIMITS } from "../../../shared/constants.js";
import { logger } from "../../../shared/logger.js";

/**
 * Per-user, per-agent fixed-window limiter. Fails open if Redis is down so a
 * cache outage cannot lock every user out of the product.
 */
export async function checkAgentLimit(userId, agent) {
  const max = AGENT_LIMITS[agent] || AGENT_LIMITS.chat;
  const window = Math.floor(Date.now() / 60000);
  const key = `rate:${userId}:${agent}:${window}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 120);

    const ttl = Math.max(await redis.ttl(key), 1);
    if (count > max) {
      const seconds = ttl % 60 || 60;
      const error = new Error(
        `You have reached the ${agent} limit (${max} requests/minute). Try again in ${seconds}s.`,
      );
      error.status = 429;
      error.code = "RATE_LIMITED";
      error.details = { agent, limit: max, retryAfter: ttl };
      throw error;
    }

    return { remaining: Math.max(max - count, 0), limit: max };
  } catch (error) {
    if (error.status === 429) throw error;
    logger.warn({ err: error.message }, "agent rate limiter unavailable, failing open");
    return { remaining: max, limit: max };
  }
}
