"use client";

import { useEffect, useState } from "react";
import { GuessTheExamineGame } from "@/components/GuessTheExamineGame";
import { AppNav } from "@/components/AppNav";
import { AppFooter } from "@/components/AppFooter";
import {
  SetUsernameModal,
  getUsernameModalDismissed,
  setUsernameModalDismissed,
} from "@/components/SetUsernameModal";
import { useAuth } from "@/lib/auth-context";

const GAME_MODE_KEY = "runeguess_game_mode";

function getStoredGameMode(): "osrs" | "rs3" {
  if (typeof window === "undefined") return "osrs";
  const stored = localStorage.getItem(GAME_MODE_KEY);
  return stored === "rs3" || stored === "osrs" ? stored : "osrs";
}

export default function HomePage() {
  const { user, loading, setUsername } = useAuth();
  const [gameMode, setGameMode] = useState<"osrs" | "rs3">(() => getStoredGameMode());
  const [activeRs3Game, setActiveRs3Game] = useState<"examine" | "ability">("examine");
  const [usernameModalSkipped, setUsernameModalSkipped] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = gameMode;
    localStorage.setItem(GAME_MODE_KEY, gameMode);
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

  return (
    <>
      <SetUsernameModal
        open={showSetUsernameModal}
        onClose={closeUsernameModal}
        onSetUsername={handleSetUsername}
      />
      <main
        className="relative flex min-h-screen flex-col items-center bg-gradient-to-b from-[var(--bg-from)] via-[var(--bg-via)] to-[var(--bg-to)] px-4 py-10"
      >
        <AppNav
          gameMode={gameMode}
          setGameMode={setGameMode}
          activeRs3Game={activeRs3Game}
          setActiveRs3Game={setActiveRs3Game}
        />

        <div className="mt-12 flex w-full max-w-4xl flex-1 flex-col space-y-6">
          {gameMode === "osrs" && <GuessTheExamineGame />}
          {gameMode === "rs3" && activeRs3Game === "examine" && (
            <GuessTheExamineGame />
          )}
          {gameMode === "rs3" && activeRs3Game === "ability" && (
            <div className="osrs-panel flex min-h-[320px] items-center justify-center p-8 text-center text-muted-foreground">
              <p className="text-sm">Guess the Ability (RS3) — coming soon.</p>
            </div>
          )}
        </div>

        <AppFooter />
      </main>
    </>
  );
}
