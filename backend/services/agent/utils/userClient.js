import axios from "axios";
import { serviceUrl } from "../config/services.js";
import { logger } from "../../../shared/logger.js";

export async function fetchUser(userId) {
  try {
    const { data } = await axios.get(`${serviceUrl("AUTH_SERVICE")}/me`, {
      timeout: 5000,
      headers: {
        "x-user-id": String(userId),
        ...(process.env.INTERNAL_API_KEY ? { "x-internal-key": process.env.INTERNAL_API_KEY } : {}),
      },
    });
    return data;
  } catch (error) {
    logger.warn({ err: error.message }, "could not refresh user credits");
    return null;
  }
}
