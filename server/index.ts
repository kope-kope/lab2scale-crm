import express from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT || process.env.PORT || 8080);
const isProd = process.env.NODE_ENV === "production";

const app = express();
app.use(compression());
app.use(express.json({ limit: "1mb" }));

// --- API ---------------------------------------------------------------
const api = express.Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true, service: "lab2scale-crm", env: isProd ? "prod" : "dev" });
});

// Phase 1+ mounts /accounts, /contacts, /enrich, /drafts here — all
// server-side so the Anthropic key and Sheets access never reach the browser.

app.use("/api", api);

// --- Static app (single container in prod) -----------------------------
if (isProd) {
  const clientDir = path.resolve(__dirname, "../dist");
  app.use(express.static(clientDir));
  // SPA fallback: anything not matched above returns index.html
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://0.0.0.0:${PORT} (${isProd ? "prod" : "dev"})`);
});
