import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Prebundle the CommonJS dependencies imported by SolidStart's error viewer.
  optimizeDeps: {
    include: ['@solidjs/start > source-map-js', '@solidjs/start > error-stack-parser'],
  },
  plugins: [
    solidStart(),
    tailwindcss(),
    nitro()
  ]
});
