import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 45291,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 45291,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        v1: resolve(root, "v1.html"),
        v1Preview: resolve(root, "v1-preview.html"),
        preview: resolve(root, "preview.html"),
        animator: resolve(root, "animator.html"),
      },
    },
  },
});
