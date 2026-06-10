import { defineConfig } from "vite";
import path from "path";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/demo/workflow-builder/" : "/",
  server: { port: 5317 },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
}));
