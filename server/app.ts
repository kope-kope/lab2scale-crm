import express, { type RequestHandler } from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleFindContacts } from "./finder/handle.js";
import { corsMiddleware } from "./http/cors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

/**
 * Builds the Express app. The auth middleware is injected so the routing —
 * `/api/health` open, everything else gated — can be tested with a fake
 * verifier and no network.
 */
export function createApp(requireAuth: RequestHandler) {
  const app = express();
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  const api = express.Router();

  // Cross-origin support for the split deploy (Vercel frontend → Railway API).
  // No-op when CORS_ORIGIN is unset (same-origin dev + single-container prod).
  api.use(corsMiddleware(process.env.CORS_ORIGIN));

  // Open: liveness probe, no auth. Must be declared before the gate.
  api.get("/health", (_req, res) => {
    res.json({ ok: true, service: "lab2scale-crm", env: isProd ? "prod" : "dev" });
  });

  // AI contact finder. Mirrors the Vercel serverless function so local dev
  // works through the vite proxy. It runs its own Google-domain check on the
  // bearer token, so it lives before the ID-token gate below.
  api.post("/find-contacts", (req, res) => {
    void handleFindContacts({ authHeader: req.headers.authorization, body: req.body }).then(
      ({ status, body }) => res.status(status).json(body),
    );
  });

  // The gate. Every route below this line requires a verified, allowed account.
  api.use(requireAuth);

  api.get("/me", (req, res) => {
    res.json({ user: req.user });
  });

  // Phase 1+ mounts /accounts, /contacts, /enrich, /drafts here — all gated.

  app.use("/api", api);

  // Static app (single container in prod).
  if (isProd) {
    const clientDir = path.resolve(__dirname, "../dist");
    app.use(express.static(clientDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }

  return app;
}
