import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { connectTestDb, disconnectTestDb } from "../helpers/db.js";

/**
 * The clock is mocked with `toFake: ["Date"]` only: time is deterministic while
 * sockets, timers and the Mongo/Redis clients keep working normally.
 */
const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-05-01T09:00:00.000Z");

let app;
let User;
let applyCreditReset;
let nextResetAt;

const hoursAgo = (hours) => new Date(NOW.getTime() - hours * HOUR);

async function makeUser(overrides = {}) {
  return User.create({
    name: "Reset Operator",
    email: `reset-${Math.random().toString(36).slice(2)}@quorvex.ai`,
    lastCreditResetAt: hoursAgo(1),
    ...overrides,
  });
}

beforeAll(async () => {
  await connectTestDb("quorvex_test_credits_reset");
  ({ default: User } = await import("../../services/auth/models/user.model.js"));
  ({ applyCreditReset, nextResetAt } = await import("../../shared/creditPolicy.js"));
  const { createApp } = await import("../../services/auth/app.js");
  app = createApp();
});

beforeEach(async () => {
  await User.deleteMany({});
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.CREDIT_RESET_HOURS;
  delete process.env.CREDIT_RESET_AMOUNT;
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("credit reset policy", () => {
  it("does not reset before the window elapses", async () => {
    const user = await makeUser({ credits: 40 });
    const res = await request(app).get("/credits").set("x-user-id", String(user._id));

    expect(res.status).toBe(200);
    expect(res.body.credits).toBe(40);
    expect(res.body.resetHours).toBe(5);
    expect(res.body.resetAmount).toBe(100);
    // One hour into a five hour window: four hours left.
    expect(new Date(res.body.nextResetAt).getTime()).toBe(hoursAgo(-4).getTime());
  });

  it("tops up a depleted balance after the window elapses", async () => {
    const user = await makeUser({ credits: 40, lastCreditResetAt: hoursAgo(6) });
    const res = await request(app).get("/credits").set("x-user-id", String(user._id));

    expect(res.status).toBe(200);
    expect(res.body.credits).toBe(100);
    // The reset also moves the anchor, so the next window starts now.
    expect(new Date(res.body.nextResetAt).getTime()).toBe(hoursAgo(-5).getTime());

    const stored = await User.findById(user._id);
    expect(stored.credits).toBe(100);
    expect(stored.lastCreditResetAt.getTime()).toBe(NOW.getTime());
  });

  it("leaves purchased credits above the reset amount untouched", async () => {
    const user = await makeUser({ credits: 640, lastCreditResetAt: hoursAgo(9) });
    const res = await request(app).get("/credits").set("x-user-id", String(user._id));

    expect(res.status).toBe(200);
    expect(res.body.credits).toBe(640);
    expect((await User.findById(user._id)).credits).toBe(640);
  });

  it("applies exactly one reset under concurrent requests", async () => {
    const user = await makeUser({ credits: 0, lastCreditResetAt: hoursAgo(8) });

    const results = await Promise.all(
      Array.from({ length: 6 }, () => applyCreditReset(User, String(user._id))),
    );

    const applied = results.filter(Boolean);
    expect(applied).toHaveLength(1);
    expect((await User.findById(user._id)).credits).toBe(100);
  });

  it("honours CREDIT_RESET_HOURS and CREDIT_RESET_AMOUNT", async () => {
    process.env.CREDIT_RESET_HOURS = "2";
    process.env.CREDIT_RESET_AMOUNT = "50";

    const tooSoon = await makeUser({ credits: 10, lastCreditResetAt: hoursAgo(1) });
    const due = await makeUser({ credits: 10, lastCreditResetAt: hoursAgo(3) });

    const first = await request(app).get("/credits").set("x-user-id", String(tooSoon._id));
    const second = await request(app).get("/credits").set("x-user-id", String(due._id));

    expect(first.body.credits).toBe(10);
    expect(first.body.resetHours).toBe(2);
    expect(second.body.credits).toBe(50);
    expect(second.body.resetAmount).toBe(50);
  });

  it("exposes nextResetAt on /me as well", async () => {
    const user = await makeUser({ credits: 70, lastCreditResetAt: hoursAgo(2) });
    const res = await request(app).get("/me").set("x-user-id", String(user._id));

    expect(res.status).toBe(200);
    expect(new Date(res.body.nextResetAt).getTime()).toBe(hoursAgo(-3).getTime());
  });

  it("returns null for an unknown user and derives a date without an anchor", async () => {
    expect(await applyCreditReset(User, "665000000000000000000000")).toBeNull();
    expect(nextResetAt({})).toBe(new Date(NOW.getTime() + 5 * HOUR).toISOString());
  });
});
