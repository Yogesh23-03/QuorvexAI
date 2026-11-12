import crypto from "crypto";
import bcrypt from "bcryptjs";
import { firebaseAuth } from "../config/firebase.js";
import User from "../models/user.model.js";
import { AGENT_COSTS, PLANS } from "../../../shared/constants.js";
import { ApiError, badRequest, unauthorized } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";
import { applyCreditReset, creditsView, nextResetAt } from "../../../shared/creditPolicy.js";
import redis from "../../../shared/redis/redis.js";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  consumeRefreshToken,
  extractAccessToken,
  issueTokens,
  revokeAccessToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  setAuthCookies,
  verifyAccessToken,
} from "../../../shared/tokens.js";
import { sendPasswordReset } from "../mailer.js";
import {
  forgotSchema,
  parse,
  passwordLoginSchema,
  registerSchema,
  resetSchema,
} from "../validation.js";

const BCRYPT_ROUNDS = 12;
const RESET_TTL_SECONDS = 30 * 60;
const GENERIC_LOGIN_ERROR = "Invalid email or password";

const resetKey = (token) =>
  `auth:reset:${crypto.createHash("sha256").update(String(token)).digest("hex")}`;

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

function publicUser(user) {
  const json = user.toJSON();
  json.nextResetAt = nextResetAt(user);
  return json;
}

async function loadUser(userId) {
  if (!userId) return null;
  await applyCreditReset(User, userId);
  return User.findById(userId);
}

async function respondWithTokens(req, res, user, status = 200) {
  const tokens = await issueTokens(user);
  // The request decides the cookie flags: a cross-site SPA needs SameSite=None
  // or the browser will not send the session back on the next page load.
  setAuthCookies(res, tokens, req);
  return res.status(status).json({ ...publicUser(user), ...tokens });
}

function addProvider(user, provider) {
  if (!user.authProviders?.includes(provider)) {
    user.authProviders = [...(user.authProviders || []), provider];
  }
}

/* ------------------------------------------------------------------ Google */

async function loginWithFirebaseToken(req, res, token) {
  let decoded;
  try {
    decoded = await firebaseAuth().verifyIdToken(token, true);
  } catch (error) {
    logger.warn({ err: error.message }, "firebase token rejected");
    throw unauthorized("Sign-in failed. Please try again.");
  }

  const email = normalizeEmail(decoded.email);
  let user = await User.findOne({
    $or: [{ firebaseUid: decoded.uid }, ...(email ? [{ email }] : [])],
  });

  if (!user) {
    user = await User.create({
      firebaseUid: decoded.uid,
      name: decoded.name || email?.split("@")[0] || "Explorer",
      email: email || undefined,
      avatar: decoded.picture,
      authProviders: ["google"],
    });
    logger.info({ userId: String(user._id) }, "new user created with free credits");
  } else {
    // Account linking: an email/password account with the same address becomes
    // the same account instead of a duplicate.
    if (!user.firebaseUid) user.firebaseUid = decoded.uid;
    if (decoded.picture && decoded.picture !== user.avatar) user.avatar = decoded.picture;
    if (!user.name && decoded.name) user.name = decoded.name;
    addProvider(user, "google");
    await user.save();
  }

  return respondWithTokens(req, res, user);
}

/* ------------------------------------------------------ Email + password */

export async function register(req, res, next) {
  try {
    const { name, email, password } = parse(registerSchema, req.body);
    const existing = await User.findOne({ email }).select("+passwordHash");

    if (existing?.passwordHash) {
      return next(new ApiError(409, "An account with this email already exists", "EMAIL_IN_USE"));
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let user;
    if (existing) {
      // Link the password to a Google-created account with the same email.
      existing.passwordHash = passwordHash;
      if (!existing.name) existing.name = name;
      addProvider(existing, "password");
      await existing.save();
      user = existing;
      logger.info({ userId: String(user._id) }, "password linked to existing account");
    } else {
      user = await User.create({
        name,
        email,
        passwordHash,
        authProviders: ["password"],
      });
      logger.info({ userId: String(user._id) }, "user registered with email and password");
    }

    return respondWithTokens(req, res, user, 201);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { token } = req.body || {};
    if (typeof token === "string" && token.length >= 20) {
      return await loginWithFirebaseToken(req, res, token);
    }

    const { email, password } = parse(passwordLoginSchema, req.body);
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user?.passwordHash) return next(unauthorized(GENERIC_LOGIN_ERROR));

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) return next(unauthorized(GENERIC_LOGIN_ERROR));

    addProvider(user, "password");
    await user.save();

    return respondWithTokens(req, res, user);
  } catch (error) {
    return next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
    if (!token) return next(unauthorized("No refresh token provided"));

    const { userId } = await consumeRefreshToken(token);
    const user = await loadUser(userId);
    if (!user) return next(unauthorized("Account no longer exists"));

    return respondWithTokens(req, res, user);
  } catch (error) {
    return next(error);
  }
}

export async function logOut(req, res, next) {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
    if (refreshToken) await revokeRefreshToken(refreshToken);
    await revokeAccessToken(extractAccessToken(req));
    clearAuthCookies(res, req);
    // Clear the legacy Redis session cookie too, if one is still around.
    res.clearCookie("session", { path: "/" });
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (error) {
    return next(error);
  }
}

