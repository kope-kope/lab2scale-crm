/**
 * Auth config, read from the environment. Fail closed: if the pieces the gate
 * needs at runtime are missing, the verifier throws rather than waving traffic
 * through (see verifyGoogleToken).
 */
export interface AuthConfig {
  /** The Google Workspace hosted-domain the `hd` claim must match, exactly. */
  allowedDomain: string;
  /**
   * Exact-match escape hatch so specific people can sign in before the Workspace
   * `hd` is fully in place. Exact full-email match only — never a suffix check.
   */
  allowedEmails: string[];
}

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  return {
    allowedDomain: env.ALLOWED_DOMAIN?.trim() || "lab-2-scale.com",
    allowedEmails: (env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  };
}

/** The OAuth client ID the ID token's `aud` claim is verified against (from LAB-7). */
export function googleClientId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.GOOGLE_CLIENT_ID?.trim() || undefined;
}
