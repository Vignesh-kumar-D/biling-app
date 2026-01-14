import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  server: {
    fs: {
      // allow importing from the workspace root (for ../shared)
      allow: [fileURLToPath(new URL(".", import.meta.url)), fileURLToPath(new URL("..", import.meta.url))],
    },
  },
});

