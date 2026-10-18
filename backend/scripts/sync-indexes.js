#!/usr/bin/env node
/**
 * Reconciles MongoDB indexes with the Mongoose schemas.
 *
 * MongoDB keeps indexes a schema no longer declares and never widens an existing
 * one, so a `unique` index that later became `unique + sparse` keeps rejecting
 * documents (this is what blocked the second email/password signup). Running this
 * script drops the stale indexes and creates the declared ones. Only indexes are
 * touched — documents are never modified.
 *
 *   node scripts/sync-indexes.js              # every service, using its .env
 *   LOCAL_MONGO=mongodb://127.0.0.1:27017 node scripts/sync-indexes.js
 *
 * Set DRY_RUN=1 to only print the difference.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { logger } from "../shared/logger.js";
import { syncIndexes } from "../shared/indexes.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY_RUN = process.env.DRY_RUN === "1";

const TARGETS = [
  {
    name: "auth",
    dir: "services/auth",
    db: "quorvex_auth",
    models: async () => [(await import("../services/auth/models/user.model.js")).default],
  },
  {
    name: "chat",
    dir: "services/chat",
    db: "quorvex_chat",
    models: async () => [
      (await import("../services/chat/models/conversation.model.js")).default,
      (await import("../services/chat/models/message.model.js")).default,
    ],
  },
  {
    name: "billing",
    dir: "services/billing",
    db: "quorvex_billing",
    models: async () => [(await import("../services/billing/models/payment.model.js")).default],
  },
];

function resolveUri(target) {
  if (process.env.LOCAL_MONGO) {
    return `${process.env.LOCAL_MONGO.replace(/\/+$/, "")}/${target.db}`;
  }
  dotenv.config({ path: path.join(ROOT, target.dir, ".env"), quiet: true });
  return process.env.MONGODB_URI;
}

async function syncTarget(target) {
  const uri = resolveUri(target);
  if (!uri) {
    logger.warn({ target: target.name }, "MONGODB_URI is not configured, skipped");
    return;
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const models = await target.models();

  for (const Model of models) {
    const before = await Model.collection.indexes().catch(() => []);
    const diff = await Model.diffIndexes();
    const label = (index) => index.name || JSON.stringify(index.key || index);
    const toCreate = (diff.toCreate || []).map(label);
    const toDrop = (diff.toDrop || []).map(label);

    if (!toCreate.length && !toDrop.length) {
      logger.info(
        { target: target.name, collection: Model.collection.name, indexes: before.length },
        "in sync",
      );
      continue;
    }

    logger.info(
      {
        target: target.name,
        collection: Model.collection.name,
        create: toCreate,
        drop: toDrop,
      },
      "reconciling indexes",
    );

    if (!DRY_RUN) {
      await syncIndexes([Model]);
      const after = await Model.collection.indexes();
      logger.info({ applied: after.map((index) => index.name) }, "indexes applied");
    }
  }

  await mongoose.disconnect();
}

let failed = false;

for (const target of TARGETS) {
  try {
    await syncTarget(target);
  } catch (error) {
    failed = true;
    logger.error({ err: error.message, target: target.name }, "index sync failed");
  }
}

if (failed) {
  logger.error("index sync finished with errors");
  process.exit(1);
}

logger.info({ dryRun: DRY_RUN }, "index sync complete");
