import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import redis from "../../shared/redis/redis.js";
import { connectTestDb, disconnectTestDb } from "../helpers/db.js";

const verifyIdToken = vi.fn();

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken }),
}));

let app;
let User;

beforeAll(async () => {
  await connectTestDb("quorvex_test_auth");
  ({ default: User } = await import("../../services/auth/models/user.model.js"));
  const { createApp } = await import("../../services/auth/app.js");
  app = createApp();
});

beforeEach(async () => {
  await User.deleteMany({});
  verifyIdToken.mockReset();
  // Shared Redis keeps limiter windows between runs; reset them so the suite
  // starts from a clean budget (the gateway suite covers limiter behaviour).
  const limiterKeys = await redis.keys("rl:*");
  if (limiterKeys.length) await redis.del(limiterKeys);
});

afterAll(async () => {
  await disconnectTestDb();
});

const userBody = {
  name: "Ada Lovelace",
  email: "ada@quorvex.ai",
  picture: "https://avatar.test/a.png",
};

describe("POST /login", () => {
  it("rejects a missing token with a structured 400", async () => {
    const res = await request(app).post("/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("rejects a token firebase refuses with 401", async () => {
    verifyIdToken.mockRejectedValue(new Error("invalid id token"));
    const res = await request(app)
      .post("/login")
      .send({ token: "x".repeat(40) });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("creates a user with 100 free credits and sets auth cookies", async () => {
    verifyIdToken.mockResolvedValue({ uid: "fb-123", ...userBody });
    const res = await request(app)
      .post("/login")
      .send({ token: "y".repeat(40) });

    expect(res.status).toBe(200);
    expect(res.body.credits).toBe(100);
    expect(res.body.totalCredits).toBe(100);
    expect(res.body.plan).toBe("free");

    const cookies = res.headers["set-cookie"].join(";");
    expect(cookies).toContain("access=");
    expect(cookies).toContain("refresh=");
    expect(cookies).toContain("HttpOnly");
    expect(res.body.accessToken).toBeTruthy();

    expect(await User.countDocuments()).toBe(1);
  });

  it("reuses an existing user instead of duplicating it", async () => {
    verifyIdToken.mockResolvedValue({ uid: "fb-123", ...userBody });
    await request(app)
      .post("/login")
      .send({ token: "z".repeat(40) });
    const second = await request(app)
      .post("/login")
      .send({ token: "z".repeat(40) });

    expect(second.status).toBe(200);
    expect(await User.countDocuments()).toBe(1);
  });
});

describe("POST /register", () => {
  const account = (index) => ({
    name: `Operator ${index}`,
    email: `operator${index}@quorvex.ai`,
    password: `Lattice2026${index}`,
  });

  it("signs up two password-only accounts (no firebaseUid collision)", async () => {
    const first = await request(app).post("/register").send(account(1));
    const second = await request(app).post("/register").send(account(2));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await User.countDocuments()).toBe(2);
  });

  it("refuses a duplicate email", async () => {
    await request(app).post("/register").send(account(3));
    const again = await request(app).post("/register").send(account(3));

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("EMAIL_IN_USE");
  });
});

describe("credit ledger", () => {
  let userId;

  beforeEach(async () => {
    const user = await User.create({ firebaseUid: "fb-credits", ...userBody });
    userId = String(user._id);
  });

  it("deducts atomically and reports the new balance", async () => {
    const res = await request(app).post("/deduct-credits").send({ userId, agent: "coding" });
    expect(res.status).toBe(200);
    expect(res.body.credits).toBe(90);
    expect(res.body.cost).toBe(10);
  });

  it("never allows a negative balance", async () => {
    await User.updateOne({ _id: userId }, { $set: { credits: 3 } });
    const res = await request(app).post("/deduct-credits").send({ userId, agent: "coding" });

    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe("INSUFFICIENT_CREDITS");
    expect((await User.findById(userId)).credits).toBe(3);
  });

  it("does not double-spend under concurrent requests", async () => {
    await User.updateOne({ _id: userId }, { $set: { credits: 10 } });
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post("/deduct-credits").send({ userId, agent: "coding" }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 200).length;
    expect(succeeded).toBe(1);
    expect((await User.findById(userId)).credits).toBe(0);
  });

  it("refunds without exceeding the purchased total", async () => {
    await User.updateOne({ _id: userId }, { $set: { credits: 95, totalCredits: 100 } });
    const res = await request(app).post("/refund-credits").send({ userId, agent: "coding" });

    expect(res.status).toBe(200);
    expect(res.body.credits).toBe(100);

    const capped = await request(app).post("/refund-credits").send({ userId, agent: "coding" });
    expect(capped.body.credits).toBe(100);
  });

  it("rejects an unknown agent", async () => {
    const res = await request(app).post("/deduct-credits").send({ userId, agent: "hacker" });
    expect(res.status).toBe(400);
  });
});

describe("plan upgrades", () => {
  it("adds plan credits once and moves the plan forward", async () => {
    const user = await User.create({ firebaseUid: "fb-plan", ...userBody });
    const res = await request(app)
      .post("/update-plan")
      .send({ userId: String(user._id), plan: "starter", credits: 500 });

    expect(res.status).toBe(200);
    const updated = await User.findById(user._id);
    expect(updated.plan).toBe("starter");
    expect(updated.credits).toBe(600);
    expect(updated.planExpiresAt).toBeInstanceOf(Date);
  });

  it("rejects a credit amount that does not match the plan", async () => {
    const user = await User.create({ firebaseUid: "fb-plan-2", ...userBody });
    const res = await request(app)
      .post("/update-plan")
      .send({ userId: String(user._id), plan: "starter", credits: 99999 });

    expect(res.status).toBe(400);
    expect((await User.findById(user._id)).credits).toBe(100);
  });
});

describe("GET /logout", () => {
  it("clears the auth cookies", async () => {
    const res = await request(app).get("/logout").set("Cookie", "session=does-not-exist");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cookies = (res.headers["set-cookie"] || []).join(";");
    expect(cookies).toContain("access=");
    expect(cookies).toContain("refresh=");
  });
});
