import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { connectTestDb, disconnectTestDb } from "../helpers/db.js";

const serviceDefinitions = [
  { name: "auth-service", path: "../../services/auth/app.js" },
  { name: "chat-service", path: "../../services/chat/app.js" },
  { name: "agent-service", path: "../../services/agent/app.js" },
  { name: "billing-service", path: "../../services/billing/app.js" },
];

const apps = new Map();

beforeAll(async () => {
  await connectTestDb("quorvex_test_health");
  for (const definition of serviceDefinitions) {
    const { createApp } = await import(definition.path);
    apps.set(definition.name, createApp());
  }
});

afterAll(async () => {
  await disconnectTestDb();
});

describe.each(serviceDefinitions)("$name", (service) => {
  it("reports status, uptime, db and redis on /health", async () => {
    const res = await request(apps.get(service.name)).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.service).toBe(service.name);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.db).toMatchObject({ connected: true, state: "connected" });
    expect(res.body.redis).toMatchObject({ connected: true, mode: "redis" });
    expect(res.body.timestamp).toBeTruthy();
  });

  it("answers its root with an online envelope", async () => {
    const res = await request(apps.get(service.name)).get("/");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("online");
  });

  it("returns structured JSON for unknown routes", async () => {
    const res = await request(apps.get(service.name)).get("/definitely-not-a-route");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("agent provider diagnostics", () => {
  it("exposes only booleans and never leaks keys", async () => {
    const res = await request(apps.get("agent-service")).get("/health");

    expect(res.body.providers).toBeDefined();
    expect(Object.values(res.body.providers).every((value) => typeof value === "boolean")).toBe(
      true,
    );
    expect(JSON.stringify(res.body)).not.toMatch(/sk-|AIza|key_secret/i);
  });
});
