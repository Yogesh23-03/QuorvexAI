import mongoose from "mongoose";
import { logger } from "./logger.js";

const RETRY_DELAY_MS = 10000;

const MONGO_SCHEMES = ["mongodb://", "mongodb+srv://"];

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
  if (text.includes("querysrv") || text.includes("enotfound")) {
    if (uri.includes("+srv")) {
      return "SRV lookup failed: the cluster hostname is wrong or DNS is blocked.";
    }
    return "host not found: check the MONGODB_URI hostname.";
  }
  if (text.includes("econnrefused")) {
    return "connection refused: nothing is listening on that host/port — start mongod locally.";
  }
  if (text.includes("selection timeout") || text.includes("etimedout")) {
    return "server selection timed out: usually an IP allowlist or firewall block (Atlas → Network Access).";
  }
  if (text.includes("ip whitelist") || text.includes("not allowed to access")) {
    return "this IP is not allowlisted on the cluster (Atlas → Network Access).";
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
      "mongo connection failed — retrying every 10s",
    );
  };
}

export async function connectDb(uri = process.env.MONGODB_URI) {
  if (!uri) {
    logger.error("MONGODB_URI is not configured; database features are disabled");
    return null;
  }

  if (!MONGO_SCHEMES.some((scheme) => uri.startsWith(scheme))) {
    throw new Error("MONGODB_URI must start with mongodb:// or mongodb+srv://");
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
      socketTimeoutMS: 45000,
    });
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
 * reports `degraded` on /health until the database is reachable again.
 */
export function connectDbWithRetry(uri = process.env.MONGODB_URI) {
  let stopped = false;
  const report = createFailureReporter();

  const attempt = async () => {
    try {
      await connectDb(uri);
    } catch (error) {
      if (stopped) return;
      report(error, uri);
      setTimeout(attempt, RETRY_DELAY_MS).unref?.();
    }
  };

  attempt();

  return () => {
    stopped = true;
  };
}

export async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);
    logger.info("mongo connection closed");
  }
}

export function dbStatus() {
  return mongoose.connection.readyState === 1;
}
