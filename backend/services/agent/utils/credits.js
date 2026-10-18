import axios from "axios";
import { serviceUrl } from "../config/services.js";
import { ApiError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

function client() {
  return axios.create({
    baseURL: serviceUrl("AUTH_SERVICE"),
    timeout: 10000,
    headers: process.env.INTERNAL_API_KEY ? { "x-internal-key": process.env.INTERNAL_API_KEY } : {},
  });
}

/** Reserves credits. Translates auth-service failures into typed API errors. */
export async function deductCredits(userId, agent) {
  try {
    const { data } = await client().post("/deduct-credits", { userId, agent });
    return data;
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.error;

    if (status === 402) {
      throw new ApiError(402, detail?.message || "You are out of credits.", "INSUFFICIENT_CREDITS");
    }
    if (status === 404) {
      throw new ApiError(404, detail?.message || "User not found", "NOT_FOUND");
    }
    if (status === 400) {
      throw new ApiError(400, detail?.message || "Invalid credit request", "BAD_REQUEST");
    }

    logger.error({ err: error.message }, "credit deduction failed");
    throw new ApiError(
      503,
      "Could not verify your credits. Please try again.",
      "CREDITS_UNAVAILABLE",
    );
  }
}

/** Best-effort refund; never masks the original failure. */
export async function refundCredits(userId, agent) {
  try {
    const { data } = await client().post("/refund-credits", { userId, agent });
    return data;
  } catch (error) {
    logger.error({ err: error.message, userId, agent }, "credit refund failed");
    return null;
  }
}
