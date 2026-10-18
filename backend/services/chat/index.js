import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDbWithRetry, disconnectDb } from "./config/db.js";
import { logger } from "../../shared/logger.js";
import { reportIndexDrift } from "../../shared/indexes.js";
import redis from "../../shared/redis/redis.js";
import { validateEnv, validators } from "../../shared/env.js";

dotenv.config({ quiet: true });
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "chat-service";

validateEnv({
  service: "chat-service",
  required: [{ name: "MONGODB_URI", validator: validators.mongoUri }],
  recommended: [
    { name: "PORT", validator: validators.port },
    { name: "REDIS_URL", validator: validators.redisUri },
    "INTERNAL_API_KEY",
  ],
});

const port = Number(process.env.PORT) || 8002;

const app = createApp();
const stopDbRetry = connectDbWithRetry();

mongoose.connection.once("connected", () => {
  reportIndexDrift().catch(() => undefined);
});

const server = app.listen(port, () => {
  logger.info({ port }, "chat service started");
});

async function shutdown(signal) {
  logger.info({ signal }, "shutting down chat service");
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
