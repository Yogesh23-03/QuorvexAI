import crypto from "crypto";
import jwt from "jsonwebtoken";
import redis from "./redis/redis.js";
import { unauthorized } from "./errors.js";

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

function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL_SECONDS * 1000,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: REFRESH_TTL_SECONDS * 1000,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
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

export function setAuthCookies(res, tokens) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...accessCookieOptions(), maxAge: undefined });
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
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
  if (payload.jti && (await redis.get(blockKey(payload.jti)))) {
    throw unauthorized("This session was signed out");
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
