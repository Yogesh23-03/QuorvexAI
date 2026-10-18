import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";
import { logger } from "../../../shared/logger.js";

const LOCAL_KEY_PATH = path.resolve(process.cwd(), "serviceAccountKey.json");

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
      logger.error({ err: error.message }, "FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    }
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      return JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"),
      );
    } catch (error) {
      logger.error({ err: error.message }, "FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid JSON");
    }
  }

  if (fs.existsSync(LOCAL_KEY_PATH)) {
    logger.warn(
      "Using local serviceAccountKey.json - provide FIREBASE_SERVICE_ACCOUNT in production",
    );
    return JSON.parse(fs.readFileSync(LOCAL_KEY_PATH, "utf8"));
  }

  return null;
}

let app = null;

function initFirebase() {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }

  const serviceAccount = loadServiceAccount();
  app = initializeApp(serviceAccount ? { credential: cert(serviceAccount) } : {});
  return app;
}

export function firebaseAuth() {
  return getAuth(initFirebase());
}

export default firebaseAuth;
