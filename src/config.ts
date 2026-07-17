/** App config from Vite env (all public — this is a browser-read-Drive MVP). */
export const CONFIG = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "",
  allowedDomain: (import.meta.env.VITE_ALLOWED_DOMAIN as string) || "lab-2-scale.com",
  driveFolderId: (import.meta.env.VITE_DRIVE_FOLDER_ID as string) || "",
};

/**
 * Scopes: identity (for the hd gate) + Drive (read folders, create company
 * folders) + Sheets (append contact rows). `drive` supersedes `drive.readonly`.
 * These must also be added to the OAuth consent screen; users re-consent once.
 */
export const GOOGLE_SCOPES =
  "openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets";
