import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "../auth-context";
import type { AuthContextValue, AuthSession } from "../types/auth.types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const queryClient = useQueryClient();
  const changeSession = useCallback(
    (next: AuthSession | null) => {
      queryClient.clear();
      setSession(next);
    },
    [queryClient],
  );

  useEffect(() => {
    if (!session) return;
    const timeout = window.setTimeout(
      () => changeSession(null),
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [session, changeSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      signIn: changeSession,
      signOut: () => changeSession(null),
    }),
    [session, changeSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
