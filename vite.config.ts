import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// https://vite.dev/config/
const proxy = {
  "/api/dms/live": { target: process.env.API_URL || "http://127.0.0.1:3100", ws: true },
  "/api": { target: process.env.API_URL || "http://127.0.0.1:3100" },
  "/auth": { target: process.env.API_URL || "http://127.0.0.1:3100" },
};

const build = process.env.APP_BUILD || Date.now().toString(36);
const version = JSON.stringify({ build });

function appVersion(): Plugin {
  return {
    name: "app-version",
    configureServer(server) {
      server.middlewares.use("/version.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(version);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: version });
    },
  };
}

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(build) },
  server: { port: 3000, strictPort: true, proxy },
  preview: { port: 3000, strictPort: true, proxy },
  // Serve the patched visualizer directly so a running dev server cannot
  // keep an older prebundle that never signals the waveform reveal.
  optimizeDeps: { exclude: ["react-audio-visualize"] },
  plugins: [react(), tailwindcss(), appVersion()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
