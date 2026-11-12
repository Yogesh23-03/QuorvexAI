import mongoose from "mongoose";
import { logger } from "./logger.js";
import { envMs, sleep, withDeadline } from "./timeout.js";

const MONGO_SCHEMES = ["mongodb://", "mongodb+srv://"];
const MAX_RETRY_DELAY_MS = 60000;

/**
 * Turns the driver's error into the one thing the operator has to change.
 * A raw "Authentication failed" is useless without knowing which knob to turn.
 */
function explainMongoError(message = "", uri = "") {
  const text = message.toLowerCase();

  if (text.includes("bad auth") || text.includes("authentication failed")) {
    return (
      "credentials rejected: the MONGODB_URI username/password is wrong, the DB user " +
      "was deleted or rotated (Atlas → Database Access), or the password is not " +
      "percent-encoded. Use a local URI (mongodb://127.0.0.1:27017/quorvex_<service>) " +
      "for local development."
    );
  }
  if (text.includes("querysrv") || text.includes("enotfound") || text.includes("eai_again")) {
    if (uri.includes("+srv")) {
      return "SRV lookup failed: the cluster hostname is wrong or DNS is blocked (ECS needs a NAT gateway).";
    }
    return "host not found: check the MONGODB_URI hostname.";
  }
  if (text.includes("econnrefused")) {
    return "connection refused: nothing is listening on that host/port — start mongod locally.";
  }
  if (text.includes("selection timeout") || text.includes("etimedout")) {
    return "server selection timed out: usually an IP allowlist or firewall block (Atlas → Network Access, or the ECS security group / NAT gateway).";
  }
  if (text.includes("ip whitelist") || text.includes("not allowed to access")) {
    return "this IP is not allowlisted on the cluster (Atlas → Network Access; add the NAT gateway EIP).";
  }
  if (text.includes("econnreset") || text.includes("network")) {
    return "network error: check connectivity to the database host.";
  }
  return "unexpected database error.";
}

/** Logs a connection failure once, and only again when the reason changes. */
function createFailureReporter() {
  let lastMessage = "";
  return (error, uri) => {
    if (error.message === lastMessage) return;
    lastMessage = error.message;
    logger.error(
      { err: error.message, hint: explainMongoError(error.message, uri) },
      "mongo connection failed",
    );
  };
}

const connectOptions = () => ({
  // Bounded: never sit in server selection for the driver default of 30s.
  serverSelectionTimeoutMS: envMs("MONGO_SERVER_SELECTION_TIMEOUT_MS", 10000),
  connectTimeoutMS: envMs("MONGO_CONNECT_TIMEOUT_MS", 10000),
  socketTimeoutMS: envMs("MONGO_SOCKET_TIMEOUT_MS", 45000),
  maxPoolSize: envMs("MONGO_MAX_POOL_SIZE", 10),
  minPoolSize: 0,
  maxIdleTimeMS: 60000,
  retryWrites: true,
});

export async function connectDb(uri = process.env.MONGODB_URI) {
  if (!uri) {
    logger.error("MONGODB_URI is not configured; database features are disabled");
    return null;
  }

  if (!MONGO_SCHEMES.some((scheme) => uri.startsWith(scheme))) {
    throw new Error("MONGODB_URI must start with mongodb:// or mongodb+srv://");
  }

  mongoose.set("strictQuery", true);
  // A query that runs before the connection is up waits at most this long
  // (instead of buffering forever and looking like a hang to the ALB).
  mongoose.set("bufferTimeoutMS", envMs("MONGO_BUFFER_TIMEOUT_MS", 5000));

  try {
    await mongoose.connect(uri, connectOptions());
    logger.info("mongo connected");
    return mongoose.connection;
  } catch (error) {
    logger.error(
      { err: error.message, hint: explainMongoError(error.message, uri) },
      "mongo connection failed",
    );
    throw error;
  }
}

/**
 * Connects and keeps retrying in the background. The service stays up and
 * reports `degraded` on /health until the database is reachable again, which
 * keeps /live (the ALB health check) green.
 */
export function connectDbWithRetry(uri = process.env.MONGODB_URI) {
  let stopped = false;
  const report = createFailureReporter();
  let delay = envMs("MONGO_RETRY_BASE_MS", 5000);

  const attempt = async () => {
    try {
      await connectDb(uri);
      delay = envMs("MONGO_RETRY_BASE_MS", 5000);
    } catch (error) {
      if (stopped) return;
      report(error, uri);
      logger.warn({ retryInMs: delay }, "retrying mongo connection");
      await sleep(delay);
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
      if (!stopped) attempt();
    }
  };

  attempt().catch(() => {});

  // The driver emits "disconnected" during the very first (failed) attempt too;
  // only a *lost* connection is worth its own line.
  let everConnected = false;
  mongoose.connection.on("connected", () => {
    everConnected = true;
  });
  mongoose.connection.on("disconnected", () => {
    if (!stopped && everConnected) logger.warn("mongo connection lost; the driver will reconnect");
  });
  mongoose.connection.on("reconnected", () => logger.info("mongo reconnected"));

  return () => {
    stopped = true;
  };
}

export async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await withDeadline(mongoose.connection.close(false), 5000, "mongo close timed out").catch(
      (error) => logger.warn({ err: error.message }, "mongo close failed"),
    );
    logger.info("mongo connection closed");
  }
}

export function dbStatus() {
  return mongoose.connection.readyState === 1;
}
