import express from "express";
import router from "./routes/agent.route.js";
import { createHealthRouter } from "../../shared/health.js";
import { errorHandler, notFoundHandler } from "../../shared/errors.js";
import { requestId, requestLogger, requestTimeout } from "../../shared/request.js";
import { envMs } from "../../shared/timeout.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(requestLogger);

  // Multipart uploads are streamed to multer; JSON bodies stay small here.
  app.use(express.json({ limit: "1mb" }));
  // A run is bounded by AGENT_TIMEOUT_MS plus room for the credit/chat calls.
  app.use(
    requestTimeout(envMs("AGENT_REQUEST_TIMEOUT_MS", envMs("AGENT_TIMEOUT_MS", 180000) + 30000)),
  );

  app.use(
    createHealthRouter({
      service: "agent-service",
      requiresDb: false,
      extraChecks: async () => ({
        providers: {
          groq: Boolean(process.env.GROQ_API_KEY),
          gemini: Boolean(process.env.GOOGLE_API_KEY),
          openrouter: Boolean(process.env.OPENROUTER_API_KEY),
          tavily: Boolean(process.env.TAVILY_API_KEY),
          storage: Boolean(process.env.AWS_BUCKET_NAME),
          vectorDb: Boolean(process.env.QDRANT_URL),
        },
      }),
    }),
  );

  app.get("/", (_req, res) => res.json({ service: "quorvexai-agent", status: "online" }));
  app.use("/", router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp;
