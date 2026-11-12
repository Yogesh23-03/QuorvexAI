import dotenv from "dotenv";
import { createApp } from "./app.js";
import { assertAuthConfig, logConfig } from "./config/services.js";
import redis from "../shared/redis/redis.js";
import { validateEnv, validators } from "../shared/env.js";
import { startServer } from "../shared/server.js";

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
    // Every proxied call carries it, and the services refuse direct calls
    // without it: a deployment that forgets it silently disables that guard.
    "INTERNAL_API_KEY",
  ],
  recommended: [
    { name: "PORT", validator: validators.port },
    { name: "REDIS_URL", validator: validators.redisUri },
    "INTERNAL_API_KEY",
  ],
});

const port = Number(process.env.PORT) || 8000;

// Fails the boot in production when the gateway cannot verify the tokens the
// auth service signs; that mismatch otherwise shows up as "everything 401s".
assertAuthConfig();

const app = createApp();
logConfig();

startServer({
  service: "gateway",
  port,
  app,
  onShutdown: [() => redis.disconnect()],
});
