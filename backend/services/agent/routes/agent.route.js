import express from "express";
import multer from "multer";
import { agent } from "../controllers/agent.controller.js";
import upload from "../config/multer.js";
import { requireInternalKey } from "../../../shared/internalAuth.js";
import { ApiError, asyncHandler } from "../../../shared/errors.js";

const router = express.Router();

router.use(requireInternalKey);

const uploadSingle = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return next(
        new ApiError(status, "Upload rejected: files must be 20MB or smaller", error.code),
      );
    }
    return next(error);
  });
};

router.post("/chat", uploadSingle, asyncHandler(agent));

export default router;
