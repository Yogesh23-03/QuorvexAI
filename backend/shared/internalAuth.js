import crypto from "crypto";
import { unauthorized } from "./errors.js";

const safeEqual = (a = "", b = "") => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

/**
 * Services sit behind the API gateway. When INTERNAL_API_KEY is configured,
 * direct calls must present it so ports 8001-8004 cannot be abused publicly.
 */
export function requireInternalKey(req, res, next) {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return next();
  if (safeEqual(req.headers["x-internal-key"], expected)) return next();
  return next(unauthorized("Invalid internal service credentials"));
}

export { safeEqual };
