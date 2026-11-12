import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDbWithRetry, disconnectDb } from "./config/db.js";
import { reportIndexDrift } from "../../shared/indexes.js";
import redis from "../../shared/redis/redis.js";
import { validateEnv, validators } from "../../shared/env.js";
import { startServer } from "../../shared/server.js";

dotenv.config({ quiet: true });
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "chat-service";

validateEnv({
  service: "chat-service",
  required: [{ name: "MONGODB_URI", validator: validators.mongoUri }],
  // The gateway injects it on every call; without it the router accepts direct
  // (unauthenticated) traffic from anything that can reach the port.
  production: ["INTERNAL_API_KEY"],
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

startServer({
  service: "chat-service",
  port,
  app,
  onShutdown: [() => stopDbRetry(), () => disconnectDb(), () => redis.disconnect()],
});
