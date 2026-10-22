import { logger } from "../../shared/logger.js";
import { ApiError } from "../../shared/errors.js";

const DEFAULTS = {
  AUTH_SERVICE: "http://127.0.0.1:8001",
  CHAT_SERVICE: "http://127.0.0.1:8002",
  AGENT_SERVICE: "http://127.0.0.1:8003",
  BILLING_SERVICE: "http://127.0.0.1:8004",
};

const isProduction = () => process.env.NODE_ENV === "production";

export function serviceUrl(name) {
  const raw = process.env[name] || (isProduction() ? "" : DEFAULTS[name]);
  if (!raw) {
    throw new ApiError(500, `${name} is not configured`, "SERVICE_NOT_CONFIGURED");
  }
  const url = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//.test(url)) {
    throw new ApiError(500, `${name} must be an absolute http(s) URL`, "SERVICE_NOT_CONFIGURED");
  }
  return url;
}

// Vite dev (5173) plus `vite preview` (4173), which is how a production build is
// checked locally. Production must set FRONTEND_URL to the real origins.
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

/**
 * dotenv only strips quotes that wrap the whole value, so
 * FRONTEND_URL="http://localhost:5173",http://localhost:4173 leaves literal
 * quotes on the first origin and silently breaks every browser call. Trim the
 * stray quotes rather than trusting the .env to be formatted perfectly.
 */
const cleanOrigin = (value) =>
  String(value || "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();

export function allowedOrigins() {
  const raw = process.env.FRONTEND_URL || (isProduction() ? "" : DEV_ORIGINS.join(","));
  const configured = raw.split(",").map(cleanOrigin).filter(Boolean);

  if (isProduction()) {
    if (configured.length === 0) {
      logger.warn("FRONTEND_URL is empty; cross-origin requests will be rejected");
    }
    return configured;
  }

  // Outside production the local app must always be reachable, whatever a
  // partial FRONTEND_URL says.
  return [...new Set([...configured, ...DEV_ORIGINS])];
}

/**
 * The gateway verifies the access token that the auth service signed, so both
 * must share JWT_SECRET. A mismatch is invisible until every authenticated call
 * starts returning 401, so production fails fast and development warns loudly.
 */
export function assertAuthConfig() {
  if (process.env.JWT_SECRET) return;

  if (isProduction()) {
    throw new ApiError(500, "JWT_SECRET is not configured", "SERVICE_NOT_CONFIGURED");
  }

  logger.warn(
    "JWT_SECRET is unset: the gateway is using the shared development secret. " +
      "Set the same JWT_SECRET as the auth service or every authenticated call will 401.",
  );
}

export function logConfig() {
  logger.info(
    {
      auth: process.env.AUTH_SERVICE ? "env" : "default",
      chat: process.env.CHAT_SERVICE ? "env" : "default",
      agent: process.env.AGENT_SERVICE ? "env" : "default",
      billing: process.env.BILLING_SERVICE ? "env" : "default",
      jwt: process.env.JWT_SECRET ? "env" : "development-fallback",
      origins: allowedOrigins(),
    },
    "gateway routing configuration",
  );
}