/* ----------------------------------------------------------- Profile / me */

async function resolveUserId(req) {
  if (req.headers["x-user-id"]) return req.headers["x-user-id"];
  const token = extractAccessToken(req);
  if (!token) return null;
  const payload = await verifyAccessToken(token);
  return payload.sub;
}

export async function me(req, res, next) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return next(unauthorized());

    const user = await loadUser(userId);
    if (!user) return next(new ApiError(404, "User not found", "NOT_FOUND"));

    return res.status(200).json(publicUser(user));
  } catch (error) {
    return next(error);
  }
}

export async function credits(req, res, next) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return next(unauthorized());

    const user = await loadUser(userId);
    if (!user) return next(new ApiError(404, "User not found", "NOT_FOUND"));

    return res.status(200).json({
      userId: String(user._id),
      ...creditsView(user),
      plan: user.plan,
    });
  } catch (error) {
    return next(error);
  }
}

/* -------------------------------------------------------- Password reset */

export async function forgotPassword(req, res, next) {
  try {
    const { email } = parse(forgotSchema, req.body);
    const user = await User.findOne({ email });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      await redis.set(resetKey(rawToken), String(user._id), "EX", RESET_TTL_SECONDS);

      const base = process.env.FRONTEND_URL || "http://localhost:5173";
      const link = `${base.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
      await sendPasswordReset(email, link).catch((error) =>
        logger.warn({ err: error.message }, "password reset mail failed"),
      );
      logger.info({ userId: String(user._id) }, "password reset link issued");
    }

    // Always the same response: never reveal whether an account exists.
    return res.status(200).json({
      success: true,
      message: "If that email exists, a reset link has been sent.",
    });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, password } = parse(resetSchema, req.body);
    const key = resetKey(token);
    const userId = await redis.get(key);
    if (!userId) {
      return next(badRequest("That reset link is invalid or has expired", { field: "token" }));
    }

    // Single use: delete before writing so a replay cannot race the update.
    await redis.del(key);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { passwordHash }, $addToSet: { authProviders: "password" } },
      { returnDocument: "after" },
    );
    if (!user) return next(badRequest("That reset link is invalid or has expired"));

    await revokeAllRefreshTokens(userId);
    logger.info({ userId: String(user._id) }, "password reset completed");

    return res.status(200).json({ success: true, message: "Password updated" });
  } catch (error) {
    return next(error);
  }
}

/* ------------------------------------------------------- Plan / credits */

export async function updateUserPayment(req, res, next) {
  try {
    const { plan, credits, userId } = req.body || {};
    const selectedPlan = PLANS[plan];

    if (!selectedPlan || selectedPlan.id === "free") return next(badRequest("Unknown plan"));
    if (!userId) return next(badRequest("userId is required"));
    if (Number(credits) !== selectedPlan.credits) {
      return next(badRequest("Credit amount does not match the selected plan"));
    }

    const expiresAt = new Date(Date.now() + selectedPlan.validity * 24 * 60 * 60 * 1000);
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: { plan: selectedPlan.id, planExpiresAt: expiresAt },
        $inc: { credits: selectedPlan.credits, totalCredits: selectedPlan.credits },
      },
      { returnDocument: "after" },
    );

    if (!user) return next(new ApiError(404, "User not found", "NOT_FOUND"));

    logger.info({ userId, plan: selectedPlan.id, credits: selectedPlan.credits }, "plan upgraded");
    return res.status(200).json({ success: true, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

export async function deductCredits(req, res, next) {
  try {
    const { userId, agent } = req.body || {};
    if (!userId) return next(badRequest("userId is required"));

    const cost = AGENT_COSTS[agent];
    if (!cost) return next(badRequest(`Unknown agent: ${agent}`));

    // Top up first if the 5h window elapsed, then charge in one atomic update.
    await applyCreditReset(User, userId);

    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: cost } },
      { $inc: { credits: -cost } },
      { returnDocument: "after" },
    );

    if (!user) {
      const exists = await User.exists({ _id: userId });
      if (!exists) return next(new ApiError(404, "User not found", "NOT_FOUND"));
      return next(
        new ApiError(
          402,
          "You are out of credits. Upgrade to keep creating.",
          "INSUFFICIENT_CREDITS",
          { required: cost },
        ),
      );
    }

    return res.status(200).json({
      success: true,
      credits: user.credits,
      cost,
      nextResetAt: nextResetAt(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function refundCredits(req, res, next) {
  try {
    const { userId, agent } = req.body || {};
    if (!userId) return next(badRequest("userId is required"));

    const cost = AGENT_COSTS[agent];
    if (!cost) return next(badRequest(`Unknown agent: ${agent}`));

    // Atomic cap at totalCredits so a refund can never exceed the purchased pool.
    // Mongoose 9 needs updatePipeline for aggregation-style updates.
    const user = await User.findOneAndUpdate(
      { _id: userId },
      [{ $set: { credits: { $min: [{ $add: ["$credits", cost] }, "$totalCredits"] } } }],
      { returnDocument: "after", updatePipeline: true },
    );
    if (!user) return next(new ApiError(404, "User not found", "NOT_FOUND"));

    logger.warn({ userId, agent, cost }, "credits refunded after failed agent run");
    return res.status(200).json({ success: true, credits: user.credits, refunded: cost });
  } catch (error) {
    return next(error);
  }
}
