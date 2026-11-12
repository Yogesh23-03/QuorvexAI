import Redis from "ioredis";
import { logger } from "../logger.js";
import { envMs, withDeadline } from "../timeout.js";

/**
 * Redis access for every QuorvexAI service.
 *
 * WHY THIS FILE IS DEFENSIVE
 * A production ECS deployment hung every auth POST (/register, /login,
 * /refresh) with no log line while GET and OPTIONS kept working. The cache
 * endpoint accepted the TCP connection but never answered — the classic shape
 * of a TLS-only ElastiCache port reached over `redis://`, or a security group
 * that silently drops packets.
 *
 * The old client awaited `ping()` with no command timeout and cached the
 * pending connect promise, so a single half-open socket wedged every
 * Redis-backed request forever: the rate limiter that register/login hit
 * first, the refresh-token store, and /health. Nothing ever failed, so nothing
 * was ever logged.
 *
 * Rules this module now enforces:
 *  - the handshake is bounded (connectTimeout + deadline);
 *  - every command is bounded (commandTimeout + deadline);
 *  - a failed attempt never stays "in flight": the socket is destroyed and the
 *    state moves to `down`;
 *  - while down, callers fail fast with a 503 (RedisUnavailableError) instead
 *    of queueing forever, and a background retry heals the process;
 *  - `rediss://` negotiates TLS with SNI, and a plaintext URL against a TLS
 *    port can only cost one connectTimeout, not a hang.
 */

export class RedisUnavailableError extends Error {
  constructor(message = "The cache is unavailable right now. Please try again in a moment.") {
    super(message);
    this.name = "RedisUnavailableError";
    this.code = "REDIS_UNAVAILABLE";
    this.status = 503;
    // Safe to show: it says nothing about hosts, credentials or internals.
    this.expose = true;
  }
}

/** True for errors that mean "the connection is gone", not "this command failed". */
function isConnectionFailure(error) {
  const code = String(error?.code || "");
  const text = String(error?.message || "").toLowerCase();
  return (
    [
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "EPIPE",
      "ENOTFOUND",
      "EAI_AGAIN",
      "TIMEOUT",
    ].includes(code) ||
    text.includes("connection is closed") ||
    text.includes("stream isn't writeable") ||
    text.includes("timed out") ||
    text.includes("read only") ||
    text.includes("noauth") ||
    text.includes("wrongpass")
  );
}

/** In-process stand-in: only for local runs and tests with no REDIS_URL. */
class MemoryRedis {
  constructor() {
    this.store = new Map();
  }

  sweep(key) {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key) {
    const entry = this.sweep(key);
    return entry ? entry.value : null;
  }

  async set(key, value, ...args) {
    let ttl;
    for (let i = 0; i < args.length; i += 1) {
      if (String(args[i]).toUpperCase() === "EX") ttl = Number(args[i + 1]);
      if (String(args[i]).toUpperCase() === "PX") ttl = Number(args[i + 1]) / 1000;
    }
    this.store.set(key, {
      value: String(value),
      expiresAt: ttl ? Date.now() + ttl * 1000 : null,
    });
    return "OK";
  }

  async del(...keys) {
    let removed = 0;
    keys.flat().forEach((key) => {
      if (this.store.delete(key)) removed += 1;
    });
    return removed;
  }

  async incr(key) {
    const current = Number((await this.get(key)) || 0) + 1;
    const entry = this.sweep(key);
    this.store.set(key, { value: String(current), expiresAt: entry ? entry.expiresAt : null });
    return current;
  }

  async expire(key, seconds) {
    const entry = this.sweep(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + Number(seconds) * 1000;
    return 1;
  }

  async ttl(key) {
    const entry = this.sweep(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  async keys(pattern = "*") {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const regex = new RegExp("^" + escaped + "$");
    return [...this.store.keys()].filter((key) => {
      this.sweep(key);
      return regex.test(key);
    });
  }

  async ping() {
    return "PONG";
  }
}

function tlsOptionsFor(target) {
  if (!target.startsWith("rediss://")) return undefined;
  try {
    const host = new URL(target).hostname;
    // SNI matters for ElastiCache/Upstash TLS endpoints behind a shared LB.
    return { servername: host };
  } catch {
    return {};
  }
}

/**
 * @param {object} [options]
 * @param {string} [options.url]        Explicit URL; defaults to REDIS_URL at call time.
 * @param {string} [options.label]      Name used in logs.
 */
export function createRedisClient(options = {}) {
  const label = options.label || "cache";
  const explicitUrl = typeof options.url === "string" ? options.url : null;
  const connectTimeout = envMs("REDIS_CONNECT_TIMEOUT_MS", 4000);
  const commandTimeout = envMs("REDIS_COMMAND_TIMEOUT_MS", 4000);
  const retryCooldown = envMs("REDIS_RETRY_COOLDOWN_MS", 15000);
  const maxRetriesPerRequest = envMs("REDIS_MAX_RETRIES_PER_REQUEST", 2);

  const memory = new MemoryRedis();

  let client = null;
  let connecting = null;
  let reconnectTimer = null;
  let failedAt = 0;
  let mode = "idle";

  const targetUrl = () =>
    explicitUrl !== null
      ? String(explicitUrl || "").trim()
      : String(process.env.REDIS_URL || "").trim();

  /** REDIS_DISABLED=true forces the in-memory store (never for production). */
  const useMemory = () =>
    String(process.env.REDIS_DISABLED || "").toLowerCase() === "true" || !targetUrl();

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect().catch(() => {});
    }, retryCooldown);
    reconnectTimer.unref?.();
  }

