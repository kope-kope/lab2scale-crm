import type { Request, Response, NextFunction, RequestHandler } from "express";
import { evaluate } from "./evaluate.ts";
import type { AuthConfig } from "./config.ts";
import type { TokenVerifier } from "./verifyGoogleToken.ts";

/** What the person is told on any rejection — what to do, not "403 Forbidden". */
const SIGN_IN_HELP = "Sign in with your lab-2-scale.com Google account.";

export interface AuthedUser {
  email: string;
  name?: string;
}

// Attach the verified user to the request for downstream handlers (/api/me, etc).
declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

/**
 * Express middleware factory. The verifier is injected so tests exercise the
 * 401/403 behaviour with a fake and no network.
 *
 * 401 — no/invalid token (we cannot say who you are).
 * 403 — valid token, but the account is not allowed in.
 */
export function makeRequireAuth(opts: {
  verify: TokenVerifier;
  config: AuthConfig;
}): RequestHandler {
  const { verify, config } = opts;

  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: SIGN_IN_HELP });
      return;
    }

    const idToken = header.slice("Bearer ".length).trim();
    let claims;
    try {
      claims = await verify(idToken);
    } catch {
      // Signature invalid, expired, wrong audience, malformed — all untrusted.
      res.status(401).json({ error: SIGN_IN_HELP });
      return;
    }

    const decision = evaluate(claims, config);
    if (!decision.allow) {
      res.status(403).json({ error: SIGN_IN_HELP });
      return;
    }

    req.user = { email: claims.email!, name: claims.name };
    next();
  };
}

export { SIGN_IN_HELP };
