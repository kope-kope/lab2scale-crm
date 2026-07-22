import express, { type RequestHandler } from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleFindCompanies, handleFindContacts, type FinderRequest, type FinderResponse } from "./finder/handle.js";
import { handleQualifyLeads } from "./leads/handle.js";
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

  // Lead qualifier — synchronous (one AI call over the rules, no web search).
  api.post("/qualify-leads", (req, res) => {
    handleQualifyLeads({ authHeader: req.headers.authorization, body: req.body })
      .then(({ status, body }) => res.status(status).json(body))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[leads] qualify failed:", e);
        if (!res.headersSent) res.status(500).json({ error: "Something went wrong qualifying leads." });
      });
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
