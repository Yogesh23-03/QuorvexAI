import http from "http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import redis from "../../shared/redis/redis.js";
import { allowedOrigins } from "../../gateway/config/services.js";

const received = [];

function startUpstream(name, port) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const record = {
        name,
        method: req.method,
        url: req.url,
        userId: req.headers["x-user-id"] || null,
        requestId: req.headers["x-request-id"] || null,
        body: body || null,
      };
      received.push(record);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(record));
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

const SESSION_ID = "gateway-test-session";
const USER_ID = "68a1f0000000000000000001";

let app;
const servers = [];

beforeAll(async () => {
  servers.push(await startUpstream("auth", 9001));
  servers.push(await startUpstream("chat", 9002));
  servers.push(await startUpstream("agent", 9003));
  servers.push(await startUpstream("billing", 9004));

  await redis.set(
    `session-${SESSION_ID}`,
    JSON.stringify({ userId: USER_ID, name: "Gateway Tester", plan: "free", credits: 42 }),
    "EX",
    60,
  );

  const { createApp } = await import("../../gateway/app.js");
  app = createApp();
});

afterAll(async () => {
  await redis.del(`session-${SESSION_ID}`);
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
});

const authed = (req) => req.set("Cookie", `session=${SESSION_ID}`);

describe("gateway routing", () => {
  it("routes /api/chat/* to the chat service with the user id and request id", async () => {
    const res = await authed(request(app).get("/api/chat/get-conversations"));

    expect(res.status).toBe(200);
    const record = received.at(-1);
    expect(record.name).toBe("chat");
    expect(record.url).toBe("/get-conversations");
    expect(record.userId).toBe(USER_ID);
    expect(record.requestId).toBeTruthy();
  });

  it("routes /api/agent/* to the agent service and forwards the JSON body", async () => {
    const res = await authed(
      request(app)
        .post("/api/agent/chat")
        .send({ prompt: "build a site", conversationId: "abc", agent: "coding" }),
    );

    expect(res.status).toBe(200);
    const record = received.at(-1);
    expect(record.name).toBe("agent");
    expect(record.method).toBe("POST");
    expect(JSON.parse(record.body)).toMatchObject({ prompt: "build a site", agent: "coding" });
  });

  it("routes /api/billing/* to the billing service", async () => {
    await authed(request(app).post("/api/billing/create").send({ plan: "pro" }));
    expect(received.at(-1).name).toBe("billing");
  });

  it("lets login through without a session", async () => {
    const res = await request(app).post("/api/auth/login").send({ token: "abc" });
    expect(res.status).toBe(200);
    expect(received.at(-1).name).toBe("auth");
  });

  it("serves /api/me from the auth service so credits are never stale", async () => {
    const res = await authed(request(app).get("/api/me"));
    expect(res.status).toBe(200);
    expect(received.at(-1).name).toBe("auth");
    expect(received.at(-1).url).toBe("/me");
  });
});

describe("gateway protection", () => {
  it("rejects a protected route without a session", async () => {
    const res = await request(app).get("/api/chat/get-conversations");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an unknown session", async () => {
    const res = await request(app).get("/api/chat/get-conversations").set("Cookie", "session=nope");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expired/i);
  });

  it("returns a structured 404 for unknown API routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.requestId).toBeTruthy();
  });

  it("rate limits repeated login attempts", async () => {
    const statuses = [];
    for (let i = 0; i < 22; i += 1) {
      const res = await request(app).post("/api/auth/login").send({ token: "x" });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });
});

describe("gateway CORS", () => {
  const original = process.env.FRONTEND_URL;

  afterEach(() => {
    process.env.FRONTEND_URL = original;
  });

  const preflight = (origin) =>
    request(app)
      .options("/api/auth/login")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST");

  it("strips quotes that dotenv leaves on a configured origin", () => {
    process.env.FRONTEND_URL = '"https://app.example.com",https://admin.example.com';

    expect(allowedOrigins()).toContain("https://app.example.com");
    expect(allowedOrigins()).toContain("https://admin.example.com");
  });

  it("answers the browser preflight for the local app", async () => {
    process.env.FRONTEND_URL = '"http://localhost:5173",http://localhost:4173';

    const res = await preflight("http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("refuses an origin that is not allow-listed", async () => {
    process.env.FRONTEND_URL = "http://localhost:5173";

    const res = await preflight("https://evil.example.com");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("normalises a trailing slash copied from the address bar", () => {
    process.env.FRONTEND_URL = "https://app.example.com/";
    expect(allowedOrigins()).toContain("https://app.example.com");
  });

  it("drops malformed entries instead of rejecting the whole list", () => {
    process.env.FRONTEND_URL = "https://app.example.com, not a url ,https://admin.example.com/";

    const origins = allowedOrigins();
    expect(origins).toContain("https://app.example.com");
    expect(origins).toContain("https://admin.example.com");
    expect(origins).not.toContain("not a url");
  });

  it("never adds localhost origins in production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "https://app.example.com";

    try {
      expect(allowedOrigins()).toEqual(["https://app.example.com"]);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

describe("gateway health", () => {
  it("reports the shared cache without probing upstreams", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("gateway");
    expect(res.body.redis.connected).toBe(true);
    // Upstream reachability is I/O: it only runs when asked (?deep=1), and it
    // is answered from /live so a slow dependency cannot look "down".
    expect(res.body.upstreams).toBeUndefined();
  });

  it("reports every upstream on ?deep=1", async () => {
    const res = await request(app).get("/health?deep=1");
    expect(res.status).toBe(200);
    expect(res.body.upstreams.CHAT_SERVICE).toBe("up");
    expect(res.body.upstreams.AGENT_SERVICE).toBe("up");
  });

  it("stays 200 while an upstream is unreachable", async () => {
    const res = await request(app).get("/health?deep=1");
    expect(res.status).toBe(200);
    expect(res.body.upstreams.BILLING_SERVICE).toMatch(/up|down|http-\d+/);
  });

  it("answers /live without touching any dependency", async () => {
    const res = await request(app).get("/live");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", service: "gateway" });
  });
});
