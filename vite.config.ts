import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
const proxy = {
  "/api/dms/live": { target: process.env.API_URL || "http://127.0.0.1:3100", ws: true },
  "/api": { target: process.env.API_URL || "http://127.0.0.1:3100" },
  "/auth": { target: process.env.API_URL || "http://127.0.0.1:3100" },
};

export default defineConfig({
  server: { port: 3000, strictPort: true, proxy },
  preview: { port: 3000, strictPort: true, proxy },
  // Serve the patched visualizer directly so a running dev server cannot
  // keep an older prebundle that never signals the waveform reveal.
  optimizeDeps: { exclude: ["react-audio-visualize"] },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
