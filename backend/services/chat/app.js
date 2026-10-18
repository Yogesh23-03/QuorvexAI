import express from "express";
import router from "./routes/chat.routes.js";
import { createHealthRouter } from "../../shared/health.js";
import { errorHandler, notFoundHandler } from "../../shared/errors.js";
import { requestId, requestLogger } from "../../shared/request.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(requestLogger);
  app.use(express.json({ limit: "2mb" }));

  app.use(createHealthRouter({ service: "chat-service", requiresDb: true }));
  app.get("/", (_req, res) => res.json({ service: "quorvexai-chat", status: "online" }));
  app.use("/", router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp;
