"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { User, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

function displayName(user: { username: string | null; name: string | null; email: string | null }): string {
  return user.username ?? user.name ?? user.email ?? "Player";
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

type GameMode = "osrs" | "rs3";
type Rs3Game = "examine" | "ability";

export function AppNav({
  gameMode,
  setGameMode,
  activeRs3Game,
  setActiveRs3Game,
}: {
  gameMode: GameMode;
  setGameMode: (m: GameMode) => void;
  activeRs3Game: Rs3Game;
  setActiveRs3Game: (g: Rs3Game) => void;
}) {
  const { user, loading, login, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [gameModeOpen, setGameModeOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const gameModeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const close = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [profileOpen]);

  useEffect(() => {
    if (!gameModeOpen) return;
    const close = (e: MouseEvent) => {
      if (gameModeRef.current && !gameModeRef.current.contains(e.target as Node)) {
        setGameModeOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [gameModeOpen]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 flex justify-center px-4 z-30">
      <div className="pointer-events-auto flex w-full max-w-5xl items-center justify-between rounded-lg border border-border bg-black/70 px-4 py-2 shadow-osrs-panel backdrop-blur-sm">
        {/* Left: game picker + RuneGuess, yellow dot, game buttons */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-2" ref={gameModeRef}>
            <button
              type="button"
              onClick={() => setGameModeOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md border border-transparent py-0.5 pr-1 hover:border-border hover:bg-black/30 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
              aria-expanded={gameModeOpen}
              aria-haspopup="true"
              title="Switch game mode (OSRS / RS3)"
            >
              <div className="relative h-6 w-6 overflow-hidden rounded-md border border-border bg-black/60">
                <Image
                  src={
                    gameMode === "rs3"
                      ? "https://runescape.wiki/images/Game_Client_icon.png?642ff"
                      : "https://oldschool.runescape.wiki/images/Old_School_RuneScape_Mobile_icon.png?f0def"
                  }
                  alt={gameMode === "rs3" ? "RuneScape 3" : "Old School RuneScape"}
                  fill
                  sizes="24px"
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-yellow-200">
                RuneGuess
              </span>
            </button>
            {gameModeOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-zinc-900 py-2 shadow-xl">
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-zinc-800 ${
                    gameMode === "osrs" ? "text-amber-200 font-medium" : "text-zinc-400"
                  }`}
                  onClick={() => {
                    setGameMode("osrs");
                    setGameModeOpen(false);
                  }}
                >
                  <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded">
                    <Image
                      src="https://oldschool.runescape.wiki/images/Old_School_RuneScape_Mobile_icon.png?f0def"
                      alt=""
                      fill
                      sizes="28px"
                      className="object-contain"
                    />
                  </div>
                  OSRS
                </button>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-zinc-800 ${
                    gameMode === "rs3" ? "text-amber-200 font-medium" : "text-zinc-400"
                  }`}
                  onClick={() => {
                    setGameMode("rs3");
                    setGameModeOpen(false);
                  }}
                >
                  <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded">
                    <Image
                      src="https://runescape.wiki/images/Game_Client_icon.png?642ff"
                      alt=""
                      fill
                      sizes="28px"
                      className="object-contain"
                    />
                  </div>
                  RS3
                </button>
              </div>
            )}
          </div>
          <span className="h-6 w-1 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.7)]" />
          <nav className="flex items-center gap-2 text-xs">
            {gameMode === "rs3" ? (
              <>
                <Button
                  size="sm"
                  variant={activeRs3Game === "examine" ? "secondary" : "ghost"}
                  className="h-8 px-3"
                  onClick={() => setActiveRs3Game("examine")}
                >
                  Guess the Examine
                </Button>
                <Button
                  size="sm"
                  variant={activeRs3Game === "ability" ? "secondary" : "ghost"}
                  className="h-8 px-3"
                  onClick={() => setActiveRs3Game("ability")}
                >
                  Guess the Ability
                </Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" className="h-8 px-3">
                Guess the Examine
              </Button>
            )}
          </nav>
        </div>

        {/* Right: splitter + profile / login */}
        <div className="flex items-center gap-3">
          <div className="h-5 w-px bg-border/60" />
          {!loading && (
            <>
              {user ? (
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen((o) => !o)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-amber-900/50 ring-amber-400/50 focus:outline-none focus:ring-2"
                    aria-expanded={profileOpen}
                    aria-haspopup="true"
                    title="Profile menu"
                  >
                    {user.pictureUrl ? (
                      <img
                        src={user.pictureUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        width={32}
                        height={32}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <User className="h-4 w-4 text-amber-200" />
                    )}
                  </button>
                  {profileOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-zinc-900 py-2 shadow-xl">
                      <p className="truncate px-4 py-3 text-sm text-zinc-400">
                        {displayName(user)}
                      </p>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-amber-100 hover:bg-zinc-800"
                        onClick={() => {
                          setProfileOpen(false);
                        }}
                      >
                        <Settings className="h-4 w-4 shrink-0" />
                        Settings
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-amber-100 hover:bg-zinc-800"
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                        }}
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200"
                  onClick={() => login()}
                >
                  <GoogleIcon className="h-4 w-4 shrink-0" />
                  Login
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
