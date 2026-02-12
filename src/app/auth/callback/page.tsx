"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

const TOKEN_KEY = "runeguess_token";
const JUST_LOGGED_IN_KEY = "runeguess_just_logged_in";

function getTokenFromLocation(): string | null {
  if (typeof window === "undefined") return null;

  // 1) Try standard query param ?token=...
  const searchParams = new URLSearchParams(window.location.search || "");
  let raw = searchParams.get("token") ?? searchParams.get("access_token");
  if (raw) return decodeURIComponent(raw);

  // 2) Some providers put it in the hash: #token=... or #access_token=...
  if (window.location.hash) {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    raw = hashParams.get("token") ?? hashParams.get("access_token");
    if (raw) return decodeURIComponent(raw);
  }

  return null;
}

export default function AuthCallbackPage() {
  useEffect(() => {
    const token = getTokenFromLocation();

    if (token) {
      // Hand off the token to the root page via query param so it can own storage.
      const url = new URL(window.location.href);
      url.pathname = "/";
      url.search = "";
      url.searchParams.set("token", token);
      window.location.replace(url.toString());
      return;
    }

    // If there's no token, just stay on this page so you can see the error/debug text.
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-center text-amber-200">Logging you in…</p>
        </CardContent>
      </Card>
    </div>
  );
}
