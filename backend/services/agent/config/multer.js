import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { badRequest } from "../../../shared/errors.js";

const uploadDir = process.env.UPLOAD_DIR || path.join(os.tmpdir(), "quorvex-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const extensionFor = (file) => {
  const original = path.extname(file.originalname || "").toLowerCase();
  if (/^\.[a-z0-9]{1,5}$/.test(original)) return original;
  return file.mimetype === "application/pdf" ? ".pdf" : ".png";
};

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    // Never trust the client filename: use a random name and a validated extension.
    cb(null, `${Date.now()}-${crypto.randomUUID()}${extensionFor(file)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  return cb(badRequest("Only PDF and image uploads are supported", "UNSUPPORTED_FILE_TYPE"));
};

export const uploadDirPath = uploadDir;

export default multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});
