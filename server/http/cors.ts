import type { RequestHandler } from "express";

/**
 * CORS for the API when the frontend (Vercel) and backend (Railway) live on
 * different origins. Allowed origins come from CORS_ORIGIN (comma-separated).
 *
 * Each entry is either an exact origin (`https://app.example.com`) or a
 * wildcard host (`*.vercel.app`) so Vercel's ever-changing preview URLs match
 * without re-listing every one. Empty CORS_ORIGIN → no cross-origin headers,
 * which is correct for same-origin dev (the vite proxy) and single-container prod.
 */
export function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string, allowed: string[]): boolean {
  return allowed.some((entry) => {
    if (entry === origin) return true;
    if (entry.startsWith("*.")) {
      // `*.vercel.app` matches the domain itself or any real subdomain of it —
      // `anything.vercel.app`, but NOT `notvercel.app` or `vercel.app.evil.com`.
      const base = entry.slice(2); // "vercel.app"
      try {
        const host = new URL(origin).hostname;
        return host === base || host.endsWith(`.${base}`);
      } catch {
        return false;
      }
    }
    return false;
  });
}

/** Express middleware: reflect an allowed Origin and answer preflight requests. */
export function corsMiddleware(rawOrigins: string | undefined): RequestHandler {
  const allowed = parseOrigins(rawOrigins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin, allowed)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
