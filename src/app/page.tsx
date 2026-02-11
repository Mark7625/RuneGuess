"use client";

import { useState } from "react";
import { GuessTheExamineGame } from "@/components/GuessTheExamineGame";
import { AppNav } from "@/components/AppNav";
import { AppFooter } from "@/components/AppFooter";
import {
  SetUsernameModal,
  getUsernameModalDismissed,
  setUsernameModalDismissed,
} from "@/components/SetUsernameModal";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { user, loading, setUsername } = useAuth();
  const [gameMode, setGameMode] = useState<"osrs" | "rs3">("osrs");
  const [activeRs3Game, setActiveRs3Game] = useState<"examine" | "ability">("examine");
  const [usernameModalSkipped, setUsernameModalSkipped] = useState(false);

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
        className={`relative flex min-h-screen flex-col items-center px-4 py-10 ${
          gameMode === "rs3"
            ? "bg-gradient-to-b from-slate-900 via-sky-950 to-black"
            : "bg-gradient-to-b from-zinc-900 via-stone-900 to-black"
        }`}
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
