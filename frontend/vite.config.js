import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const isProductionBuild = mode === "production";

  // A bundle without an API base URL would silently point at a developer
  // machine, so production builds refuse to run without one.
  if (isProductionBuild && !env.VITE_SERVER_URL) {
    throw new Error(
      "VITE_SERVER_URL is not set. Copy frontend/.env.example to .env and point it at the API gateway before building.",
    );
  }

  if (isProductionBuild && /localhost|127\.0\.0\.1/.test(env.VITE_SERVER_URL || "")) {
    console.warn(
      `[vite] VITE_SERVER_URL is ${env.VITE_SERVER_URL} — a localhost API URL in a production build.`,
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: false,
    },
    preview: {
      port: 4173,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      // Rely on Vite's dynamic-import splitting. Manual chunks made rolldown
      // module-preload Monaco, three and markdown on the landing page.
      rollupOptions: {},
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.js"],
      include: ["src/**/*.test.{js,jsx}"],
      css: false,
      restoreMocks: true,
    },
  };
});
