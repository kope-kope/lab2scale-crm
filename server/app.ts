import express, { type RequestHandler } from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleFindCompanies, handleFindContacts, type FinderRequest, type FinderResponse } from "./finder/handle.js";
import { handleQualifyLead, handleDeleteLead, handleScreenPreview } from "./leads/handle.js";
import { handleFindEmails, handleFindContactEmails } from "./enrich/handle.js";
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

  // AI finder (async, two stages). Each validates + creates its sheet, replies
  // fast with the link, then runs the research in the background and writes into
  // the sheet. Both run their own Google-domain check, so they sit before the gate.
  const asyncFinder =
    (handler: (r: FinderRequest) => Promise<FinderResponse>): RequestHandler =>
    (req, res) => {
      handler({ authHeader: req.headers.authorization, body: req.body })
        .then(({ status, body, run }) => {
          res.status(status).json(body);
          // Fire-and-forget; the job writes its own failure into the sheet, so a
          // rejection here just needs logging.
          if (run) {
            void run().catch((e) => {
              // eslint-disable-next-line no-console
              console.error("[finder] background job failed:", e);
            });
          }
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error("[finder] failed to start:", e);
          if (!res.headersSent) res.status(500).json({ error: "Something went wrong starting the finder." });
        });
    };

  api.post("/find-companies", asyncFinder(handleFindCompanies)); // Stage 1
  api.post("/find-contacts", asyncFinder(handleFindContacts)); // Stage 2
  api.post("/find-contact-emails", asyncFinder(handleFindContactEmails)); // Stage 3: enrich emails

  // Lead qualifier — synchronous per lead (a web-search-grounded client screen;
  // runs long, which is fine on Railway's long-lived process). One row per call.
  const leadRoute =
    (handler: (r: { authHeader?: string; body: unknown }) => Promise<{ status: number; body: unknown }>): RequestHandler =>
    (req, res) => {
      handler({ authHeader: req.headers.authorization, body: req.body })
        .then(({ status, body }) => res.status(status).json(body))
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error("[leads] request failed:", e);
          if (!res.headersSent) res.status(500).json({ error: "Something went wrong." });
        });
    };

  api.post("/qualify-lead", leadRoute(handleQualifyLead)); // one row
  api.post("/delete-lead", leadRoute(handleDeleteLead)); // one row (destructive)
  api.post("/screen-preview", leadRoute(handleScreenPreview)); // sandbox — reads/writes nothing

  // Contact enrichment — find emails via Hunter (server-side key), write them
  // back to the Contacts sheet. Runs its own Google-domain check, so pre-gate.
  api.post("/find-emails", leadRoute(handleFindEmails)); // central Contacts sheet (sync)

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
