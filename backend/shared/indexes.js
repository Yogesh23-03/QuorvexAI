import mongoose from "mongoose";
import { logger } from "./logger.js";

/**
 * MongoDB keeps indexes that a schema no longer declares, and it never widens an
 * existing one. When that drift happens (for example a `unique` index that later
 * became `unique + sparse`) writes fail at runtime with a long-ago-forgotten
 * error. These helpers report the drift at boot and let a maintenance script fix
 * it deliberately instead of guessing during a request.
 */
function registeredModels() {
  return Object.values(mongoose.models || {});
}

async function collectDrift() {
  const drift = [];

  for (const Model of registeredModels()) {
    try {
      const diff = await Model.diffIndexes();
      const toCreate = diff?.toCreate || [];
      const toDrop = diff?.toDrop || [];
      if (toCreate.length || toDrop.length) {
        // A not-yet-created index has no name, so fall back to its key pattern.
        const label = (index) => index?.name || JSON.stringify(index?.key || index);

        drift.push({
          model: Model.modelName,
          collection: Model.collection.name,
          toCreate: toCreate.map(label),
          toDrop: toDrop.map(label),
        });
      }
    } catch (error) {
      logger.warn({ err: error.message, model: Model.modelName }, "index diff failed");
    }
  }

  return drift;
}

/** Logs, but never changes, the indexes that differ from the schema. */
export async function reportIndexDrift() {
  const drift = await collectDrift();
  if (!drift.length) return [];

  for (const entry of drift) {
    logger.warn(
      {
        collection: entry.collection,
        missing: entry.toCreate,
        stale: entry.toDrop,
      },
      "index drift detected — run `npm run db:sync-indexes` to reconcile",
    );
  }

  return drift;
}

/**
 * Applies the schema indexes for the given models (or every registered model).
 * Destructive to indexes only, never to documents.
 */
export async function syncIndexes(models) {
  const applied = [];
  const targets = Array.isArray(models) && models.length ? models : registeredModels();

  for (const Model of targets) {
    try {
      await Model.syncIndexes();
      applied.push(Model.modelName);
    } catch (error) {
      logger.error({ err: error.message, model: Model.modelName }, "index sync failed");
      throw error;
    }
  }

  return applied;
}
