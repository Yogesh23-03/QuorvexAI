import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.js"],
    setupFiles: ["./tests/setup.js"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Services share one Mongo/Redis pair, so run files sequentially.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      INTERNAL_API_KEY: "",
      REDIS_URL: process.env.TEST_REDIS_URL || "redis://127.0.0.1:6379",
    },
  },
});
