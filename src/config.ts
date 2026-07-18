/** App config from Vite env (all public — this is a browser-read-Drive MVP). */
export const CONFIG = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "",
  allowedDomain: (import.meta.env.VITE_ALLOWED_DOMAIN as string) || "lab-2-scale.com",
  driveFolderId: (import.meta.env.VITE_DRIVE_FOLDER_ID as string) || "",
  // Base URL for the API. Empty = same origin (dev via the vite proxy, or the
  // single-container build). Set to the Railway URL when the API is hosted
  // separately from the Vercel frontend. Trailing slash trimmed.
  apiBaseUrl: ((import.meta.env.VITE_API_BASE_URL as string) || "").replace(/\/+$/, ""),
};

/**
 * Scopes: identity (for the hd gate) + Drive (read folders, create company
 * folders) + Sheets (append contact rows). `drive` supersedes `drive.readonly`.
 * These must also be added to the OAuth consent screen; users re-consent once.
 */
export const GOOGLE_SCOPES =
  "openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets";
