import dotenv from "dotenv";
import { createApp } from "./app.js";
import { logger } from "../shared/logger.js";
import { assertAuthConfig, logConfig } from "./config/services.js";
import redis from "../shared/redis/redis.js";
import { validateEnv, validators } from "../shared/env.js";

dotenv.config({ quiet: true });
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "gateway";

validateEnv({
  service: "gateway",
  production: [
    "FRONTEND_URL",
    { name: "AUTH_SERVICE", validator: validators.url },
    { name: "CHAT_SERVICE", validator: validators.url },
    { name: "AGENT_SERVICE", validator: validators.url },
    { name: "BILLING_SERVICE", validator: validators.url },
    "JWT_SECRET",
  ],
  recommended: [
    { name: "PORT", validator: validators.port },
    { name: "REDIS_URL", validator: validators.redisUri },
    "INTERNAL_API_KEY",
  ],
});

const port = Number(process.env.PORT) || 8000;
assertAuthConfig();
const app = createApp();
logConfig();

const server = app.listen(port, () => {
  logger.info({ port }, "gateway started");
});

async function shutdown(signal) {
  logger.info({ signal }, "shutting down gateway");
  server.close(async () => {
    await redis.disconnect();
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
