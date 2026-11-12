import express from "express";
import router from "./routes/billing.route.js";
import { createHealthRouter } from "../../shared/health.js";
import { errorHandler, notFoundHandler } from "../../shared/errors.js";
import { requestId, requestLogger, requestTimeout } from "../../shared/request.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(requestLogger);
  app.use(express.json({ limit: "1mb" }));
  app.use(requestTimeout());

  app.use(
    createHealthRouter({
      service: "billing-service",
      requiresDb: true,
      extraChecks: async () => ({ razorpay: Boolean(process.env.RAZORPAY_KEY_ID) }),
    }),
  );

  app.get("/", (_req, res) => res.json({ service: "quorvexai-billing", status: "online" }));
  app.use("/", router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp;
