import pino from "pino";

const isTest = process.env.NODE_ENV === "test";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? "silent" : "info"),
  base: {
    service: process.env.SERVICE_NAME || "quorvex-service",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "*.token",
      "*.razorpay_signature",
      "*.password",
      "*.secret",
    ],
    censor: "[redacted]",
  },
});

export default logger;
