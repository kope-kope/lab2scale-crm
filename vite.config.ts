import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The API runs on API_PORT; the dev server proxies /api to it so the browser
// only ever talks to one origin (mirrors the single-container prod model).
const API_PORT = process.env.API_PORT || "8080";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  server: {
    host: true, // bind 0.0.0.0 so the dev server is reachable off-box
    port: 5173,
    strictPort: true,
    // Allow any Host header — needed when viewing through an external
    // hostname/tunnel rather than localhost. Safe for a dev server only.
    allowedHosts: true,
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
});