  function markDown(error) {
    failedAt = Date.now();
    mode = "down";
    // Drop the socket: a half-open connection is what wedged the process in
    // the first place, and leaked sockets keep the event loop (and shutdowns)
    // waiting.
    const stale = client;
    client = null;
    if (stale) {
      try {
        stale.removeAllListeners();
        stale.disconnect();
      } catch {
        /* already gone */
      }
    }
    logger.warn(
      { err: error?.message, cache: label },
      "cache unavailable — requests that need it fail fast with 503; retrying in the background",
    );
    scheduleReconnect();
  }

  async function connect() {
    if (useMemory()) {
      mode = "memory";
      return null;
    }
    if (client) return client;
    if (connecting) return connecting;

    const target = targetUrl();

    connecting = (async () => {
      const candidate = new Redis(target, {
        lazyConnect: true,
        enableOfflineQueue: false,
        enableReadyCheck: true,
        connectTimeout,
        commandTimeout,
        maxRetriesPerRequest,
        // Bounded: ioredis stops retrying instead of running forever.
        retryStrategy: (times) => (times > 3 ? null : Math.min(times * 250, 2000)),
        ...(tlsOptionsFor(target) ? { tls: tlsOptionsFor(target) } : {}),
      });

      // Must be attached before connect(): an unhandled ioredis 'error' throws.
      candidate.on("error", (error) => {
        logger.debug?.({ err: error.message, cache: label }, "cache socket error");
      });

      const destroy = () => {
        candidate.removeAllListeners();
        try {
          candidate.disconnect();
        } catch {
          /* already gone */
        }
      };

      try {
        await withDeadline(
          (async () => {
            await candidate.connect();
            await candidate.ping();
          })(),
          connectTimeout + 1000,
          `cache connect timed out after ${connectTimeout}ms`,
        );
      } catch (error) {
        destroy();
        markDown(error);
        return null;
      }

      client = candidate;
      mode = "redis";
      failedAt = 0;
      logger.info({ cache: label, tls: target.startsWith("rediss://") }, "cache connected");

      candidate.on("error", (error) => {
        logger.warn({ err: error.message, cache: label }, "cache connection error");
      });
      candidate.on("end", () => {
        if (client !== candidate) return;
        markDown(new Error("connection closed"));
      });

      return client;
    })().finally(() => {
      connecting = null;
    });

    return connecting;
  }

  /** Returns a live client, or throws 503 immediately when the cache is down. */
  async function ensure() {
    if (useMemory()) {
      mode = "memory";
      return null;
    }
    if (client) return client;

    // Fail fast inside the cooldown window instead of starting another doomed
    // handshake on every request.
    if (mode === "down" && Date.now() - failedAt < retryCooldown) {
      throw new RedisUnavailableError();
    }

    const connected = await connect();
    if (!connected) throw new RedisUnavailableError();
    return connected;
  }

  async function call(command, run) {
    if (useMemory()) return run(memory);

    const connected = await ensure();
    try {
      return await withDeadline(
        Promise.resolve(run(connected)),
        commandTimeout + 500,
        `cache ${command} timed out after ${commandTimeout}ms`,
      );
    } catch (error) {
      if (error instanceof RedisUnavailableError) throw error;
      if (isConnectionFailure(error)) {
        markDown(error);
      } else {
        logger.warn({ err: error.message, command, cache: label }, "cache command failed");
      }
      throw new RedisUnavailableError();
    }
  }

  return {
    label,

    get: (key) => call("get", (c) => c.get(key)),
    set: (key, value, ...args) => call("set", (c) => c.set(key, value, ...args)),
    del: (...keys) => call("del", (c) => c.del(...keys)),
    incr: (key) => call("incr", (c) => c.incr(key)),
    expire: (key, seconds) => call("expire", (c) => c.expire(key, seconds)),
    ttl: (key) => call("ttl", (c) => c.ttl(key)),
    keys: (pattern) => call("keys", (c) => c.keys(pattern)),
    ping: () => call("ping", (c) => c.ping()),

    /**
     * Opens the connection at boot instead of on the first request, so a bad
     * cache endpoint is discovered before traffic arrives and the first user
     * request fails fast instead of paying the handshake budget.
     */
    async warmup() {
      if (useMemory()) return;
      try {
        await connect();
      } catch {
        /* markDown already logged it and scheduled a retry */
      }
    },

    /** Snapshot for logs. Never performs I/O. */
    status() {
      if (useMemory()) return { connected: true, mode: "memory" };
      if (mode === "redis") return { connected: true, mode: "redis" };
      // "down" is a real failure; anything else just means "not used yet".
      return { connected: false, mode: mode === "down" ? "unavailable" : "idle" };
    },

    /**
     * Bounded, never-throwing dependency probe for /health. It will establish
     * the connection if this process has not needed the cache yet, so the
     * answer is real — but it can never cost more than a couple of seconds and
     * it never throws.
     */
    async health() {
      if (useMemory()) return { connected: true, mode: "memory" };
      try {
        const connection =
          client ||
          (await withDeadline(connect(), connectTimeout + 1000, "cache connect timed out"));
        if (!connection) return { connected: false, mode: "unavailable" };
        await withDeadline(connection.ping(), 1500, "cache ping timed out");
        return { connected: true, mode: "redis" };
      } catch {
        return { connected: false, mode: "unavailable" };
      }
    },

    async disconnect() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const current = client;
      client = null;
      mode = "idle";
      if (!current) return;
      try {
        await withDeadline(current.quit(), 2000, "cache quit timed out");
      } catch {
        try {
          current.disconnect();
        } catch {
          /* already gone */
        }
      }
    },
  };
}

const redis = createRedisClient({ label: "shared" });

/** Back-compat helper used by the health router. */
export async function pingRedis() {
  return redis.health();
}

export default redis;
