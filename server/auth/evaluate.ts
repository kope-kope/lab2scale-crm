import type { AuthConfig } from "./config";

/**
 * The security core, isolated as a pure function so it can be exhaustively
 * tested with fabricated claims and no network. Given the *already
 * signature-verified* claims of a Google ID token, decide whether the account
 * may reach the API.
 *
 * The rule that matters: trust the `hd` (hosted-domain) claim, never the email
 * string. `email.endsWith("lab-2-scale.com")` lets `x@lab-2-scale.com.evil.com`
 * in; `hd` is stamped by Google on Workspace tokens and cannot be forged once
 * the signature verifies. Even the allowlist escape hatch is exact-match only.
 */
export interface Claims {
  email?: string;
  email_verified?: boolean;
  hd?: string;
  /** Display name; not used for the decision, carried through for the UI. */
  name?: string;
}

export type Decision =
  | { allow: true; reason: string }
  | { allow: false; reason: string };

export function evaluate(claims: Claims, config: AuthConfig): Decision {
  // Unverified email → the email/hd claims are not trustworthy at all.
  if (claims.email_verified !== true) {
    return { allow: false, reason: "email is not verified" };
  }

  const email = claims.email?.trim().toLowerCase();
  if (!email) {
    return { allow: false, reason: "token has no email" };
  }

  // The trustworthy path: the hosted-domain claim matches, exactly.
  if (claims.hd !== undefined && claims.hd === config.allowedDomain) {
    return { allow: true, reason: `hd matches ${config.allowedDomain}` };
  }

  // Escape hatch: exact full-email match against the allowlist. Never a suffix.
  if (config.allowedEmails.includes(email)) {
    return { allow: true, reason: "email is on the allowlist" };
  }

  return { allow: false, reason: `not a ${config.allowedDomain} account` };
}
