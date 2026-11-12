import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDbWithRetry, disconnectDb } from "./config/db.js";
import { reportIndexDrift } from "../../shared/indexes.js";
import redis from "../../shared/redis/redis.js";
import { validateEnv, validators } from "../../shared/env.js";
import { startServer } from "../../shared/server.js";

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
    "INTERNAL_API_KEY",
  ],
  recommended: [
    { name: "PORT", validator: validators.port },
    { name: "REDIS_URL", validator: validators.redisUri },
    // Google sign-in is optional: email/password keeps working without it.
    "FIREBASE_SERVICE_ACCOUNT_BASE64",
    // Password-reset mail is optional: with no SMTP the link is logged instead.
    "SMTP_HOST",
    { name: "COOKIE_SAMESITE", validator: validators.booleanish },
  ],
});

const port = Number(process.env.PORT) || 8001;

const app = createApp();
const stopDbRetry = connectDbWithRetry();

// Warn (never mutate) when the live indexes no longer match the models.
mongoose.connection.once("connected", () => {
  reportIndexDrift().catch(() => undefined);
});

startServer({
  service: "auth-service",
  port,
  app,
  onShutdown: [() => stopDbRetry(), () => disconnectDb(), () => redis.disconnect()],
});
