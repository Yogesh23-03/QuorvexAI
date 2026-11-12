import express from "express";
import mongoose from "mongoose";
import redis from "./redis/redis.js";
import { withDeadline } from "./timeout.js";
import { appVersion } from "./version.js";
import { logger } from "./logger.js";

const mongoStates = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

const DEEP_BUDGET_MS = 2500;
const CHEAP_BUDGET_MS = 500;

/**
 * Two health surfaces, because ECS and a human need different answers.
 *
 * GET /live   — is this process up? No I/O, no dependencies, always 200 unless
 *               the event loop itself is gone. This is the ALB/ECS health check
 *               path, so a MongoDB or Redis blip can never kill healthy tasks.
 * GET /health — status only: service, version, uptime, db, redis. Always 200,
 *               with `status: "degraded"` when a dependency is down. A load
 *               balancer polling this would otherwise remove every task during
 *               a shared-dependency outage.
 * GET /health?deep=1 — adds bounded dependency probes (Redis ping, upstream
 *               reachability on the gateway). Still 200: it is a diagnostic,
 *               not a traffic decision.
 */
export function createHealthRouter({ service, requiresDb = true, extraChecks, deepChecks }) {
  const router = express.Router();

  const base = () => ({
    service,
    version: appVersion(),
    uptime: Math.round(process.uptime()),
    pid: process.pid,
  });

  router.get("/live", (_req, res) => {
    res.status(200).json({ status: "ok", ...base() });
  });

  router.get("/health", async (req, res) => {
    const deep = ["1", "true", "yes"].includes(String(req.query.deep || "").toLowerCase());
    const dbState = mongoose.connection.readyState;
    const db = {
      connected: dbState === 1,
      state: mongoStates[dbState] || "unknown",
      required: requiresDb,
    };

    // Cheap static facts (provider configured? payments configured?) — never I/O.
    let extra = {};
    if (extraChecks) {
      try {
        extra =
          (await withDeadline(Promise.resolve(extraChecks()), CHEAP_BUDGET_MS, "extras")) || {};
      } catch (error) {
        logger.warn({ err: error.message, service }, "health extras failed");
      }
    }

    // Bounded, never-throwing cache probe: a real answer instead of "not used
    // yet", and it can only cost ~1.5s even when the cache is blackholed.
    let cache;
    try {
      cache = await withDeadline(redis.health(), 1500, "redis probe timed out");
    } catch (error) {
      logger.warn({ err: error.message, service }, "health cache probe failed");
      cache = { connected: false, mode: "unavailable" };
    }

    if (deep && deepChecks) {
      try {
        extra = {
          ...extra,
          ...((await withDeadline(deepChecks(), DEEP_BUDGET_MS, "deep checks timed out")) || {}),
        };
      } catch (error) {
        logger.warn({ err: error.message, service }, "deep health probe failed");
      }
    }

    const degraded = (!db.connected && requiresDb) || cache.mode === "unavailable";

    res.status(200).json({
      status: degraded ? "degraded" : "ok",
      ...base(),
      timestamp: new Date().toISOString(),
      db,
      redis: cache,
      ...extra,
      ...(deep ? { deep: true } : {}),
    });
  });

  return router;
}

/** One-off dependency snapshot for scripts and tests. */
export function dbSnapshot() {
  const state = mongoose.connection.readyState;
  return { connected: state === 1, state: mongoStates[state] || "unknown" };
}
