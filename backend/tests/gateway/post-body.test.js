import express from "express";
import http from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

/**
 * REGRESSION TEST for the production hang.
 *
 * Every auth POST (register/login/refresh) hung through the gateway while GET
 * and OPTIONS worked. The class of bug: something in front of the proxy
 * consumes the request stream, so the upstream waits for a body that will never
 * arrive — no error, no log line, just a 504 after the proxy timeout.
 *
 * This test puts a REAL express app (with express.json) behind the gateway and
 * asserts the parsed body, the raw byte count and the content type all survive
 * the hop, including for a body large enough to arrive in several chunks.
 */
const UPSTREAM_PORT = 9101;
const BODY_CHUNKS = 400;
const largeText = Array.from({ length: BODY_CHUNKS }, (_, index) => `chunk-${index}`).join("-");

const received = [];

function startUpstream() {
  const upstream = express();
  upstream.use(express.json({ limit: "2mb" }));
  upstream.use((req, res) => {
    received.push({
      path: req.path,
      body: req.body,
      contentLength: Number(req.headers["content-length"]),
      contentType: req.headers["content-type"],
      requestId: req.headers["x-request-id"],
      internalKey: req.headers["x-internal-key"] || null,
    });
    res.status(200).json({ ok: true, path: req.path });
  });
  return new Promise((resolve) => {
    const server = http
      .createServer(upstream)
      .listen(UPSTREAM_PORT, "127.0.0.1", () => resolve(server));
  });
}

let app;
let server;

beforeAll(async () => {
  server = await startUpstream();
  process.env.AUTH_SERVICE = `http://127.0.0.1:${UPSTREAM_PORT}`;
  process.env.INTERNAL_API_KEY = "test-internal-key";
  const { createApp } = await import("../../gateway/app.js");
  app = createApp();
});

afterAll(async () => {
  delete process.env.INTERNAL_API_KEY;
  await new Promise((resolve) => server.close(resolve));
});

describe("gateway forwards POST bodies untouched", () => {
  it("delivers a JSON body to a real express upstream", async () => {
    const payload = { name: "Body Test", email: "body@quorvex.local", password: "Lattice2026" };
    const res = await request(app).post("/api/auth/register").send(payload).expect(200);

    expect(res.body).toMatchObject({ ok: true, path: "/register" });

    const record = received.at(-1);
    expect(record.path).toBe("/register");
    expect(record.body).toEqual(payload);
    expect(record.contentType).toMatch(/application\/json/);
    // content-length must match what the client sent, not a re-serialised copy.
    expect(record.contentLength).toBe(Buffer.byteLength(JSON.stringify(payload)));
  });

  it("forwards a multi-chunk body without truncation", async () => {
    const payload = { prompt: largeText, conversationId: "abc123", agent: "chat" };

    await request(app).post("/api/auth/register").send(payload).expect(200);

    const record = received.at(-1);
    expect(record.body.prompt).toHaveLength(largeText.length);
    expect(record.body.prompt).toBe(largeText);
    expect(record.contentLength).toBe(Buffer.byteLength(JSON.stringify(payload)));
  });

  it("adds a request id and the internal key", async () => {
    await request(app).post("/api/auth/register").send({ hello: "world" }).expect(200);

    const record = received.at(-1);
    expect(record.requestId).toBeTruthy();
    expect(record.internalKey).toBe("test-internal-key");
  });

  it("answers with JSON when the upstream is unreachable", async () => {
    process.env.AUTH_SERVICE = "http://127.0.0.1:9199";
    const { createApp } = await import("../../gateway/app.js");
    const broken = createApp();

    const res = await request(broken).post("/api/auth/register").send({ a: 1 });
    process.env.AUTH_SERVICE = `http://127.0.0.1:${UPSTREAM_PORT}`;

    expect([502, 503, 504]).toContain(res.status);
    expect(res.body.error).toBeTruthy();
    expect(typeof res.body.error.code).toBe("string");
  });
});
