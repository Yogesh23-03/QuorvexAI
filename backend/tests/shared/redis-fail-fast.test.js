import net from "net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRedisClient } from "../../shared/redis/redis.js";

/**
 * The production failure, reproduced: a cache endpoint that completes the TCP
 * handshake and then says nothing (TLS-only port reached with redis://, or a
 * security group that drops packets). Before the fix, the client awaited that
 * handshake forever and cached the pending promise, so every Redis-backed
 * request hung — register/login/refresh included — with no log line.
 */
const SILENT_PORT = 9390;
const LIVE_URL = process.env.TEST_REDIS_URL || "redis://127.0.0.1:6379";

let silentServer;
const openSockets = new Set();

beforeAll(async () => {
  process.env.REDIS_CONNECT_TIMEOUT_MS = "600";
  process.env.REDIS_COMMAND_TIMEOUT_MS = "600";
  process.env.REDIS_RETRY_COOLDOWN_MS = "60000";

  silentServer = net.createServer((socket) => {
    openSockets.add(socket);
    socket.on("close", () => openSockets.delete(socket));
    socket.on("error", () => {});
    // Accept and ignore: the socket looks alive, no bytes ever come back.
  });
  await new Promise((resolve) => silentServer.listen(SILENT_PORT, "127.0.0.1", resolve));
});

afterAll(() => {
  // The silent server accepted sockets that never spoke. Destroy them rather
  // than awaiting a close() that would wait for its own connections forever.
  for (const socket of openSockets) socket.destroy();
  openSockets.clear();
  silentServer.close();
  delete process.env.REDIS_CONNECT_TIMEOUT_MS;
  delete process.env.REDIS_COMMAND_TIMEOUT_MS;
  delete process.env.REDIS_RETRY_COOLDOWN_MS;
});

describe("redis fail-fast", () => {
  it("rejects the first command quickly instead of hanging", async () => {
    const client = createRedisClient({ url: `redis://127.0.0.1:${SILENT_PORT}`, label: "silent" });
    const startedAt = Date.now();

    await expect(client.get("anything")).rejects.toMatchObject({
      code: "REDIS_UNAVAILABLE",
      status: 503,
      expose: true,
    });

    // Bounded by connectTimeout + our deadline, not by the socket's patience.
    expect(Date.now() - startedAt).toBeLessThan(4000);
    await client.disconnect();
  });

  it("fails every later call immediately while down", async () => {
    const client = createRedisClient({ url: `redis://127.0.0.1:${SILENT_PORT}`, label: "silent" });

    await client.get("warm").catch(() => {});
    const startedAt = Date.now();
    await expect(client.incr("counter")).rejects.toMatchObject({ code: "REDIS_UNAVAILABLE" });

    expect(Date.now() - startedAt).toBeLessThan(250);
    await client.disconnect();
  });

  it("reports an unavailable health status without throwing", async () => {
    const client = createRedisClient({ url: `redis://127.0.0.1:${SILENT_PORT}`, label: "silent" });
    const status = await client.health();

    expect(status).toEqual({ connected: false, mode: "unavailable" });
    await client.disconnect();
  });

  it("still works against a live server", async () => {
    const client = createRedisClient({ url: LIVE_URL, label: "live" });
    const key = `test:redis:${Date.now()}`;

    await client.set(key, "value", "EX", 30);
    expect(await client.get(key)).toBe("value");
    expect(await client.incr(`${key}:counter`)).toBe(1);
    expect((await client.health()).mode).toBe("redis");

    await client.del(key, `${key}:counter`);
    await client.disconnect();
  });

  it("uses the in-memory store only when no URL is configured", async () => {
    const client = createRedisClient({ url: "", label: "memory" });

    await client.set("k", "v");
    expect(await client.get("k")).toBe("v");
    expect(client.status()).toEqual({ connected: true, mode: "memory" });
    await client.disconnect();
  });
});
