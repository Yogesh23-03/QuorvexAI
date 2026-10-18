import { logger } from "../../shared/logger.js";
import { serviceUrl } from "../config/services.js";

/**
 * Returns the freshest user document. Prefers the auth service so credits and
 * plan changes are never stale; falls back to the cached session snapshot.
 */
export async function getCurrentUser(req, res, next) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${serviceUrl("AUTH_SERVICE")}/me`, {
        headers: {
          "x-user-id": String(req.user.userId),
          ...(process.env.INTERNAL_API_KEY
            ? { "x-internal-key": process.env.INTERNAL_API_KEY }
            : {}),
        },
        signal: controller.signal,
      });

      if (response.ok) {
        const user = await response.json();
        return res.status(200).json(user);
      }

      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
          requestId: req.id,
        });
      }
    } catch (error) {
      logger.warn({ err: error.message }, "auth service unavailable, using session snapshot");
    } finally {
      clearTimeout(timeout);
    }

    // The auth service is the source of truth; this snapshot only covers a brief outage.
    return res.status(200).json({ ...req.user, _id: req.user.userId });
  } catch (error) {
    return next(error);
  }
}
