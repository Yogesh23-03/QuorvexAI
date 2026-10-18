import Razorpay from "razorpay";
import { ApiError } from "../../../shared/errors.js";

let client = null;

export function getRazorpay() {
  if (client) return client;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new ApiError(503, "Payments are not configured yet", "PAYMENTS_UNAVAILABLE");
  }

  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

export default getRazorpay;
