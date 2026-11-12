import express from "express";
import http from "http";
import { describe, expect, it } from "vitest";
import { beginKeepAlive, sendJson } from "../../shared/stream.js";

function fetchRaw(port, path) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path }, (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, raw }));
      })
      .on("error", reject);
  });
}

/** Boots an app on a random port and returns the raw HTTP exchange. */
async function exercise(handler) {
  const app = express();
  app.get("/run", handler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    return await fetchRaw(server.address().port, "/run");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe("agent keep-alive stream", () => {
  it("sends heartbeats and still ends with one parseable JSON document", async () => {
    const { status, headers, raw } = await exercise(async (_req, res) => {
      const keepAlive = beginKeepAlive(res, { intervalMs: 20, enabled: true });
      await new Promise((resolve) => setTimeout(resolve, 100));
      keepAlive.stop();
      sendJson(res, 200, { answer: "done", credits: 99 });
    });

    expect(status).toBe(200);
    expect(headers["content-type"]).toMatch(/application\/json/);
    expect(headers["cache-control"]).toBe("no-store");
    // Whitespace-only keep-alive bytes, then the payload: still valid JSON.
    expect(raw.startsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual({ answer: "done", credits: 99 });
  });

  it("keeps the real status while the head has not been sent", async () => {
    const { status, raw } = await exercise((_req, res) => {
      sendJson(res, 402, { success: false, error: { code: "INSUFFICIENT_CREDITS" } });
    });

    expect(status).toBe(402);
    expect(JSON.parse(raw).error.code).toBe("INSUFFICIENT_CREDITS");
  });

  it("is disabled in tests, so headers stay writable", async () => {
    const { status } = await exercise((_req, res) => {
      const keepAlive = beginKeepAlive(res);
      expect(keepAlive.started).toBe(false);
      keepAlive.stop();
      sendJson(res, 201, { ok: true });
    });

    expect(status).toBe(201);
  });
});
