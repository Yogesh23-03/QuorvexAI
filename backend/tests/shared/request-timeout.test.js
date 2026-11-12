import express from "express";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { errorHandler } from "../../shared/errors.js";
import { requestId, requestTimeout } from "../../shared/request.js";

/** A handler that awaits a dependency which never settles. */
function stuckApp(budgetMs = 120) {
  const app = express();
  app.use(requestId);
  app.use(requestTimeout(budgetMs));
  app.get("/stuck", async () => {
    await new Promise(() => {});
  });
  app.get("/fine", (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe("request timeout", () => {
  it("answers 503 with a request id instead of hanging", async () => {
    const startedAt = Date.now();
    const res = await request(stuckApp()).get("/stuck");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("REQUEST_TIMEOUT");
    expect(res.body.requestId).toBeTruthy();
    expect(Date.now() - startedAt).toBeLessThan(3000);
  });

  it("leaves fast responses alone", async () => {
    const res = await request(stuckApp()).get("/fine");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
