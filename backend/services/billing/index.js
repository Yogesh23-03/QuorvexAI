import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDbWithRetry, disconnectDb } from "./config/db.js";
import { reportIndexDrift } from "../../shared/indexes.js";
import redis from "../../shared/redis/redis.js";
import { validateEnv, validators } from "../../shared/env.js";
import { startServer } from "../../shared/server.js";

dotenv.config({ quiet: true });
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "billing-service";

validateEnv({
  service: "billing-service",
  required: [{ name: "MONGODB_URI", validator: validators.mongoUri }],
  production: [
    { name: "AUTH_SERVICE", validator: validators.url },
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "INTERNAL_API_KEY",
  ],
  recommended: [
    { name: "PORT", validator: validators.port },
    { name: "REDIS_URL", validator: validators.redisUri },
  ],
});

const port = Number(process.env.PORT) || 8004;

const app = createApp();
const stopDbRetry = connectDbWithRetry();

mongoose.connection.once("connected", () => {
  reportIndexDrift().catch(() => undefined);
});

startServer({
  service: "billing-service",
  port,
  app,
  onShutdown: [() => stopDbRetry(), () => disconnectDb(), () => redis.disconnect()],
});
