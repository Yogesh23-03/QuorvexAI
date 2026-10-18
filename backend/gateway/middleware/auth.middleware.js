import { readSession } from "../../shared/session.js";
import { extractAccessToken, verifyAccessToken } from "../../shared/tokens.js";
import { unauthorized } from "../../shared/errors.js";

const SESSION_COOKIE = "session";

/**
 * One auth gate for every client type.
 *
 * - Email/password and Google sign-ins both end in a QuorvexAI JWT, so a single
 *   verifier covers them. Firebase ID tokens are exchanged at /api/auth/login;
 *   they are never accepted directly by downstream services.
 * - Legacy Redis session cookies are still honoured for sessions created before
 *   the JWT rollout, then naturally expire.
 */
export default async function protect(req, _res, next) {
  try {
    const token = extractAccessToken(req);

    if (token) {
      const payload = await verifyAccessToken(token);
      req.user = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        plan: payload.plan,
      };
      req.authType = "jwt";
      return next();
    }

    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (sessionId) {
      const session = await readSession(sessionId);
      if (session) {
        req.user = session;
        req.sessionId = sessionId;
        req.authType = "legacy-session";
        return next();
      }
      // A cookie that no longer resolves means the session ended elsewhere.
      return next(unauthorized("Your session has expired. Please sign in again."));
    }

    return next(unauthorized("Please sign in to continue"));
  } catch (error) {
    return next(error);
  }
}
