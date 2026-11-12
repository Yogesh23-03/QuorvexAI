import express from "express";
import cookieParser from "cookie-parser";
import router from "./routes/auth.router.js";
import { createHealthRouter } from "../../shared/health.js";
import { errorHandler, notFoundHandler } from "../../shared/errors.js";
import { requestId, requestLogger, requestTimeout } from "../../shared/request.js";
import { cookieConfig } from "../../shared/tokens.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(requestLogger);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestTimeout());

  app.use(
    createHealthRouter({
      service: "auth-service",
      requiresDb: true,
      // Presence booleans and effective cookie flags: never a credential, but
      // enough to answer "why is the browser dropping the session cookie?".
      extraChecks: async () => {
        const { secure, sameSite } = cookieConfig();
        return {
          firebase: Boolean(
            process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT,
          ),
          smtp: Boolean(process.env.SMTP_HOST),
          cookies: { secure, sameSite },
        };
      },
    }),
  );

  app.get("/", (_req, res) => res.json({ service: "quorvexai-auth", status: "online" }));
  app.use("/", router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp;
