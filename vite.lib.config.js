import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync } from "fs";

/**
 * Library build configuration.
 *
 * Produces a framework-agnostic, dependency-free bundle in `dist/`:
 *   - dist/workflow-builder.js      (ESM)
 *   - dist/workflow-builder.cjs     (CommonJS)
 *   - dist/styles.css               (plain stylesheet, copied as-is)
 *
 * The demo application build still lives in `vite.config.js`.
 */
export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.js"),
      name: "WorkflowBuilder",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "workflow-builder.js" : "workflow-builder.cjs"),
    },
    rollupOptions: {
      // No runtime dependencies — everything is bundled.
      output: {},
    },
  },
  plugins: [
    {
      name: "copy-stylesheet",
      closeBundle() {
        copyFileSync(
          resolve(__dirname, "src/styles/workflow-builder.css"),
          resolve(__dirname, "dist/styles.css"),
        );
        copyFileSync(
          resolve(__dirname, "types/index.d.ts"),
          resolve(__dirname, "dist/index.d.ts"),
        );
      },
    },
  ],
});
