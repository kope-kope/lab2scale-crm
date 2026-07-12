import { createApp } from "./app.ts";
import { makeRequireAuth } from "./auth/requireAuth.ts";
import { makeGoogleVerifier, type TokenVerifier } from "./auth/verifyGoogleToken.ts";
import { loadAuthConfig, googleClientId } from "./auth/config.ts";

const PORT = Number(process.env.API_PORT || process.env.PORT || 8080);
const isProd = process.env.NODE_ENV === "production";

// Build the real Google verifier lazily on first use, so the server still boots
// (and /api/health stays up) before GOOGLE_CLIENT_ID is configured (LAB-7).
// Until it is set, gated routes fail closed — the verifier throws → 401.
let cached: TokenVerifier | null = null;
const verify: TokenVerifier = (idToken) => {
  if (!cached) cached = makeGoogleVerifier();
  return cached(idToken);
};

if (!googleClientId()) {
  // eslint-disable-next-line no-console
  console.warn(
    "[auth] GOOGLE_CLIENT_ID is not set — gated /api routes will reject until it is (LAB-7).",
  );
}

const requireAuth = makeRequireAuth({ verify, config: loadAuthConfig() });
const app = createApp(requireAuth);

app.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://0.0.0.0:${PORT} (${isProd ? "prod" : "dev"})`);
});
