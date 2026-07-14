/** App config from Vite env (all public — this is a browser-read-Drive MVP). */
export const CONFIG = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "",
  allowedDomain: (import.meta.env.VITE_ALLOWED_DOMAIN as string) || "lab-2-scale.com",
  driveFolderId: (import.meta.env.VITE_DRIVE_FOLDER_ID as string) || "",
};

/** Scopes: identity (for the hd gate) + read-only Drive (to read the folders). */
export const GOOGLE_SCOPES =
  "openid email profile https://www.googleapis.com/auth/drive.readonly";
