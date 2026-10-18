import proxy from "express-http-proxy";
import { ApiError } from "../../shared/errors.js";

const DEFAULT_TIMEOUT_MS = 180000;

/**
 * Proxy that forwards identity + tracing headers to a downstream service.
 * Long timeouts are required because agent calls block on LLM providers.
 */
export function proxyWithHeader(serviceUrl, options = {}) {
  return proxy(serviceUrl, {
    // Stream the raw body so multipart uploads (PDF/PPT/image) survive intact.
    parseReqBody: false,
    timeout: Number(process.env.PROXY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-request-id"] = srcReq.id;
      if (srcReq.user) proxyReqOpts.headers["x-user-id"] = String(srcReq.user.userId);
      if (process.env.INTERNAL_API_KEY) {
        proxyReqOpts.headers["x-internal-key"] = process.env.INTERNAL_API_KEY;
      }
      return proxyReqOpts;
    },
    proxyErrorHandler: (error, res, next) => {
      if (res.headersSent) return;
      if (
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ECONNREFUSED"
      ) {
        return next(new ApiError(503, "Service temporarily unavailable", "SERVICE_UNAVAILABLE"));
      }
      return next(new ApiError(502, "Upstream service error", "BAD_GATEWAY"));
    },
    ...options,
  });
}
