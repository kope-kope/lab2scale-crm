import { CONFIG, GOOGLE_SCOPES } from "@/config";

/**
 * Google Identity Services (GIS) token flow, browser-side. We request an access
 * token with identity + drive.readonly scopes, then read userinfo (for the hd
 * gate) and call Drive with the same token. No client secret involved.
 */

interface TokenResponse {
  access_token?: string;
  /** Space-separated list of scopes the user actually granted. */
  scope?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

/**
 * The API scopes the app can't work without. Google lets users untick these on
 * the consent screen ("granular permissions"), which yields a token that 403s
 * with "insufficient authentication scopes". We check for them after sign-in.
 */
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
];

export function hasRequiredScopes(granted: string | undefined): boolean {
  const set = new Set((granted ?? "").split(" ").filter(Boolean));
  return REQUIRED_SCOPES.every((s) => set.has(s));
}
interface GoogleGsi {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
        error_callback?: (err: { type?: string }) => void;
      }) => TokenClient;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleGsi;
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiPromise: Promise<void> | null = null;

/** Inject the GIS script once. */
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = GSI_SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(el);
  });
  return gsiPromise;
}

export interface AccessGrant {
  accessToken: string;
  /** The scopes actually granted, so callers can verify Drive/Sheets are present. */
  scope: string;
}

/**
 * Prompts the user (must be called from a click) and resolves with the access
 * token + granted scopes. `forceConsent` re-shows the consent screen (with the
 * permission checkboxes) even if Google would otherwise reuse a prior grant —
 * used to let someone re-grant a scope they previously declined.
 */
export async function requestAccessToken(opts?: { forceConsent?: boolean }): Promise<AccessGrant> {
  await loadGis();
  const google = window.google;
  if (!google) throw new Error("Google Sign-In unavailable");
  return new Promise<AccessGrant>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.googleClientId,
      scope: GOOGLE_SCOPES,
      callback: (resp) => {
        if (resp.access_token) resolve({ accessToken: resp.access_token, scope: resp.scope ?? "" });
        else reject(new Error(resp.error_description || resp.error || "Sign-in failed"));
      },
      error_callback: (err) => reject(new Error(err.type || "Sign-in cancelled")),
    });
    client.requestAccessToken(opts?.forceConsent ? { prompt: "consent" } : undefined);
  });
}

export interface UserInfo {
  email: string;
  email_verified: boolean;
  hd?: string;
  name?: string;
  picture?: string;
}

/** Read the signed-in user's identity (incl. the hd claim) from the token. */
export async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Could not read your Google profile (${res.status})`);
  const data = (await res.json()) as Record<string, unknown>;
  return {
    email: String(data.email ?? ""),
    email_verified: data.email_verified === true || data.email_verified === "true",
    hd: data.hd ? String(data.hd) : undefined,
    name: data.name ? String(data.name) : undefined,
    picture: data.picture ? String(data.picture) : undefined,
  };
}

/** The gate: only verified accounts on the allowed hosted domain get in. */
export function isAllowed(info: UserInfo): boolean {
  return info.email_verified === true && !!info.hd && info.hd === CONFIG.allowedDomain;
}
