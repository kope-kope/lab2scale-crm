import Anthropic from "@anthropic-ai/sdk";
import { findContacts, type FindContactsResult } from "./findContacts.js";

/**
 * Framework-neutral handler for the contact finder, shared by the Vercel
 * serverless function (prod) and the Express dev route (local). Keeping it
 * here means both surfaces verify the caller and call Claude identically.
 */

export interface FinderResponse {
  status: number;
  body: FindContactsResult | { error: string };
}

const DEFAULT_DOMAIN = "lab-2-scale.com";

interface GoogleUserInfo {
  hd?: string;
  email?: string;
  email_verified?: boolean | string;
}

/**
 * Verify the bearer token belongs to an allowed-domain Google account, using
 * the same `hd`-claim gate the app uses client-side. This runs before we spend
 * any Anthropic budget, so a stray request to the public URL can't burn it.
 */
async function verifyGoogleDomain(accessToken: string, allowedDomain: string): Promise<void> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new HttpError(401, "Your Google session expired — sign in again.");
  }
  const info = (await res.json()) as GoogleUserInfo;
  const verified = info.email_verified === true || info.email_verified === "true";
  if (info.hd !== allowedDomain || !verified) {
    throw new HttpError(403, "This tool is only available to lab-2-scale.com accounts.");
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface FinderRequest {
  authHeader?: string;
  body: unknown;
}

/** Parse, authorize, and run the finder. Never throws — always returns a response. */
export async function handleFindContacts(req: FinderRequest): Promise<FinderResponse> {
  // Trim — a trailing newline or stray space in the env var (a classic hosting
  // footgun) would otherwise reach Anthropic verbatim and 401 as "invalid key".
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { status: 500, body: { error: "AI isn't configured yet — set ANTHROPIC_API_KEY on the server." } };
  }

  const token = (req.authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { status: 401, body: { error: "Missing sign-in token." } };
  }

  const body = (req.body ?? {}) as { accountName?: unknown; contextText?: unknown };
  const accountName = typeof body.accountName === "string" ? body.accountName.trim() : "";
  const contextText = typeof body.contextText === "string" ? body.contextText : "";
  if (!accountName) {
    return { status: 400, body: { error: "Missing account name." } };
  }

  try {
    await verifyGoogleDomain(token, (process.env.ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim());
    const result = await findContacts(apiKey, accountName, contextText);
    return { status: 200, body: result };
  } catch (err) {
    if (err instanceof HttpError) {
      return { status: err.status, body: { error: err.message } };
    }
    if (err instanceof Anthropic.APIError) {
      // Surface a readable reason without leaking internals.
      const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 502;
      return { status, body: { error: `The AI request failed (${err.status ?? "?"}). ${err.message}` } };
    }
    return { status: 500, body: { error: "Something went wrong finding contacts." } };
  }
}
