import dotenv from "dotenv";
import fs from "fs";
import { createApp } from "./app.js";
import { connectDbWithRetry, disconnectDb } from "./config/db.js";
import { logger } from "../../shared/logger.js";
import redis from "../../shared/redis/redis.js";
import { uploadDirPath } from "./config/multer.js";
import { validateEnv, validators } from "../../shared/env.js";

dotenv.config({ quiet: true });
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "agent-service";

validateEnv({
  service: "agent-service",
  required: [{ name: "MONGODB_URI", validator: validators.mongoUri }],
  production: [
    { name: "AUTH_SERVICE", validator: validators.url },
    { name: "CHAT_SERVICE", validator: validators.url },
  ],
  recommended: [
    { name: "PORT", validator: validators.port },
    { name: "REDIS_URL", validator: validators.redisUri },
    "INTERNAL_API_KEY",
    "OPENROUTER_API_KEY",
    "GROQ_API_KEY",
    "GOOGLE_API_KEY",
    "TAVILY_API_KEY",
    { name: "QDRANT_URL", validator: validators.url },
    "AWS_BUCKET_NAME",
  ],
});

const port = Number(process.env.PORT) || 8003;

const app = createApp();

// The agent service does not own user data, but it holds the platform Mongo
// connection so /health reports dependency state like every other service.
const stopDbRetry = connectDbWithRetry();

fs.mkdirSync(uploadDirPath, { recursive: true });

const server = app.listen(port, () => {
  logger.info({ port, uploadDir: uploadDirPath }, "agent service started");
});

async function shutdown(signal) {
  logger.info({ signal }, "shutting down agent service");
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
