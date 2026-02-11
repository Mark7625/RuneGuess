"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "./runeguess-server";
import {
  getGoogleLoginUrl,
  getMe,
  logoutApi,
  setUsernameApi,
} from "./runeguess-server";

const TOKEN_KEY = "runeguess_token";
const JUST_LOGGED_IN_KEY = "runeguess_just_logged_in";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  token: string | null;
};

type AuthContextValue = AuthState & {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setUsername: (username: string) => Promise<{ ok: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setTokenState] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    const t = readToken();
    setTokenState(t);
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    const me = await getMe(t);
    if (me) {
      setUser({ ...me, token: t });
    } else {
      const justLoggedIn = typeof window !== "undefined" && sessionStorage.getItem(JUST_LOGGED_IN_KEY);
      if (!justLoggedIn) {
        localStorage.removeItem(TOKEN_KEY);
        setTokenState(null);
      }
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(JUST_LOGGED_IN_KEY) && readToken()) {
      sessionStorage.removeItem(JUST_LOGGED_IN_KEY);
      refreshUser();
    }
  }, [refreshUser]);

  // Handle token passed via ?token=... on the root page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const tokenParam = url.searchParams.get("token");
    if (!tokenParam) return;

    const token = tokenParam;
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(JUST_LOGGED_IN_KEY, "1");

    // Clean the URL so the token isn't kept in the address bar/history.
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.toString());

    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async () => {
    const url = await getGoogleLoginUrl();
    if (url) window.location.href = url;
  }, []);

  const logout = useCallback(async () => {
    const t = readToken();
    if (t) await logoutApi(t);
    localStorage.removeItem(TOKEN_KEY);
    setTokenState(null);
    setUser(null);
  }, []);

  const setUsername = useCallback(
    async (username: string): Promise<{ ok: boolean; error?: string }> => {
      const t = readToken();
      if (!t) return { ok: false, error: "Not logged in" };
      const result = await setUsernameApi(t, username);
      if ("error" in result) return { ok: false, error: result.error };
      await refreshUser();
      return { ok: true };
    },
    [refreshUser]
  );

  const value: AuthContextValue = {
    user,
    loading,
    token,
    login,
    logout,
    setUsername,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
