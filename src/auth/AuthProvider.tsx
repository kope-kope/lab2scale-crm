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
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("signedOut");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setStatus("authenticating");
    setMessage(null);
    try {
      const accessToken = await requestAccessToken();
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
    () => ({ status, user, token, message, signIn, signOut }),
    [status, user, token, message, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
