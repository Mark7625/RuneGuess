"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PATH_GUESS_THE_EXAMINE } from "@/lib/game-types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";

// React Icons imports
import { SiGoogle } from "react-icons/si";
import { FaUser, FaCog, FaSignOutAlt, FaChevronDown, FaTrophy } from "react-icons/fa";
import {useEffect, useRef, useState} from "react";

function displayName(user: { username: string | null; name: string | null; email: string | null }) {
  return user.username ?? user.name ?? user.email ?? "Player";
}

type GameMode = "osrs" | "rs3";
type Rs3Game = "examine" | "ability";

export function AppNav({
                         gameMode,
                         setGameMode,
                         activeRs3Game,
                         setActiveRs3Game,
                         onLeaderboardClick,
                         onGameAreaClick,
                         hasActiveGame = false,
                       }: {
  gameMode: GameMode;
  setGameMode: (m: GameMode) => void;
  activeRs3Game: Rs3Game;
  setActiveRs3Game: (g: Rs3Game) => void;
  onLeaderboardClick?: () => void;
  onGameAreaClick?: () => void;
  hasActiveGame?: boolean;
}) {
  const pathname = usePathname();
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




  // @ts-ignore
  return (
      <div className="fixed inset-x-0 top-3 flex justify-center px-4 z-30 pointer-events-none">
        <div className="pointer-events-auto flex w-full max-w-5xl items-center justify-between rounded-lg border border-border bg-black/70 px-4 py-2 shadow-osrs-panel backdrop-blur-sm">

          {/* Left: Game Mode + RuneGuess */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 py-0.5 pr-1 focus-visible:outline-none focus-visible:ring-amber-500/30 group hover:bg-transparent"
                >
                  {/* Text */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                    <span className="text-xs font-semibold tracking-[0.2em] uppercase text-yellow-200">
                      RuneGuess
                    </span>
                    </TooltipTrigger>
                    <TooltipContent>Switch game mode (OSRS / RS3)</TooltipContent>
                  </Tooltip>

                  {/* Icon */}
                  <div className="relative h-7 w-7 overflow-hidden rounded-md border border-border bg-black/60">
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

                  {/* Dropdown arrow */}
                  <FaChevronDown className="h-4 w-4 text-amber-200 group-hover:text-amber-400 transition-colors" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="mt-1 min-w-[180px] rounded-lg border border-border bg-card py-2 shadow-xl">
                <DropdownMenuItem
                    className={gameMode === "osrs" ? "text-amber-200 font-medium" : "text-zinc-400"}
                    onClick={() => {
                      if (hasActiveGame) {
                        onGameAreaClick?.();
                      } else {
                        setGameMode("osrs");
                      }
                    }}
                >
                  <div className="relative h-7 w-7 mr-2 overflow-hidden rounded">
                    <Image
                        src="https://oldschool.runescape.wiki/images/Old_School_RuneScape_Mobile_icon.png?f0def"
                        alt="OSRS"
                        fill
                        sizes="28px"
                        className="object-contain"
                    />
                  </div>
                  OSRS
                </DropdownMenuItem>

                <DropdownMenuItem
                    className={gameMode === "rs3" ? "text-amber-200 font-medium" : "text-zinc-400"}
                    onClick={() => {
                      if (hasActiveGame) {
                        onGameAreaClick?.();
                      } else {
                        setGameMode("rs3");
                      }
                    }}
                >
                  <div className="relative h-7 w-7 mr-2 overflow-hidden rounded">
                    <Image
                        src="https://runescape.wiki/images/Game_Client_icon.png?642ff"
                        alt="RS3"
                        fill
                        sizes="28px"
                        className="object-contain"
                    />
                  </div>
                  RS3
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="h-6 w-1 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.7)]" />

            <nav className="flex items-center gap-2 text-xs">
              {gameMode === "rs3" ? (
                  <>
                    <Button
                        size="sm"
                        variant={activeRs3Game === "examine" ? "secondary" : "ghost"}
                        className="h-8 px-3"
                        asChild
                    >
                      <Link
                        href={`/${PATH_GUESS_THE_EXAMINE}`}
                        onClick={(e) => {
                          if (hasActiveGame) {
                            e.preventDefault();
                            onGameAreaClick?.();
                          } else {
                            onGameAreaClick?.();
                            setActiveRs3Game("examine");
                          }
                        }}
                      >
                        Guess the Examine
                      </Link>
                    </Button>
                    <Button
                        size="sm"
                        variant={activeRs3Game === "ability" ? "secondary" : "ghost"}
                        className="h-8 px-3"
                        onClick={() => {
                          if (hasActiveGame) {
                            onGameAreaClick?.();
                          } else {
                            onGameAreaClick?.();
                            setActiveRs3Game("ability");
                          }
                        }}
                    >
                      Guess the Ability
                    </Button>
                  </>
              ) : (
                  <Button
                      size="sm"
                      variant={pathname === `/${PATH_GUESS_THE_EXAMINE}` || pathname === "/" ? "secondary" : "ghost"}
                      className="h-8 px-3"
                      asChild
                  >
                    <Link 
                      href={`/${PATH_GUESS_THE_EXAMINE}`} 
                      onClick={(e) => {
                        if (hasActiveGame) {
                          e.preventDefault();
                          onGameAreaClick?.();
                        } else {
                          onGameAreaClick?.();
                        }
                      }}
                    >
                      Guess the Examine
                    </Link>
                  </Button>
              )}
            </nav>
          </div>

          {/* Right: Leaderboard + Profile / Login */}
          <div className="flex items-center gap-3">
            <div className="h-5 w-px bg-border/60" />
            {onLeaderboardClick ? (
              <Button
                size="sm"
                variant={pathname === "/leaderboard" ? "secondary" : "ghost"}
                className="h-8 gap-1.5 px-3 text-xs font-medium text-amber-200 hover:bg-yellow-100/10 hover:text-amber-100"
                asChild
              >
                <Link 
                  href="/leaderboard" 
                  onClick={(e) => {
                    if (hasActiveGame) {
                      e.preventDefault();
                    }
                    onLeaderboardClick();
                  }}
                >
                  <FaTrophy className="h-4 w-4 shrink-0" />
                  Leaderboard
                </Link>
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant={pathname === "/leaderboard" ? "secondary" : "ghost"}
                asChild 
                className="h-8 gap-1.5 px-3 text-xs font-medium text-amber-200 hover:bg-yellow-100/10 hover:text-amber-100"
              >
                <Link href="/leaderboard">
                  <FaTrophy className="h-4 w-4 shrink-0" />
                  Leaderboard
                </Link>
              </Button>
            )}
            <div className="h-5 w-px bg-border/60" />

            {/* Auth section - reserve space to prevent layout shift */}
            <div className="h-8 flex items-center">
              {loading ? (
                // Skeleton placeholder during loading
                <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* Avatar + Chevron */}
                    <button
                        className="h-8 px-3 flex items-center gap-2 rounded-md group focus-visible:outline-none focus-visible:ring-amber-500/30 transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <img
                            src={user.pictureUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            width={32}
                            height={32}
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                        />

                        <AvatarFallback>
                          <FaUser className="h-4 w-4 text-amber-200" />
                        </AvatarFallback>
                      </Avatar>
                      <FaChevronDown className="h-4 w-4 text-amber-200 group-hover:text-amber-400 transition-colors" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="min-w-[200px]">
                    <div className="px-4 py-2 text-sm text-muted-foreground truncate">
                      {displayName(user)}
                    </div>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem>
                      <FaCog className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout}>
                      <FaSignOutAlt className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200 flex items-center justify-center hover:bg-yellow-100/10"
                    onClick={() => login()}
                >
                  <SiGoogle className="h-4 w-4 shrink-0" />
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
