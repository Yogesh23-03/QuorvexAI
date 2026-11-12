import { ApiError } from "../../../shared/errors.js";

/**
 * The auth service owns the user document and the credits, so billing calls it
 * to apply a plan upgrade and to read a balance. The URL is always an env
 * value in production; the loopback default exists for local runs only.
 */
const DEFAULTS = {
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
