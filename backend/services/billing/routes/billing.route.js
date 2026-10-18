import express from "express";
import {
  createOrder,
  getCredits,
  paymentHistory,
  verifyPayment,
} from "../controllers/billing.controller.js";
import { requireInternalKey } from "../../../shared/internalAuth.js";
import { asyncHandler } from "../../../shared/errors.js";

const router = express.Router();

router.use(requireInternalKey);

router.get("/credits", asyncHandler(getCredits));
router.post("/create", asyncHandler(createOrder));
router.post("/verify", asyncHandler(verifyPayment));
router.get("/payments", asyncHandler(paymentHistory));

export default router;
