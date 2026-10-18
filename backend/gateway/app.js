import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "../shared/logger.js";
import { errorHandler, notFoundHandler } from "../shared/errors.js";
import { requestId } from "../shared/request.js";
import { rateLimit } from "../shared/rateLimit.js";
import { createHealthRouter } from "../shared/health.js";
import protect from "./middleware/auth.middleware.js";
import { proxyWithHeader } from "./utils/proxyWithHeader.js";
import { getCurrentUser } from "./controllers/user.controller.js";
import { allowedOrigins, serviceUrl } from "./config/services.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
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
    }),
  );
  app.use(cookieParser());

  app.use(
    createHealthRouter({
      service: "gateway",
      requiresDb: false,
      extraChecks: async () => {
        const checks = {};
        await Promise.all(
          ["AUTH_SERVICE", "CHAT_SERVICE", "AGENT_SERVICE", "BILLING_SERVICE"].map(async (name) => {
            try {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 2000);
              const response = await fetch(`${serviceUrl(name)}/health`, {
                signal: controller.signal,
              });
              clearTimeout(timer);
              checks[name] = response.ok ? "up" : "degraded";
            } catch {
              checks[name] = "down";
            }
          }),
        );
        return { upstreams: checks };
      },
    }),
  );

  app.get("/", (_req, res) => {
    res.json({ service: "quorvexai-gateway", version: "1.0.0", status: "online" });
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
    proxyWithHeader(serviceUrl("AGENT_SERVICE")),
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
