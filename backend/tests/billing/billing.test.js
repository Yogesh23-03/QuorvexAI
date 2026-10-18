import crypto from "crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { connectTestDb, disconnectTestDb } from "../helpers/db.js";

const ordersCreate = vi.fn();
const ordersFetch = vi.fn();

vi.mock("razorpay", () => ({
  default: class RazorpayMock {
    orders = { create: ordersCreate, fetch: ordersFetch };
  },
}));

const USER = "68a1f0000000000000000001";
const SECRET = process.env.RAZORPAY_KEY_SECRET;

let app;
let Payment;
let fetchMock;

beforeAll(async () => {
  await connectTestDb("quorvex_test_billing");
  ({ default: Payment } = await import("../../services/billing/models/payment.model.js"));
  const { createApp } = await import("../../services/billing/app.js");
  app = createApp();
});

beforeEach(async () => {
  await Payment.deleteMany({});
  ordersCreate.mockReset();
  ordersFetch.mockReset();
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, user: { credits: 600 } }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await disconnectTestDb();
});

const sign = (orderId, paymentId) =>
  crypto.createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");

describe("POST /create", () => {
  it("creates a Razorpay order for a valid plan and records it", async () => {
    ordersCreate.mockResolvedValue({ id: "order_123", amount: 19900, currency: "INR" });

    const res = await request(app).post("/create").set("x-user-id", USER).send({ plan: "starter" });

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe("order_123");
    expect(res.body.plan.credits).toBe(500);
    expect(res.body.keyId).toBe(process.env.RAZORPAY_KEY_ID);

    const payment = await Payment.findOne({ orderId: "order_123" });
    expect(payment.status).toBe("created");
    expect(payment.credits).toBe(500);
  });

  it("rejects an unknown plan", async () => {
    const res = await request(app)
      .post("/create")
      .set("x-user-id", USER)
      .send({ plan: "enterprise" });
    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated caller", async () => {
    const res = await request(app).post("/create").send({ plan: "starter" });
    expect(res.status).toBe(401);
  });
});

describe("POST /verify", () => {
  const seed = async () => {
    await Payment.create({
      userId: USER,
      orderId: "order_pay_1",
      amount: 19900,
      credits: 500,
      plan: "starter",
      status: "created",
    });
    ordersFetch.mockResolvedValue({ id: "order_pay_1", amount: 19900 });
  };

  it("rejects a tampered signature", async () => {
    await seed();
    const res = await request(app).post("/verify").set("x-user-id", USER).send({
      razorpay_order_id: "order_pay_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "deadbeef",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_SIGNATURE");
    expect((await Payment.findOne({ orderId: "order_pay_1" })).status).toBe("created");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a payload with missing fields", async () => {
    const res = await request(app).post("/verify").set("x-user-id", USER).send({});
    expect(res.status).toBe(400);
  });

  it("credits once and marks the payment paid", async () => {
    await seed();
    const res = await request(app)
      .post("/verify")
      .set("x-user-id", USER)
      .send({
        razorpay_order_id: "order_pay_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: sign("order_pay_1", "pay_1"),
      });

    expect(res.status).toBe(200);
    expect(res.body.user.credits).toBe(600);
    expect((await Payment.findOne({ orderId: "order_pay_1" })).status).toBe("paid");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain("/update-plan");
    expect(JSON.parse(call[1].body)).toMatchObject({ userId: USER, plan: "starter", credits: 500 });
  });

  it("is idempotent on replay and never credits twice", async () => {
    await seed();
    const body = {
      razorpay_order_id: "order_pay_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: sign("order_pay_1", "pay_1"),
    };

    await request(app).post("/verify").set("x-user-id", USER).send(body);
    const replay = await request(app).post("/verify").set("x-user-id", USER).send(body);

    expect(replay.status).toBe(200);
    expect(replay.body.replay).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses to credit an order whose amount no longer matches Razorpay", async () => {
    await seed();
    ordersFetch.mockResolvedValue({ id: "order_pay_1", amount: 49900 });

    const res = await request(app)
      .post("/verify")
      .set("x-user-id", USER)
      .send({
        razorpay_order_id: "order_pay_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: sign("order_pay_1", "pay_1"),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("AMOUNT_MISMATCH");
    expect((await Payment.findOne({ orderId: "order_pay_1" })).status).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rolls the claim back when the plan upgrade fails so a retry can succeed", async () => {
    await seed();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, text: async () => "auth down" });

    const body = {
      razorpay_order_id: "order_pay_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: sign("order_pay_1", "pay_1"),
    };

    const failed = await request(app).post("/verify").set("x-user-id", USER).send(body);
    expect(failed.status).toBe(502);
    expect((await Payment.findOne({ orderId: "order_pay_1" })).status).toBe("failed");

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, user: { credits: 600 } }),
    });

    const retry = await request(app).post("/verify").set("x-user-id", USER).send(body);
    expect(retry.status).toBe(200);
    expect((await Payment.findOne({ orderId: "order_pay_1" })).status).toBe("paid");
  });

  it("refuses to verify a payment owned by another user", async () => {
    await seed();
    const res = await request(app)
      .post("/verify")
      .set("x-user-id", "68a1f0000000000000000009")
      .send({
        razorpay_order_id: "order_pay_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: sign("order_pay_1", "pay_1"),
      });

    expect(res.status).toBe(401);
  });
});
