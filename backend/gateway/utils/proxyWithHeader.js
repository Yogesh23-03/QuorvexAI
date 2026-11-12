import proxy from "express-http-proxy";
import { ApiError } from "../../shared/errors.js";
import { envMs } from "../../shared/timeout.js";

/**
 * Default budget for one proxied request. It is deliberately below the ALB's
 * 60s idle timeout so the caller gets a JSON 504 from us instead of an empty
 * connection reset from the load balancer.
 */
export const DEFAULT_PROXY_TIMEOUT_MS = 60000;

/**
 * Proxies one API prefix to one service.
 *
 * Two options are load-bearing:
 *
 * `parseReqBody: false` — the gateway must never parse a body. Any middleware
 * that consumes the request stream (express.json, body-parser) leaves the
 * upstream waiting for bytes that will never arrive: the request hangs until a
 * timeout and the downstream service logs nothing, because its handler never
 * runs. With this false, express-http-proxy pipes the original stream and the
 * original content-length header to the upstream untouched, so JSON and
 * multipart bodies both arrive intact.
 *
 * `stream: true` — responses are piped instead of buffered. Agent runs send
 * newline heartbeats while the graph works (see services/agent), and buffering
 * would hold those bytes until the run finished, which is exactly what trips
 * CloudFront's 30s origin-response timeout.
 */
export function proxyWithHeader(serviceUrl, options = {}) {
  const timeout = Number(options.timeout) || envMs("PROXY_TIMEOUT_MS", DEFAULT_PROXY_TIMEOUT_MS);

  return proxy(serviceUrl, {
    parseReqBody: false,
    stream: true,
    timeout,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers = proxyReqOpts.headers || {};
      proxyReqOpts.headers["x-request-id"] = srcReq.id;
      if (srcReq.user) proxyReqOpts.headers["x-user-id"] = String(srcReq.user.userId);
      if (process.env.INTERNAL_API_KEY) {
        proxyReqOpts.headers["x-internal-key"] = process.env.INTERNAL_API_KEY;
      }
      return proxyReqOpts;
    },
    proxyErrorHandler: (error, res, next) => {
      // A streamed response has already sent its head: ending it is the only
      // honest signal left, and it stops the client waiting forever.
      if (res.headersSent) {
        if (!res.writableEnded) res.destroy();
        return;
      }

      const code = error?.code;
      const timedOut =
        code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ECONNABORTED" || !code;

      const apiError = timedOut
        ? new ApiError(
            504,
            "The service did not answer in time. Please try again.",
            "GATEWAY_TIMEOUT",
          )
        : new ApiError(503, "This service is temporarily unavailable.", "SERVICE_UNAVAILABLE");
      apiError.expose = true;
      return next(apiError);
    },
    ...options,
  });
}
