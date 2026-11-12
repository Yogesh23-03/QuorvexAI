import { logger } from "./logger.js";
import { appVersion } from "./version.js";
import { envMs, withDeadline } from "./timeout.js";
import redis from "./redis/redis.js";

const SHUTDOWN_BUDGET_MS = 25000;

/**
 * One HTTP bootstrap for every service, so ECS behaviour cannot drift between
 * them.
 *
 *  - binds 0.0.0.0 (a hostname of "localhost" is unreachable from the ALB
 *    sidecar and refuses every target health check);
 *  - listens on process.env.PORT, with the service default applied by the
 *    caller for local runs only;
 *  - keepAliveTimeout (65s) is longer than the ALB idle timeout (60s), so the
 *    ALB never sends a request down a socket this process just closed;
 *  - headersTimeout (66s) is longer than keepAliveTimeout, as Node requires;
 *  - SIGTERM stops accepting, drains, closes Mongo/Redis, and exits inside the
 *    ECS stop timeout (30s) instead of being SIGKILLed mid-request.
 */
export function startServer({ service, port, app, onShutdown = [] }) {
  const server = app.listen(port, "0.0.0.0", () => {
    logger.info(
      {
        service,
        port,
        host: "0.0.0.0",
        version: appVersion(),
        node: process.version,
        pid: process.pid,
        env: process.env.NODE_ENV || "development",
      },
      `${service} listening`,
    );
  });

  // Discover a broken cache endpoint now rather than on the first user
  // request; bounded, and never fatal (the service must still boot).
  redis.warmup().catch(() => {});

  server.keepAliveTimeout = envMs("KEEP_ALIVE_TIMEOUT_MS", 65000);
  server.headersTimeout = envMs("HEADERS_TIMEOUT_MS", 66000);
  server.requestTimeout = envMs("SERVER_REQUEST_TIMEOUT_MS", 300000);

  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ service, signal }, "shutdown started");

    const hardStop = setTimeout(() => {
      logger.error({ service }, "shutdown deadline reached, exiting");
      process.exit(1);
    }, SHUTDOWN_BUDGET_MS);
    hardStop.unref?.();

    // Stop accepting new connections, then let in-flight requests finish.
    const drained = new Promise((resolve) => server.close(resolve));
    server.closeIdleConnections?.();
    setTimeout(() => server.closeAllConnections?.(), 5000).unref?.();

    try {
      await withDeadline(drained, 15000, "connections did not drain");
    } catch (error) {
      logger.warn({ err: error.message, service }, "forcing open connections closed");
    }

    const results = await Promise.allSettled(
      onShutdown.map((hook) => withDeadline(Promise.resolve().then(hook), 6000, "shutdown hook")),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn({ err: result.reason?.message, service }, "shutdown hook failed");
      }
    }

    clearTimeout(hardStop);
    logger.info({ service }, "shutdown complete");
    process.exit(0);
  }

  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      shutdown(signal).catch((error) => {
        logger.error({ err: error.message, service }, "shutdown failed");
        process.exit(1);
      });
    });
  }

  // A crashed request must not take the process down silently.
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason instanceof Error ? reason.stack : reason }, "unhandled rejection");
  });
  process.on("uncaughtException", (error) => {
    logger.error({ err: error.stack || error.message }, "uncaught exception");
  });

  return server;
}

export default startServer;
