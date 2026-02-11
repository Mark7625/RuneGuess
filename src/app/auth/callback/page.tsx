"use client";

import { useEffect } from "react";

const TOKEN_KEY = "runeguess_token";
const JUST_LOGGED_IN_KEY = "runeguess_just_logged_in";

export default function AuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const raw = params.get("token");
    const token = raw ? decodeURIComponent(raw) : null;

    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(JUST_LOGGED_IN_KEY, "1");
    }

    const t = setTimeout(() => {
      window.location.replace("/");
    }, 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-900 to-black text-amber-200">
      <p className="text-sm">Logging you in…</p>
    </div>
  );
}
