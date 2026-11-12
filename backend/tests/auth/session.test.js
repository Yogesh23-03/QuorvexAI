import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import redis from "../../shared/redis/redis.js";
import { connectTestDb, disconnectTestDb } from "../helpers/db.js";

/**
 * The session path end to end over HTTP: password register → login → refresh
 * (single-use rotation) → logout. These are the exact endpoints that hung in
 * production, so they are exercised as real requests, not unit calls.
 */
let app;
let User;

const account = {
  name: "Session Tester",
  email: "session@quorvex.local",
  password: "Lattice2026",
};

const refreshCookie = (res) =>
  (res.headers["set-cookie"] || []).find((cookie) => cookie.startsWith("refresh="));

beforeAll(async () => {
  await connectTestDb("quorvex_test_session");
  ({ default: User } = await import("../../services/auth/models/user.model.js"));
  const { createApp } = await import("../../services/auth/app.js");
  app = createApp();
});

beforeEach(async () => {
  await User.deleteMany({});
  const limiterKeys = await redis.keys("rl:*");
  if (limiterKeys.length) await redis.del(limiterKeys);
});

afterAll(async () => {
  const tokenKeys = await redis.keys("auth:*");
  if (tokenKeys.length) await redis.del(tokenKeys);
  await disconnectTestDb();
});

describe("password session", () => {
  it("registers, then serves /me from the session cookies", async () => {
    const agent = request.agent(app);

    const registered = await agent.post("/register").send(account).expect(201);

    expect(registered.body.email).toBe(account.email);
    expect(registered.body.accessToken).toBeTruthy();
    const cookies = (registered.headers["set-cookie"] || []).join(";");
    expect(cookies).toContain("access=");
    expect(cookies).toContain("refresh=");
    expect(cookies).toContain("HttpOnly");
    // Tests run with NODE_ENV=test, so Secure is off unless explicitly enabled.
    expect(cookies).not.toMatch(/Secure/);

    const me = await agent.get("/me").expect(200);
    expect(me.body.email).toBe(account.email);
    expect(me.body.credits).toBe(100);
    expect(me.body.nextResetAt).toBeTruthy();
  });

  it("logs in with the password and rejects a wrong one", async () => {
    await request(app).post("/register").send(account).expect(201);

    const good = await request(app)
      .post("/login")
      .send({ email: account.email, password: account.password })
      .expect(200);
    expect(good.body.plan).toBe("free");

    const bad = await request(app)
      .post("/login")
      .send({ email: account.email, password: "WrongPassword1" })
      .expect(401);
    expect(bad.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rotates the refresh token and refuses the used one", async () => {
    const registered = await request(app).post("/register").send(account).expect(201);
    const original = refreshCookie(registered);
    expect(original).toBeTruthy();

    const refreshed = await request(app)
      .post("/refresh")
      .set("Cookie", original.split(";")[0])
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    // Single-use: replaying the rotated cookie must fail, not mint another pair.
    const replay = await request(app)
      .post("/refresh")
      .set("Cookie", original.split(";")[0])
      .expect(401);
    expect(replay.body.error.message).toMatch(/already used|revoked/i);
  });

  it("clears the cookies on logout and stops serving /me", async () => {
    const agent = request.agent(app);
    await agent.post("/register").send(account).expect(201);
    await agent.get("/me").expect(200);

    const loggedOut = await agent.get("/logout").expect(200);
    expect(loggedOut.body.success).toBe(true);
    const cleared = (loggedOut.headers["set-cookie"] || []).join(";");
    expect(cleared).toContain("access=;");
    expect(cleared).toContain("refresh=;");

    await agent.get("/me").expect(401);
  });

  it("answers 401 for every protected route without a session", async () => {
    await request(app).get("/me").expect(401);
    await request(app).get("/credits").expect(401);
    await request(app).post("/refresh").expect(401);
  });
});
