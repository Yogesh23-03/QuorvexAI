import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "../shared/logger.js";
import { errorHandler, notFoundHandler } from "../shared/errors.js";
import { requestId, requestTimeout } from "../shared/request.js";
import { rateLimit } from "../shared/rateLimit.js";
import { createHealthRouter } from "../shared/health.js";
import { envMs } from "../shared/timeout.js";
import { appVersion } from "../shared/version.js";
import protect from "./middleware/auth.middleware.js";
import { proxyWithHeader } from "./utils/proxyWithHeader.js";
import { getCurrentUser } from "./controllers/user.controller.js";
import { allowedOrigins, serviceUrl } from "./config/services.js";

const UPSTREAMS = ["AUTH_SERVICE", "CHAT_SERVICE", "AGENT_SERVICE", "BILLING_SERVICE"];
const UPSTREAM_PROBE_TIMEOUT_MS = 1500;

/**
 * Agent runs legitimately take minutes. They keep their own connection alive
 * with heartbeats and are bounded by AGENT_PROXY_TIMEOUT_MS instead of the
 * normal per-request budget.
 */
const AGENT_PROXY_TIMEOUT_MS = envMs(
  "AGENT_PROXY_TIMEOUT_MS",
  envMs("AGENT_TIMEOUT_MS", 180000) + 30000,
);

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Exactly one proxy (ALB or CloudFront) sits in front: rate-limit keys and
  // req.ip must come from the last hop, never from a client-supplied header.
  app.set("trust proxy", 1);

  app.use(requestId);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        const allowlist = allowedOrigins();
        if (!origin || allowlist.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
      maxAge: 600,
    }),
  );
  app.use(cookieParser());

  // API responses depend on the caller's session, so they must never be stored
  // or revalidated by a browser, CloudFront or an ALB cache (a 304 would replay
  // one account's body to whichever request asked next).
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    next();
  });

  // Last line of defence: a wedged upstream becomes a logged 503 instead of a
  // request that never finishes. Agent runs keep their own connection alive
  // with heartbeats and are bounded by AGENT_PROXY_TIMEOUT_MS instead.
  app.use(
    requestTimeout(envMs("REQUEST_TIMEOUT_MS", 30000), (req) => req.path.startsWith("/api/agent")),
  );

  app.use(
    createHealthRouter({
      service: "gateway",
      requiresDb: false,
      // Upstream reachability is I/O, so it belongs behind ?deep=1 and is
      // answered from /live (dependency-free) with a short, hard timeout. A
      // slow upstream must never make the gateway look unhealthy to the ALB.
      deepChecks: async () => {
        const checks = {};
        await Promise.all(
          UPSTREAMS.map(async (name) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), UPSTREAM_PROBE_TIMEOUT_MS);
            try {
              const response = await fetch(`${serviceUrl(name)}/live`, {
                signal: controller.signal,
                headers: {
                  "x-request-id": `health-${Date.now()}`,
                  ...(process.env.INTERNAL_API_KEY
                    ? { "x-internal-key": process.env.INTERNAL_API_KEY }
                    : {}),
                },
              });
              checks[name] = response.ok ? "up" : `http-${response.status}`;
            } catch {
              checks[name] = "down";
            } finally {
              clearTimeout(timer);
            }
          }),
        );
        return { upstreams: checks };
      },
    }),
  );

  app.get("/", (_req, res) => {
    res.json({ service: "quorvexai-gateway", version: appVersion(), status: "online" });
  });

  // Login is the only unauthenticated write path, so it gets the tightest limit.
  app.use(
    "/api/auth/login",
    rateLimit({ max: 20, windowSeconds: 60, prefix: "rl:login", keyGenerator: (req) => req.ip }),
  );
  app.use("/api/auth", proxyWithHeader(serviceUrl("AUTH_SERVICE")));

  app.use(
    "/api/chat",
    protect,
    rateLimit({ max: 120, windowSeconds: 60, prefix: "rl:chat" }),
    proxyWithHeader(serviceUrl("CHAT_SERVICE")),
  );

  app.use(
    "/api/agent",
    protect,
    rateLimit({ max: 30, windowSeconds: 60, prefix: "rl:agent" }),
    proxyWithHeader(serviceUrl("AGENT_SERVICE"), { timeout: AGENT_PROXY_TIMEOUT_MS }),
  );

  app.use(
    "/api/billing",
    protect,
    rateLimit({ max: 30, windowSeconds: 60, prefix: "rl:billing" }),
    proxyWithHeader(serviceUrl("BILLING_SERVICE")),
  );

  app.get("/api/me", protect, getCurrentUser);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
