import crypto from "crypto";
import { PLANS } from "../config/plans.js";
import { getRazorpay } from "../config/razorpay.js";
import Payment from "../models/payment.model.js";
import { ApiError, badRequest, unauthorized } from "../../../shared/errors.js";
import { safeEqual } from "../../../shared/internalAuth.js";
import { serviceUrl } from "../config/services.js";
import { logger } from "../../../shared/logger.js";

export async function createOrder(req, res) {
  const userId = req.headers["x-user-id"];
  if (!userId) throw unauthorized();

  const { plan } = req.body || {};
  const selectedPlan = PLANS[plan];
  if (!selectedPlan || selectedPlan.id === "free") throw badRequest("Unknown plan");

  const order = await getRazorpay().orders.create({
    amount: selectedPlan.amount * 100,
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
    notes: { userId: String(userId), plan: selectedPlan.id, credits: String(selectedPlan.credits) },
  });

  await Payment.create({
    userId,
    orderId: order.id,
    amount: order.amount,
    credits: selectedPlan.credits,
    plan: selectedPlan.id,
    currency: order.currency,
    status: "created",
  });

  return res.status(200).json({
    order,
    plan: selectedPlan,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
}

function expectedSignature(orderId, paymentId) {
  return crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

export async function verifyPayment(req, res) {
  const userId = req.headers["x-user-id"];
  if (!userId) throw unauthorized();

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw badRequest("Payment verification payload is incomplete");
  }

  // Without the real secret an HMAC of "" would be forgeable, so refuse early.
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(503, "Payments are not configured yet", "PAYMENTS_UNAVAILABLE");
  }

  if (!safeEqual(expectedSignature(razorpay_order_id, razorpay_payment_id), razorpay_signature)) {
    logger.warn({ userId, orderId: razorpay_order_id }, "razorpay signature mismatch");
    throw new ApiError(400, "Payment verification failed", "INVALID_SIGNATURE");
  }

  const payment = await Payment.findOne({ orderId: razorpay_order_id });
  if (!payment) throw new ApiError(404, "Payment not found", "NOT_FOUND");
  if (String(payment.userId) !== String(userId))
    throw unauthorized("Payment does not belong to you");

  if (payment.status === "paid") {
    // Idempotent replay: never credit the same order twice.
    return res
      .status(200)
      .json({ success: true, message: "Payment already verified", replay: true });
  }

  // Cross-check the amount with Razorpay so a tampered local record cannot inflate credits.
  const order = await getRazorpay().orders.fetch(razorpay_order_id);
  if (Number(order.amount) !== Number(payment.amount)) {
    payment.status = "failed";
    payment.failureReason = "amount mismatch";
    await payment.save();
    throw new ApiError(400, "Payment amount mismatch", "AMOUNT_MISMATCH");
  }

  const claimed = await Payment.findOneAndUpdate(
    { orderId: razorpay_order_id, status: { $in: ["created", "failed"] } },
    { $set: { status: "processing", paymentId: razorpay_payment_id } },
    { returnDocument: "after" },
  );
  if (!claimed) {
    return res.status(200).json({ success: true, message: "Payment already processed" });
  }

  try {
    const response = await fetch(`${serviceUrl("AUTH_SERVICE")}/update-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.INTERNAL_API_KEY ? { "x-internal-key": process.env.INTERNAL_API_KEY } : {}),
      },
      body: JSON.stringify({
        userId: claimed.userId,
        plan: claimed.plan,
        credits: claimed.credits,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new ApiError(502, "Could not apply the plan upgrade", "UPGRADE_FAILED", {
        detail: detail.slice(0, 200),
      });
    }

    const data = await response.json();
    claimed.status = "paid";
    await claimed.save();

    return res.status(200).json({ success: true, message: "Payment verified", user: data?.user });
  } catch (error) {
    // Roll the claim back so a retry can succeed instead of trapping the payment.
    await Payment.updateOne(
      { orderId: razorpay_order_id, status: "processing" },
      { $set: { status: "failed", failureReason: error.message } },
    );
    throw error;
  }
}

/**
 * Credits live with the auth service (single owner of the user document), but
 * the public credits endpoint is exposed here so clients have one billing API.
 * The lazy 5h reset runs inside that read, so this always returns fresh values.
 */
export async function getCredits(req, res) {
  const userId = req.headers["x-user-id"];
  if (!userId) throw unauthorized();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${serviceUrl("AUTH_SERVICE")}/credits`, {
      headers: {
        "x-user-id": String(userId),
        ...(process.env.INTERNAL_API_KEY ? { "x-internal-key": process.env.INTERNAL_API_KEY } : {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(502, "Could not read the credit balance", "CREDITS_UNAVAILABLE");
    }

    const data = await response.json();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(data);
  } finally {
    clearTimeout(timeout);
  }
}

export async function paymentHistory(req, res) {
  const userId = req.headers["x-user-id"];
  if (!userId) throw unauthorized();

  const payments = await Payment.find({ userId, status: "paid" })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return res.status(200).json(payments);
}
