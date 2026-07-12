import { OAuth2Client } from "google-auth-library";
import type { Claims } from "./evaluate.ts";
import { googleClientId } from "./config.ts";

/**
 * Verifies a Google ID token's RS256 signature against Google's public keys and
 * checks issuer, audience, and expiry — then returns the trustworthy claims.
 * Nothing downstream should ever see claims that did not pass through here.
 *
 * A verifier is just `(idToken) => Promise<Claims>`, so the middleware can be
 * tested with a fake and never touches the network.
 */
export type TokenVerifier = (idToken: string) => Promise<Claims>;

const client = new OAuth2Client();

export function makeGoogleVerifier(
  clientId: string | undefined = googleClientId(),
): TokenVerifier {
  // Fail closed: without an audience we cannot bind the token to our own OAuth
  // client, so refuse to run rather than accept any Google-signed token.
  if (!clientId) {
    throw new Error(
      "GOOGLE_CLIENT_ID is not set — the auth gate cannot verify token audience. " +
        "Set it from the OAuth client ID (LAB-7).",
    );
  }
  return async (idToken: string): Promise<Claims> => {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("token has no payload");
    return {
      email: payload.email,
      email_verified: payload.email_verified,
      hd: payload.hd,
      name: payload.name,
    };
  };
}
