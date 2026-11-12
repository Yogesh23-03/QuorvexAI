import crypto from "crypto";
import jwt from "jsonwebtoken";
import redis from "./redis/redis.js";
import { unauthorized } from "./errors.js";
import { logger } from "./logger.js";

const ACCESS_COOKIE = "access";
export const REFRESH_COOKIE = "refresh";
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

const DEV_ACCESS_SECRET = "dev-only-access-secret-change-me";
const DEV_REFRESH_SECRET = "dev-only-refresh-secret-change-me";

function accessSecret() {
  return (
    process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? null : DEV_ACCESS_SECRET)
  );
}

function refreshSecret() {
  return (
    process.env.JWT_REFRESH_SECRET ||
    (process.env.NODE_ENV === "production" ? null : DEV_REFRESH_SECRET)
  );
}

const refreshKey = (jti) => `auth:refresh:${jti}`;
const blockKey = (jti) => `auth:block:${jti}`;

/** Hostname of an absolute URL, or of a bare `host[:port]` header value. */
function hostOf(value) {
  const raw = String(value || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (!raw) return "";
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `http://${raw}`;
    return new URL(withScheme).hostname;
  } catch {
    return "";
  }
}

/**
 * True when the browser is calling the API from another site.
 *
 * This is the difference between a session that survives a reload and one that
 * does not. With the SPA and the API on different hosts the cookies were stored
 * with `SameSite=Lax`: the browser kept them but refuses to send them on a
 * cross-site request, so every page load answered 401 from /api/me and the
 * visitor was bounced back to the sign-in form.
 *
 * `Sec-Fetch-Site` is computed by the browser itself (with the public suffix
 * list), so it is preferred: one origin serving both the SPA and /api reports
 * `same-origin` and keeps the stricter Lax cookie, while a cross-site SPA
 * reports `cross-site` and gets None. Older clients fall back to comparing the
 * Origin header with the host that served the request.
 */
function isCrossSiteRequest(req) {
  const headers = req?.headers;
  if (!headers) return false;

  const fetchSite = String(headers["sec-fetch-site"] || "")
    .trim()
    .toLowerCase();
  if (fetchSite) return fetchSite === "cross-site";

  const originHost = hostOf(headers.origin);
  if (!originHost) return false; // same-origin navigation, or a server-to-server call
  const requestHost = hostOf(headers["x-forwarded-host"] || headers.host);
  return Boolean(requestHost) && requestHost !== originHost;
}

/**
 * Cookie flags are deployment facts, so they come from the environment with
 * production-safe defaults.
 *
 * Same-origin (one CloudFront distribution serving the SPA and /api/*) is the
 * simplest shape: Secure + SameSite=Lax works there, and an Origin-checked
 * same-site request is exactly what Lax permits. When the UI is served from a
 * different site than the API, the same cookie must be SameSite=None or the
 * browser silently drops it from every request — so that decision is made per
 * request instead of being a deployment step people forget.
 *
 * COOKIE_SAMESITE still overrides: `strict` and `none` are taken literally, and
 * `lax` means "Lax, except where Lax would break the session".
 */
function cookieSecurity(req) {
  const configuredSecure = String(process.env.COOKIE_SECURE ?? "")
    .trim()
    .toLowerCase();
  const secure =
    configuredSecure === "" ? process.env.NODE_ENV === "production" : configuredSecure === "true";

  const requested = String(process.env.COOKIE_SAMESITE || "")
    .trim()
    .toLowerCase();
  const configured = ["lax", "strict", "none"].includes(requested) ? requested : "";

  let sameSite =
    configured === "strict" || configured === "none"
      ? configured
      : isCrossSiteRequest(req)
        ? "none"
        : "lax";

  // `none` without `secure` is silently dropped by every browser (plain http dev).
  if (sameSite === "none" && !secure) sameSite = "lax";

  const domain = String(process.env.COOKIE_DOMAIN || "")
    .trim()
    .replace(/^\./, "");

  return { secure, sameSite, ...(domain ? { domain } : {}) };
}

/** Effective cookie flags, for health reporting (never includes values). */
export function cookieConfig(req) {
  return cookieSecurity(req);
}

function accessCookieOptions(req) {
  return {
    httpOnly: true,
    ...cookieSecurity(req),
    path: "/",
    maxAge: ACCESS_TTL_SECONDS * 1000,
  };
}

function refreshCookieOptions(req) {
  return {
    httpOnly: true,
    ...cookieSecurity(req),
    path: "/api/auth",
    maxAge: REFRESH_TTL_SECONDS * 1000,
  };
}

