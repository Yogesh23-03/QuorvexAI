import express from "express";
import {
  credits,
  deductCredits,
  forgotPassword,
  login,
  logOut,
  me,
  refresh,
  refundCredits,
  register,
  resetPassword,
  updateUserPayment,
} from "../controllers/auth.controller.js";
import { requireInternalKey } from "../../../shared/internalAuth.js";
import { asyncHandler } from "../../../shared/errors.js";
import { rateLimit } from "../../../shared/rateLimit.js";

const router = express.Router();

const authKey = (req) =>
  `${req.ip}:${String(req.body?.email || "anonymous")
    .trim()
    .toLowerCase()}`;

const credentialLimiter = rateLimit({
  max: 5,
  windowSeconds: 15 * 60,
  prefix: "rl:auth-credentials",
  keyGenerator: authKey,
  message: "Too many attempts. Please wait 15 minutes before trying again.",
});

const resetLimiter = rateLimit({
  max: 3,
  windowSeconds: 15 * 60,
  prefix: "rl:auth-reset",
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || "anonymous").toLowerCase()}`,
  message: "Too many reset requests. Please wait 15 minutes.",
});

router.post("/register", credentialLimiter, asyncHandler(register));
router.post("/login", credentialLimiter, asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logOut));
router.get("/logout", asyncHandler(logOut));
router.post("/forgot-password", resetLimiter, asyncHandler(forgotPassword));
router.post("/reset-password", resetLimiter, asyncHandler(resetPassword));

// Reachable through the gateway (which forwards identity) or with a JWT.
router.get("/me", asyncHandler(me));
router.get("/credits", asyncHandler(credits));

// Service-to-service endpoints only.
router.post("/update-plan", requireInternalKey, asyncHandler(updateUserPayment));
router.post("/deduct-credits", requireInternalKey, asyncHandler(deductCredits));
router.post("/refund-credits", requireInternalKey, asyncHandler(refundCredits));

export default router;
