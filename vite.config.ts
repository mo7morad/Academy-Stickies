import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// The frontend is a small Preact SPA. `wrangler pages dev -- npx vite` runs this
// dev server and layers the Pages Functions (/api/*) + D1/R2 bindings on top,
// so the app and API share one origin during local development.
export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
  },
});
