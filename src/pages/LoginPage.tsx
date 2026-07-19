import { Button } from "@/components/ds";
import { useAuth } from "@/auth/AuthProvider";

/** Full-screen midnight login. One action. No marketing copy — it's an internal tool. */
export function LoginPage() {
  const { signIn, status, message, scopeDenied } = useAuth();
  const busy = status === "authenticating";

  return (
    <div className="grid min-h-screen place-items-center bg-midnight-800 px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <span className="text-h1 font-medium text-white">
            lab<span className="text-action-dark">2</span>scale
          </span>
          <p className="mt-2 text-small text-midnight-200">CRM</p>
        </div>

        {scopeDenied ? (
          <Button
            onClick={() => void signIn({ forceConsent: true })}
            disabled={busy}
            style={{ width: "100%" }}
          >
            {busy ? "Opening Google…" : "Grant Drive access"}
          </Button>
        ) : (
          <Button onClick={() => void signIn()} disabled={busy} style={{ width: "100%" }}>
            {busy ? "Signing in…" : "Continue with Google"}
          </Button>
        )}

        {(status === "denied" || status === "error") && message && (
          <p className="mt-4 text-small text-warning">{message}</p>
        )}

        <p className="mt-8 text-caption text-midnight-300">
          Sign in with your lab-2-scale.com account.
        </p>
      </div>
    </div>
  );
}
