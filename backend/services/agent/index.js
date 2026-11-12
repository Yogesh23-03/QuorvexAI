import dotenv from "dotenv";
import fs from "fs";
import { createApp } from "./app.js";
import { connectDbWithRetry, disconnectDb } from "./config/db.js";
import redis from "../../shared/redis/redis.js";
import { uploadDirPath } from "./config/multer.js";
import { validateEnv, validators } from "../../shared/env.js";
import { startServer } from "../../shared/server.js";

dotenv.config({ quiet: true });
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "agent-service";

validateEnv({
  service: "agent-service",
  required: [{ name: "MONGODB_URI", validator: validators.mongoUri }],
  production: [
    { name: "AUTH_SERVICE", validator: validators.url },
    { name: "CHAT_SERVICE", validator: validators.url },
    "INTERNAL_API_KEY",
  ],
  recommended: [
    { name: "PORT", validator: validators.port },
    { name: "REDIS_URL", validator: validators.redisUri },
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

startServer({
  service: "agent-service",
  port,
  app,
  onShutdown: [() => stopDbRetry(), () => disconnectDb(), () => redis.disconnect()],
});
