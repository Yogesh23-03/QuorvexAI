import Redis from "ioredis";
import { logger } from "../logger.js";

/**
 * Small in-process Redis stand-in. It is used for tests and local runs where
 * REDIS_URL is not configured, so the API degrades instead of crashing.
 * It implements only the commands QuorvexAI uses.
 */
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

  async quit() {
    return "OK";
  }

  disconnect() {}
}

const memory = new MemoryRedis();

let client = null;
let connecting = null;
let mode = "memory";
let failedAt = 0;
const RETRY_COOLDOWN_MS = 15000;

function redisEnabled() {
  return Boolean(process.env.REDIS_URL) && process.env.REDIS_DISABLED !== "true";
}

async function connect() {
  if (!redisEnabled()) return null;
  if (client) return client;
  if (connecting) return connecting;
  if (Date.now() - failedAt < RETRY_COOLDOWN_MS) return null;

  connecting = (async () => {
    const candidate = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1000)),
    });

    candidate.on("error", (error) => {
      if (mode === "redis") logger.warn({ err: error.message }, "redis connection error");
    });

    try {
      await candidate.connect();
      await candidate.ping();
      client = candidate;
      mode = "redis";
      logger.info("redis connected");
      return client;
    } catch (error) {
      failedAt = Date.now();
      mode = "memory";
      logger.warn({ err: error.message }, "redis unavailable, using in-memory fallback");
      try {
        candidate.disconnect();
      } catch {
        /* noop */
      }
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

async function backend() {
  return (await connect()) || memory;
}

const redis = {
  get: async (key) => (await backend()).get(key),
  set: async (key, value, ...args) => (await backend()).set(key, value, ...args),
  del: async (...keys) => (await backend()).del(...keys),
  incr: async (key) => (await backend()).incr(key),
  expire: async (key, seconds) => (await backend()).expire(key, seconds),
  ttl: async (key) => (await backend()).ttl(key),
  keys: async (pattern) => (await backend()).keys(pattern),
  ping: async () => (await backend()).ping(),
  disconnect: async () => {
    if (client) {
      await client.quit().catch(() => client.disconnect());
      client = null;
    }
    mode = "memory";
  },
};

async function redisStatus() {
  if (redisEnabled()) {
    const connection = await connect();
    if (connection) {
      try {
        await connection.ping();
        return { connected: true, mode: "redis" };
      } catch {
        /* fall through to degraded */
      }
    }
  }
  return { connected: false, mode: "memory" };
}

export async function pingRedis() {
  return redisStatus();
}

export default redis;