function baseClaims(user) {
  return {
    sub: String(user._id || user.id),
    email: user.email,
    name: user.name,
    plan: user.plan,
  };
}

function signAccessToken(user) {
  const secret = accessSecret();
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...baseClaims(user), typ: "access" }, secret, {
    expiresIn: ACCESS_TTL_SECONDS,
    jwtid: jti,
    issuer: "quorvexai-auth",
  });
  return { token, jti, expiresIn: ACCESS_TTL_SECONDS };
}

async function signRefreshToken(user) {
  const secret = refreshSecret();
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not configured");
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...baseClaims(user), typ: "refresh" }, secret, {
    expiresIn: REFRESH_TTL_SECONDS,
    jwtid: jti,
    issuer: "quorvexai-auth",
  });
  await redis.set(refreshKey(jti), String(user._id || user.id), "EX", REFRESH_TTL_SECONDS);
  return { token, jti };
}

export async function issueTokens(user) {
  const access = signAccessToken(user);
  const refresh = await signRefreshToken(user);
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    expiresIn: access.expiresIn,
  };
}

export function setAuthCookies(res, tokens, req) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions(req));
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(req));
}

export function clearAuthCookies(res, req) {
  // clearCookie must repeat path/domain/sameSite/secure or the browser keeps
  // the original cookie and the user stays "signed in" after logging out.
  res.clearCookie(ACCESS_COOKIE, { ...accessCookieOptions(req), maxAge: undefined });
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(req), maxAge: undefined });
}

export async function verifyAccessToken(token) {
  const secret = accessSecret();
  if (!secret) throw unauthorized("Authentication is not configured");
  let payload;
  try {
    payload = jwt.verify(token, secret, { issuer: "quorvexai-auth" });
  } catch {
    throw unauthorized("Your session expired. Please sign in again");
  }
  if (payload.typ !== "access") throw unauthorized("Invalid access token");

  if (payload.jti) {
    try {
      if (await redis.get(blockKey(payload.jti))) {
        throw unauthorized("This session was signed out");
      }
    } catch (error) {
      // The blocklist is a revocation aid, not a source of truth: access tokens
      // live 15 minutes. If the cache is down, accept the signed token (and say
      // so) rather than 503-ing every authenticated request. Refresh-token
      // writes stay strict — those genuinely need the shared store.
      if (error?.code === "REDIS_UNAVAILABLE") {
        logger.warn("token blocklist unavailable; accepting a validly signed access token");
      } else {
        throw error;
      }
    }
  }

  return payload;
}

function decodeRefresh(token) {
  const secret = refreshSecret();
  if (!secret) throw unauthorized("Authentication is not configured");
  try {
    return jwt.verify(token, secret, { issuer: "quorvexai-auth" });
  } catch {
    throw unauthorized("Your refresh token expired. Please sign in again");
  }
}

/** Single-use refresh rotation: the presented token is destroyed before reissue. */
export async function consumeRefreshToken(token) {
  const payload = decodeRefresh(token);
  if (payload.typ !== "refresh" || !payload.jti) throw unauthorized("Invalid refresh token");
  const stored = await redis.get(refreshKey(payload.jti));
  if (!stored) throw unauthorized("Refresh token already used or revoked");
  await redis.del(refreshKey(payload.jti));
  return { userId: stored, payload };
}

export async function revokeRefreshToken(token) {
  try {
    const payload = decodeRefresh(token);
    if (payload?.jti) await redis.del(refreshKey(payload.jti));
  } catch {
    /* already invalid: nothing to revoke */
  }
}

export async function revokeAllRefreshTokens(userId) {
  const keys = await redis.keys("auth:refresh:*");
  await Promise.all(
    keys.map(async (key) => {
      const owner = await redis.get(key);
      if (String(owner) === String(userId)) await redis.del(key);
    }),
  );
}

export async function revokeAccessToken(token) {
  try {
    const secret = accessSecret();
    if (!secret) return;
    const payload = jwt.verify(token, secret, { ignoreExpiration: true });
    if (!payload?.jti) return;
    const ttl = Math.max(1, Number(payload.exp || 0) - Math.floor(Date.now() / 1000));
    await redis.set(blockKey(payload.jti), "1", "EX", ttl);
  } catch {
    /* malformed tokens have nothing to block */
  }
}

/** Reads a bearer token from the Authorization header or the access cookie. */
export function extractAccessToken(req) {
  const header = req.headers?.authorization || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return req.cookies?.[ACCESS_COOKIE] || null;
}
