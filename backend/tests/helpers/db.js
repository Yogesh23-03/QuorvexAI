import mongoose from "mongoose";

const BASE = process.env.TEST_MONGODB_BASE || "mongodb://127.0.0.1:27017";

export function testUri(name) {
  return `${BASE}/${name}`;
}

export async function connectTestDb(name) {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(testUri(name), { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  return mongoose.connection;
}

export async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

export function models() {
  return mongoose.models;
}

export { mongoose };
