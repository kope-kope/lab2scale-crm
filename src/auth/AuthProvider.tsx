import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getUserInfo,
  hasRequiredScopes,
  isAllowed,
  requestAccessToken,
  type UserInfo,
} from "@/lib/googleAuth";

export type AuthStatus =
  | "signedOut"
  | "authenticating"
  | "authed"
  | "denied"
  | "error";

interface AuthState {
  status: AuthStatus;
  user: UserInfo | null;
  token: string | null;
  message: string | null;
  /** True when the denial was a missing Drive/Sheets scope (offer a re-grant). */
  scopeDenied: boolean;
  signIn: (opts?: { forceConsent?: boolean }) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("signedOut");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scopeDenied, setScopeDenied] = useState(false);

  const signIn = useCallback(async (opts?: { forceConsent?: boolean }) => {
    setStatus("authenticating");
    setMessage(null);
    setScopeDenied(false);
    try {
      const { accessToken, scope } = await requestAccessToken(opts);
      const info = await getUserInfo(accessToken);
      if (!isAllowed(info)) {
        setUser(null);
        setToken(null);
        setStatus("denied");
        setMessage(
          `${info.email || "That account"} isn't a lab-2-scale.com account. Sign in with your lab-2-scale.com email.`,
        );
        return;
      }
      if (!hasRequiredScopes(scope)) {
        // Signed in, but declined the Drive/Sheets permission — the app can't
        // read or write Drive. Guide them to re-grant instead of a silent 403.
        setUser(null);
        setToken(null);
        setStatus("denied");
        setScopeDenied(true);
        setMessage(
          "You're signed in, but Google Drive access wasn't granted. Click “Grant Drive access” and leave every permission checked (Drive and Sheets).",
        );
        return;
      }
      setUser(info);
      setToken(accessToken);
      setStatus("authed");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setToken(null);
    setMessage(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, token, message, scopeDenied, signIn, signOut }),
    [status, user, token, message, scopeDenied, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
