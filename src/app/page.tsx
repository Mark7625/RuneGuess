"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GuessTheExamineGame, type GuessTheExamineGameHandle } from "@/components/GuessTheExamineGame";
import { GuessTheMusicGame, type GuessTheMusicGameHandle } from "@/components/GuessTheMusicGame";
import { LeaderboardView } from "@/components/LeaderboardView";
import { AppNav } from "@/components/AppNav";
import { AppFooter } from "@/components/AppFooter";
import {
  SetUsernameModal,
  getUsernameModalDismissed,
  setUsernameModalDismissed,
} from "@/components/SetUsernameModal";
import { LeaveGameConfirmDialog } from "@/components/LeaveGameConfirmDialog";
import { STORAGE_KEY_GAME_MODE, PATH_GUESS_THE_EXAMINE, PATH_GUESS_THE_MUSIC } from "@/lib/game-types";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";

function getStoredGameMode(): "osrs" | "rs3" {
  if (typeof window === "undefined") return "osrs";
  const stored = localStorage.getItem(STORAGE_KEY_GAME_MODE);
  return stored === "rs3" || stored === "osrs" ? stored : "osrs";
}

export type MainView = "game" | "leaderboard";

export default function HomePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, setUsername } = useAuth();
  
  // Determine view from URL pathname
  const getViewFromPath = (path: string): MainView => {
    if (path === "/leaderboard") return "leaderboard";
    if (path === `/${PATH_GUESS_THE_EXAMINE}` || path === `/${PATH_GUESS_THE_MUSIC}`) return "game";
    return "game"; // default to game (root /)
  };
  
  // Determine which game to show
  const getCurrentGame = (path: string): "examine" | "music" => {
    if (path === `/${PATH_GUESS_THE_MUSIC}`) return "music";
    return "examine"; // default
  };
  
  const [gameMode, setGameMode] = useState<"osrs" | "rs3">(() => getStoredGameMode());
  const [activeRs3Game, setActiveRs3Game] = useState<"examine" | "ability">("examine");
  const [usernameModalSkipped, setUsernameModalSkipped] = useState(false);
  const [hasActiveGame, setHasActiveGame] = useState(false);
  const [showLeaveGameConfirm, setShowLeaveGameConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const examineGameRef = useRef<GuessTheExamineGameHandle>(null);
  const musicGameRef = useRef<GuessTheMusicGameHandle>(null);

  // Get current view directly from pathname to avoid flash
  const view = getViewFromPath(pathname);

  useEffect(() => {
    document.documentElement.dataset.theme = gameMode;
    localStorage.setItem(STORAGE_KEY_GAME_MODE, gameMode);
  }, [gameMode]);

  const showSetUsernameModal =
    !loading &&
    !!user &&
    user.username == null &&
    !usernameModalSkipped &&
    !getUsernameModalDismissed();

  const handleSetUsername = async (username: string) => {
    return setUsername(username);
  };

  const closeUsernameModal = () => {
    setUsernameModalDismissed();
    setUsernameModalSkipped(true);
  };

  const handleLeaderboardClick = () => {
    if (hasActiveGame) {
      setPendingNavigation(() => () => router.push("/leaderboard"));
      setShowLeaveGameConfirm(true);
    } else {
      router.push("/leaderboard");
    }
  };

  const handleGameAreaClick = () => {
    if (hasActiveGame) {
      const currentGame = getCurrentGame(pathname);
      const targetPath = currentGame === "music" ? `/${PATH_GUESS_THE_MUSIC}` : `/${PATH_GUESS_THE_EXAMINE}`;
      setPendingNavigation(() => () => router.push(targetPath));
      setShowLeaveGameConfirm(true);
    } else {
      const currentGame = getCurrentGame(pathname);
      const targetPath = currentGame === "music" ? `/${PATH_GUESS_THE_MUSIC}` : `/${PATH_GUESS_THE_EXAMINE}`;
      router.push(targetPath);
    }
  };

  const confirmLeaveGame = () => {
    examineGameRef.current?.endRun();
    musicGameRef.current?.endRun();
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
    setShowLeaveGameConfirm(false);
  };

  return (
    <>
      <SetUsernameModal
        open={showSetUsernameModal}
        onClose={closeUsernameModal}
        onSetUsername={handleSetUsername}
      />
      <LeaveGameConfirmDialog
        open={showLeaveGameConfirm}
        onOpenChange={(open) => {
          setShowLeaveGameConfirm(open);
          if (!open) setPendingNavigation(null);
        }}
        onConfirm={confirmLeaveGame}
      />
      <main
        className={`relative flex ${view === "leaderboard" ? "h-screen" : "min-h-screen"} flex-col items-center bg-gradient-to-b from-[var(--bg-from)] via-[var(--bg-via)] to-[var(--bg-to)] px-4 ${view === "leaderboard" ? "pt-20 pb-4" : "py-10"}`}
      >
        <AppNav
          gameMode={gameMode}
          setGameMode={setGameMode}
          activeRs3Game={activeRs3Game}
          setActiveRs3Game={setActiveRs3Game}
          onLeaderboardClick={handleLeaderboardClick}
          onGameAreaClick={handleGameAreaClick}
          hasActiveGame={hasActiveGame}
        />

        <div className={`flex w-full max-w-4xl flex-1 flex-col ${view === "leaderboard" ? "space-y-4 min-h-0 overflow-hidden" : "mt-12 space-y-6"}`}>
          {view === "leaderboard" && <LeaderboardView />}
          {view === "game" && (
            <>
              {getCurrentGame(pathname) === "music" ? (
                // Music game - only available in OSRS mode for now
                gameMode === "osrs" ? (
                  <GuessTheMusicGame
                    ref={musicGameRef}
                    onGameActiveChange={setHasActiveGame}
                  />
                ) : (
                  <Card className="flex min-h-[320px] items-center justify-center p-8">
                    <p className="text-sm text-muted-foreground">Guess the Music is only available in OSRS mode.</p>
                  </Card>
                )
              ) : (
                // Examine game
                <>
                  {gameMode === "osrs" && (
                    <GuessTheExamineGame
                      ref={examineGameRef}
                      onGameActiveChange={setHasActiveGame}
                    />
                  )}
                  {gameMode === "rs3" && activeRs3Game === "examine" && (
                    <GuessTheExamineGame
                      ref={examineGameRef}
                      onGameActiveChange={setHasActiveGame}
                    />
                  )}
                  {gameMode === "rs3" && activeRs3Game === "ability" && (
                    <Card className="flex min-h-[320px] items-center justify-center p-8">
                      <p className="text-sm text-muted-foreground">Guess the Ability (RS3) — coming soon.</p>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <AppFooter onLeaderboardClick={handleLeaderboardClick} />
      </main>
    </>
  );
}
