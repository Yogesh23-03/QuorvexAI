import { ApiError } from "../../../shared/errors.js";

/**
 * Inter-service targets. In ECS these are full URLs from the task definition
 * (for example http://auth:8001 through Service Connect, or an internal ALB
 * DNS name). The localhost defaults only apply outside production, so a
 * production task can never silently fall back to a loopback address.
 */
const DEFAULTS = {
  CHAT_SERVICE: "http://127.0.0.1:8002",
  AUTH_SERVICE: "http://127.0.0.1:8001",
};

const isProduction = () => process.env.NODE_ENV === "production";

export function serviceUrl(name) {
  const configured = String(process.env[name] || "").trim();
  const value = configured || (isProduction() ? "" : DEFAULTS[name]);

  if (!value) {
    throw new ApiError(503, `${name} is not configured`, "SERVICE_NOT_CONFIGURED");
  }

  const url = value.replace(/\/+$/, "");
  if (!/^https?:\/\/[^/\s]+/.test(url)) {
    throw new ApiError(503, `${name} must be an absolute http(s) URL`, "SERVICE_NOT_CONFIGURED");
  }
  return url;
}

export default serviceUrl;
