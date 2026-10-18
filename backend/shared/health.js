import express from "express";
import mongoose from "mongoose";
import { pingRedis } from "./redis/redis.js";
import { logger } from "./logger.js";

const mongoStates = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export function createHealthRouter({ service, requiresDb = true, extraChecks }) {
  const router = express.Router();

  router.get("/health", async (req, res) => {
    let redis = { connected: false, mode: "memory" };
    let extra = {};

    try {
      redis = await pingRedis();
    } catch (error) {
      logger.warn({ err: error.message }, "health check: redis unreachable");
    }

    if (extraChecks) {
      try {
        extra = await extraChecks();
      } catch (error) {
        logger.warn({ err: error.message }, "health check: extra checks failed");
      }
    }

    const dbState = mongoose.connection.readyState;
    const db = {
      connected: dbState === 1,
      state: mongoStates[dbState] || "unknown",
    };

    const healthy = (!requiresDb || db.connected) && redis.connected;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      service,
      version: process.env.npm_package_version || "1.0.0",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      db,
      redis,
      ...extra,
    });
  });

  return router;
}
