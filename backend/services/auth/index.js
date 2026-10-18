import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDbWithRetry, disconnectDb } from "./config/db.js";
import { logger } from "../../shared/logger.js";
import { reportIndexDrift } from "../../shared/indexes.js";
import redis from "../../shared/redis/redis.js";
import { validateEnv, validators } from "../../shared/env.js";

dotenv.config({ quiet: true });
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "auth-service";

validateEnv({
  service: "auth-service",
  required: [{ name: "MONGODB_URI", validator: validators.mongoUri }],
  production: [
    "FRONTEND_URL",
    // Development falls back to throw-away secrets; production never does.
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
  ],
  recommended: [
    { name: "PORT", validator: validators.port },
    { name: "REDIS_URL", validator: validators.redisUri },
    "INTERNAL_API_KEY",
    "FIREBASE_SERVICE_ACCOUNT",
    "FIREBASE_SERVICE_ACCOUNT_BASE64",
    "SMTP_HOST",
  ],
});

const port = Number(process.env.PORT) || 8001;

const app = createApp();
const stopDbRetry = connectDbWithRetry();

// Warn (never mutate) when the live indexes no longer match the models.
mongoose.connection.once("connected", () => {
  reportIndexDrift().catch(() => undefined);
});

const server = app.listen(port, () => {
  logger.info({ port }, "auth service started");
});

async function shutdown(signal) {
  logger.info({ signal }, "shutting down auth service");
  stopDbRetry();
  server.close(async () => {
    await Promise.allSettled([disconnectDb(), redis.disconnect()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason instanceof Error ? reason.message : reason }, "unhandled rejection");
});
process.on("uncaughtException", (error) => {
  logger.error({ err: error.message }, "uncaught exception");
});
