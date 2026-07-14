import { CONFIG, GOOGLE_SCOPES } from "@/config";

/**
 * Google Identity Services (GIS) token flow, browser-side. We request an access
 * token with identity + drive.readonly scopes, then read userinfo (for the hd
 * gate) and call Drive with the same token. No client secret involved.
 */

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
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

/**
 * Prompts the user (must be called from a click) and resolves with an access
 * token. Rejects if the user cancels or Google returns an error.
 */
export async function requestAccessToken(): Promise<string> {
  await loadGis();
  const google = window.google;
  if (!google) throw new Error("Google Sign-In unavailable");
  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.googleClientId,
      scope: GOOGLE_SCOPES,
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error(resp.error_description || resp.error || "Sign-in failed"));
      },
      error_callback: (err) => reject(new Error(err.type || "Sign-in cancelled")),
    });
    client.requestAccessToken();
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
