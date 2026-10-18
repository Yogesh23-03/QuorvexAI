import express from "express";
import cookieParser from "cookie-parser";
import router from "./routes/auth.router.js";
import { createHealthRouter } from "../../shared/health.js";
import { errorHandler, notFoundHandler } from "../../shared/errors.js";
import { requestId, requestLogger } from "../../shared/request.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(requestLogger);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use(
    createHealthRouter({
      service: "auth-service",
      requiresDb: true,
      extraChecks: async () => ({
        firebase: process.env.FIREBASE_SERVICE_ACCOUNT ? "env" : "file",
      }),
    }),
  );

  app.get("/", (_req, res) => res.json({ service: "quorvexai-auth", status: "online" }));
  app.use("/", router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp;
