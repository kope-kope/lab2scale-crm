import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { readAll, type DriveData } from "@/lib/drive";
import { useAuth } from "@/auth/AuthProvider";
import { CONFIG } from "@/config";

interface DataState {
  data: DriveData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const DataContext = createContext<DataState | null>(null);

/** Loads all three record sets once the user is authed; shared across screens. */
export function DriveDataProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [data, setData] = useState<DriveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    readAll(token, CONFIG.driveFolderId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your Drive data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, nonce]);

  return (
    <DataContext.Provider value={{ data, loading, error, reload }}>
      {children}
    </DataContext.Provider>
  );
}

export function useDriveData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDriveData must be used within DriveDataProvider");
  return ctx;
}
