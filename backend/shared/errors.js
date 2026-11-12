import { logger } from "./logger.js";

export class ApiError extends Error {
  constructor(
    status = 500,
    message = "Internal server error",
    code = "INTERNAL_ERROR",
    details = undefined,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    // 4xx messages are written for the caller. A 5xx message is only exposed
    // when the raiser opts in, because stack traces and driver text must never
    // reach a browser.
    this.expose = status < 500;
  }
}

export const badRequest = (message, details) => new ApiError(400, message, "BAD_REQUEST", details);
export const unauthorized = (message = "Unauthorized") =>
  new ApiError(401, message, "UNAUTHORIZED");
export const forbidden = (message = "Forbidden") => new ApiError(403, message, "FORBIDDEN");
export const notFound = (message = "Not found") => new ApiError(404, message, "NOT_FOUND");
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.originalUrl} not found` },
    requestId: req.id,
  });
}

export function errorHandler(error, req, res, _next) {
  const status = Number(error.status || error.statusCode) || 500;
  const code = error.code || (status === 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED");
  const isServerError = status >= 500;

  if (isServerError) {
    logger.error(
      { err: error, requestId: req.id, path: req.originalUrl, method: req.method },
      "request failed",
    );
  }

  // A streamed response (agent heartbeat) has already sent its head; the only
  // honest thing left is to end it rather than pretend a status can change.
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      // 503/504 raised deliberately (cache down, request budget spent) carry a
      // message that is safe and useful, so the client can tell "retry" apart
      // from "something broke".
      message:
        isServerError && error.expose !== true
          ? "Something went wrong. Please try again."
          : error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    requestId: req.id,
  });
}
