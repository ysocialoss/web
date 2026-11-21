import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: { entry: "sw.js", formats: ["es"], fileName: () => "sw.js" },
  },
});
