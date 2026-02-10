"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Clock3,
  Coffee,
  Github,
  HelpCircle,
  MessageCircle,
  XCircle
} from "lucide-react";
import npcMappingsJson from "@/data/npcs_mappings.json";
import itemMappingsJson from "@/data/item_mappings.json";
import objectMappingsJson from "@/data/object_mappings.json";
import { Button } from "@/components/ui/button";

type ExamineCategory = "items" | "npcs" | "objects";

type ExamineEntry = {
  id: number;
  category: ExamineCategory;
  name: string;
  examine: string;
};

type ExamineGameMode = "limited" | "timed";

type MappingEntry = {
  name: string;
};

const npcMappings = npcMappingsJson as Record<string, MappingEntry>;
const itemMappings = itemMappingsJson as Record<string, MappingEntry>;
const objectMappings = objectMappingsJson as Record<string, MappingEntry>;

const getHintImageForEntry = (entry: ExamineEntry): string => {
  if (entry.category === "objects") {
    return `https://chisel.weirdgloop.org/static/img/osrs-object/${entry.id}_orient3.png`;
  }
  if (entry.category === "npcs") {
    return `https://chisel.weirdgloop.org/static/img/osrs-npc/${entry.id}_288.png`;
  }
  return `https://chisel.weirdgloop.org/static/img/osrs-sprite/${entry.id}.png`;
};

export default function HomePage() {
  const [gameMode, setGameMode] = useState<"osrs" | "rs3">("osrs");
  const [activeRs3Game, setActiveRs3Game] = useState<"examine" | "ability">(
    "examine"
  );
  const [examineGameMode, setExamineGameMode] =
    useState<ExamineGameMode>("limited");
  const [difficulty, setDifficulty] = useState<"easy" | "hard">("easy");
  const [easyCategory, setEasyCategory] = useState<
    "items" | "npcs" | "objects"
  >("items");
  const [examinePool, setExaminePool] = useState<ExamineEntry[] | null>(null);
  const [currentEntry, setCurrentEntry] = useState<ExamineEntry | null>(null);
  const [hasActiveExamine, setHasActiveExamine] = useState(false);
  const [usedExamines, setUsedExamines] = useState<string[]>(() => []);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<"idle" | "correct" | "incorrect">(
    "idle"
  );
  const [wrongStreak, setWrongStreak] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [remainingHearts, setRemainingHearts] = useState(20);
  const [timedRunning, setTimedRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [timedScore, setTimedScore] = useState(0);
  const [livesScore, setLivesScore] = useState(0);
  const [timedPreCountdown, setTimedPreCountdown] = useState<number | null>(null);
  const [gameInProgress, setGameInProgress] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const hintStage = !showHint ? 0 : wrongStreak < 6 ? 1 : 2;
  const isTimedPrePhase =
    examineGameMode === "timed" && (!gameInProgress || timedPreCountdown !== null);

  const getCanonicalNameForEntry = (entry: ExamineEntry): string | null => {
    const idKey = String(entry.id);
    if (entry.category === "npcs") {
      return npcMappings[idKey]?.name ?? null;
    }
    if (entry.category === "items") {
      return itemMappings[idKey]?.name ?? null;
    }
    if (entry.category === "objects") {
      return objectMappings[idKey]?.name ?? null;
    }
    return null;
  };

  const maskExamineText = (entry: ExamineEntry): string => {
    const base = entry.examine;
    const canonical = getCanonicalNameForEntry(entry) ?? entry.name;
    if (!canonical) return base;

    // Escape for regex and replace whole-word, case-insensitive matches
    const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!escaped.trim()) return base;

    const pattern = new RegExp(`\\b${escaped}\\b`, "gi");
    return base.replace(pattern, (match) => "█".repeat(match.length));
  };

  const maxLives = difficulty === "easy" ? 20 : 10;
  const isLivesEnded = examineGameMode === "limited" && remainingHearts <= 0 && gameInProgress;
  const isTimedEnded = examineGameMode === "timed" && timeLeft <= 0 && gameInProgress;
  const isRunEnded = isLivesEnded || isTimedEnded;

  // Load the full examine pool (CSV + JSON mappings) from a server API so
  // we don't ship all that data in the client bundle.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/examines");
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;

        const pool = (data.pool ?? []) as ExamineEntry[];
        if (!pool.length) return;

        setExaminePool(pool);
        // If we don't have a current entry yet, seed with a random one.
        setCurrentEntry((prev) => prev ?? pool[Math.floor(Math.random() * pool.length)]);
      } catch {
        // Fail silently for now; UI will just show no data.
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // Timed mode countdown
  useEffect(() => {
    if (!timedRunning) return;
    if (timeLeft <= 0) {
      setTimedRunning(false);
      return;
    }
    const id = window.setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timedRunning, timeLeft]);

  // Pre-countdown before timed mode starts
  useEffect(() => {
    if (timedPreCountdown === null) return;
    if (timedPreCountdown <= 0) {
      setTimedPreCountdown(null);
      // When the timed game actually starts (after the visible countdown),
      // roll a fresh examine so you can't gain an advantage from what was
      // faintly visible under the blurred overlay.
      rollNewEntry();
      setTimedRunning(true);
      return;
    }
    const id = window.setTimeout(() => {
      setTimedPreCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [timedPreCountdown]);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  // If difficulty changes while in lives mode, clamp current lives to the new max.
  useEffect(() => {
    if (examineGameMode !== "limited") return;
    const newMax = difficulty === "easy" ? 20 : 10;
    setRemainingHearts((prev) => (prev > newMax ? newMax : prev));
  }, [difficulty, examineGameMode]);

  const resetLimitedRun = () => {
    setRemainingHearts(maxLives);
    setLivesScore(0);
    setWrongStreak(0);
    setShowHint(false);
    setResult("idle");
    setGuess("");
    setHasActiveExamine(false);
    setGameInProgress(false);
  };

  const resetTimedRun = () => {
    setTimedScore(0);
    setTimeLeft(600);
    setTimedRunning(false);
    setWrongStreak(0);
    setShowHint(false);
    setResult("idle");
    setGuess("");
    rollNewEntry();
    setTimedPreCountdown(null);
    setGameInProgress(false);
  };

  const getAvailablePool = () => {
    if (!examinePool) return [];
    const base = examinePool;
    if (difficulty === "easy") {
      return base.filter((entry) => {
        if (easyCategory === "items") return entry.category === "items";
        if (easyCategory === "npcs") return entry.category === "npcs";
        return entry.category === "objects";
      });
    }
    return base;
  };

  const rollNewEntry = () => {
    const pool = getAvailablePool();
    if (!pool.length) return;

    const unused = pool.filter(
      (entry) => !usedExamines.includes(entry.examine)
    );
    const source = unused.length > 0 ? unused : pool;
    const next = source[Math.floor(Math.random() * source.length)];

    // Starting a new lives-mode round counts as "in a game" so we
    // should lock difficulty/category immediately after New examine.
    if (examineGameMode === "limited" && !gameInProgress) {
      setGameInProgress(true);
    }

    setCurrentEntry(next);
    setHasActiveExamine(true);
    setGuess("");
    setResult("idle");
    setWrongStreak(0);
    setShowHint(false);
    setUsedExamines((prev) =>
      prev.includes(next.examine) ? prev : [...prev, next.examine]
    );
  };

  const handleCheckGuess = () => {
    const value = guess.trim();
    if (!currentEntry) return;
    if (!value) return;

    const pool = getAvailablePool();
    const sameExamine = pool.filter(
      (entry) => entry.examine === currentEntry.examine
    );

    const normalized = value.toLowerCase();
    let isCorrect = false;

    if (/^\d+$/.test(normalized)) {
      const idNumber = Number(normalized);
      isCorrect = sameExamine.some((entry) => entry.id === idNumber);
    } else {
      isCorrect = sameExamine.some((entry) => {
        const canonical = getCanonicalNameForEntry(entry);
        if (!canonical) return false;
        return canonical.toLowerCase() === normalized;
      });
    }

    if (!gameInProgress) {
      setGameInProgress(true);
    }

    if (isCorrect) {
      setResult("correct");
      setWrongStreak(0);
      setShowHint(false);
      if (examineGameMode === "timed" && timedRunning && timeLeft > 0) {
        setTimedScore((prev) => prev + 1);
        rollNewEntry();
      }
      if (examineGameMode === "limited") {
        setLivesScore((prev) => prev + 1);
      }
    } else {
      setResult("incorrect");
      setWrongStreak((prev) => prev + 1);
      if (examineGameMode === "limited") {
        setRemainingHearts((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }
  };

  const handleEndRun = () => {
    if (examineGameMode === "limited") {
      resetLimitedRun();
    } else {
      resetTimedRun();
    }
    setGameInProgress(false);
    setShowEndConfirm(false);
  };

  return (
    <main
      className={`relative flex min-h-screen items-center justify-center bg-gradient-to-b px-4 py-10 ${
        gameMode === "rs3"
          ? "from-slate-900 via-sky-950 to-black"
          : "from-zinc-900 via-stone-900 to-black"
      }`}
    >
      {showEndConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-zinc-950/95 p-5 shadow-osrs-panel">
            <h3 className="text-sm font-semibold text-yellow-200 uppercase tracking-[0.2em] mb-3">
              {examineGameMode === "limited" ? "Reset current run?" : "End current run?"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {examineGameMode === "limited" ? (
                <>
                  This will reset your current{" "}
                  <span className="font-semibold text-amber-200">lives run</span>, restoring all
                  lives and clearing your progress on this run.
                </>
              ) : (
                <>
                  This will end your current{" "}
                  <span className="font-semibold text-sky-200">timed</span> game and reset your
                  timer and score.
                </>
              )}
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <Button
                size="sm"
                variant="outline"
                className="px-3"
                onClick={() => setShowEndConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="px-3 bg-red-700 hover:bg-red-600 border-red-500 text-red-50"
                onClick={handleEndRun}
              >
                {examineGameMode === "limited" ? "Reset run" : "End run"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Floating top bar */}
      <div className="pointer-events-none fixed inset-x-0 top-3 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-5xl items-center justify-between rounded-lg border border-border bg-black/70 px-4 py-2 shadow-osrs-panel backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.7)]" />
            <div className="flex items-center gap-2">
              <div className="relative h-6 w-6 overflow-hidden rounded-md border border-border bg-black/60">
                <Image
                  src={
                    gameMode === "rs3"
                      ? "https://runescape.wiki/images/Game_Client_icon.png?642ff"
                      : "https://oldschool.runescape.wiki/images/Old_School_RuneScape_Mobile_icon.png?f0def"
                  }
                  alt={gameMode === "rs3" ? "RuneScape 3 logo" : "Old School RuneScape logo"}
                  fill
                  sizes="24px"
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-yellow-200">
                RuneGuess
              </span>
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  gameMode === "rs3"
                    ? "bg-sky-700/70 text-sky-100 border border-sky-400/70"
                    : "bg-amber-900/70 text-amber-100 border border-amber-500/70"
                }`}
              >
                {gameMode === "rs3" ? "RS3" : "OSRS"}
              </span>
            </div>
          </div>
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
            <div className="ml-3 h-5 w-px bg-border/60" />
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200"
            >
              <a
                href="https://buymeacoffee.com/openrune"
                target="_blank"
                rel="noreferrer"
              >
                Support
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled
              title="RS3 games are disabled for now"
              className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] bg-slate-700/70 border-slate-600 text-slate-300 cursor-not-allowed"
            >
              RS3 Games
            </Button>
          </nav>
        </div>
      </div>

      <div className="mt-12 max-w-4xl w-full space-y-6">
        {/* RS3 games are disabled for now; always show OSRS examine game */}
        <section className="osrs-panel grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] p-5 md:p-6 min-h-[520px]">
            {/* Left: Examine, feedback & meta */}
            <div className="relative flex flex-col border-b border-border pb-4 md:border-b-0 md:border-r md:pr-5">
              <div
                className={`space-y-4 ${
                  isTimedPrePhase ? "blur-sm pointer-events-none select-none" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-yellow-200 uppercase tracking-[0.2em]">
                    Examine
                  </h2>
                  {examineGameMode === "timed" ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-xs rounded-full bg-black/40 border px-2 py-0.5 ${
                          timeLeft <= 120
                            ? "border-red-500 text-red-300"
                            : timeLeft <= 360
                              ? "border-yellow-500 text-yellow-200"
                              : "border-emerald-500 text-emerald-200"
                        }`}
                      >
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {formatTime(timeLeft)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-900/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                        <span className="uppercase tracking-[0.18em] text-emerald-300/90">
                          Score
                        </span>
                        <span className="font-mono text-xs">{timedScore}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 font-mono text-xs rounded-full bg-black/40 border border-amber-500 px-2 py-0.5 text-amber-200">
                        <span className="uppercase tracking-[0.18em] text-amber-300/90">
                          Lives
                        </span>
                        <span className="font-mono text-xs">{remainingHearts}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-900/60 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                        <span className="uppercase tracking-[0.18em] text-amber-300/90">
                          Score
                        </span>
                        <span className="font-mono text-xs">{livesScore}</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-md bg-gradient-to-br from-stone-900/95 via-stone-950 to-stone-900 p-4 text-sm leading-relaxed text-amber-50 border border-yellow-900/50">
                  {(!examinePool || !currentEntry) ? (
                    <span className="text-amber-200/80">Loading examine data…</span>
                  ) : examineGameMode === "limited" && !hasActiveExamine ? (
                    <span className="text-amber-200/80">
                      Press <span className="font-semibold">New examine</span> to start your run.
                      You have{" "}
                      <span className="font-semibold">
                        {difficulty === "easy" ? 20 : 10} lives
                      </span>
                      .
                    </span>
                  ) : (
                    maskExamineText(currentEntry)
                  )}
                </div>
              </div>

              {/* Combined feedback + hint box fills remaining space */}
              <div
                className={`mt-4 flex-1 rounded-md border bg-black/60 px-4 py-3 text-sm text-amber-50 relative overflow-hidden ${
                  result === "correct"
                    ? "border-emerald-600"
                    : result === "incorrect"
                      ? "border-red-700"
                      : "border-yellow-900/70"
                } ${isTimedPrePhase ? "blur-sm pointer-events-none select-none" : ""}`}
              >
                {isRunEnded ? (
                  <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-400/70 bg-black/60">
                      <CheckCircle2 className="h-7 w-7 text-emerald-300" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-semibold text-emerald-200 tracking-wide uppercase">
                      Run complete!
                    </p>
                    {isTimedEnded && (
                      <p className="text-xs text-emerald-100">
                        You correctly matched{" "}
                        <span className="font-semibold text-emerald-200">{timedScore}</span> examines
                        in timed mode.
                      </p>
                    )}
                    {isLivesEnded && (
                      <p className="text-xs text-amber-100">
                        You correctly matched{" "}
                        <span className="font-semibold text-amber-200">{livesScore}</span> examines
                        before running out of lives.
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Use <span className="font-semibold">Reset run</span>{" "}
                      {isTimedEnded ? "or End run" : ""} to start a fresh game.
                    </p>
                  </div>
                ) : (
                  <>
                    {result === "correct" && (
                      <>
                        <div className="pointer-events-none absolute -top-6 left-4 h-10 w-10 rounded-full border border-amber-400/40 animate-ping" />
                        <div className="pointer-events-none absolute -top-4 right-6 h-10 w-10 rounded-full border border-amber-300/30 animate-ping" />
                        <div className="pointer-events-none absolute bottom-0 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border border-emerald-400/40 animate-ping" />
                      </>
                    )}
                    <div className="relative z-10 flex h-full flex-col gap-4 text-center">
                      {/* Central icon + result (vertically centered) */}
                      <div className="flex-1 flex flex-col items-center justify-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-400/60 bg-black/40">
                          {result === "correct" && (
                            <CheckCircle2 className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                          )}
                          {result === "incorrect" && (
                            <XCircle className="h-6 w-6 text-red-300" aria-hidden="true" />
                          )}
                          {result === "idle" && (
                            <HelpCircle className="h-6 w-6 text-amber-300" aria-hidden="true" />
                          )}
                        </div>
                        {result === "correct" && (
                          <p className="font-semibold text-emerald-200">
                            Correct! You matched this examine.
                          </p>
                        )}
                        {result === "incorrect" && (
                          <p className="font-semibold text-red-200">
                            Not quite. Try another guess or roll a new examine.
                          </p>
                        )}
                        {result === "idle" && (
                          <p className="text-amber-200/90">
                            Check a guess to see your result and hint status here.
                          </p>
                        )}
                      </div>

                      {/* Hint states (locked → category → stronger) pinned toward bottom */}
                      <div className="text-xs text-amber-100 max-w-md pb-1">
                        {wrongStreak < 3 && !showHint && (
                          <p className="text-amber-200/80">
                            Hints are currently locked. Get{" "}
                            <span className="font-semibold">3 incorrect guesses</span> in a row on this
                            examine to unlock a category hint.
                          </p>
                        )}
                        {wrongStreak >= 3 && !showHint && (
                          <p className="text-amber-200/80">
                            You can now use <span className="font-semibold">Get hint</span> to reveal the
                            category this examine belongs to.
                          </p>
                        )}
                        {showHint && wrongStreak < 6 && currentEntry && (
                          <p className="text-amber-100">
                            <span className="font-semibold">Hint:</span> This examine belongs to an{" "}
                            {currentEntry.category === "items"
                              ? "item"
                              : currentEntry.category === "npcs"
                                ? "NPC"
                                : "object"}
                            .
                          </p>
                        )}
                        {showHint && wrongStreak >= 6 && currentEntry && (
                          <div className="space-y-1">
                            <p className="text-amber-100">
                              <span className="font-semibold">Stronger hint:</span> Here&apos;s an image of what
                              this examine belongs to.
                            </p>
                            <div className="mt-1 relative h-20 w-full overflow-hidden rounded-md border border-yellow-900/70 bg-black/60">
                              <Image
                                src={getHintImageForEntry(currentEntry)}
                                alt="Stronger visual hint for this examine"
                                fill
                                sizes="200px"
                                className="object-contain"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div
                className={`mt-4 text-xs ${
                  isTimedPrePhase ? "blur-sm pointer-events-none select-none" : ""
                }`}
              >
                <span
                  className="block"
                  title={
                    !showHint
                      ? wrongStreak < 3
                        ? `First hint unlocks in ${3 - wrongStreak} incorrect guess${
                            3 - wrongStreak === 1 ? "" : "es"
                          }.`
                        : "First hint available now via Get hint."
                      : hintStage === 1 && wrongStreak < 6
                        ? `Next hint unlocks in ${6 - wrongStreak} more incorrect guess${
                            6 - wrongStreak === 1 ? "" : "es"
                          }.`
                        : "All hints unlocked."
                  }
                >
                  <Button
                    size="default"
                    variant="outline"
                    className={`w-full justify-center ${
                      wrongStreak >= 3 && !showHint
                        ? "bg-sky-600 border-sky-500 text-white hover:bg-sky-500"
                        : "border-sky-500 text-sky-200 hover:bg-sky-900/40"
                    }`}
                    onClick={() => setShowHint(true)}
                    disabled={
                      wrongStreak < 3 ||
                      showHint ||
                      (examineGameMode === "limited" &&
                        (!hasActiveExamine || remainingHearts <= 0)) ||
                      (examineGameMode === "timed" &&
                        (timeLeft <= 0 || !timedRunning || timedPreCountdown !== null))
                    }
                  >
                    Get hint ({hintStage}/2)
                  </Button>
                </span>
              </div>

              {/* tags moved to right-hand column bottom */}

              {examineGameMode === "timed" &&
                (!gameInProgress || timedPreCountdown !== null) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {timedPreCountdown !== null ? (
                      <div className="text-6xl md:text-7xl font-black text-sky-300 animate-bounce drop-shadow-[0_0_18px_rgba(56,189,248,0.9)]">
                        {timedPreCountdown}
                      </div>
                    ) : (
                      <Button
                        size="lg"
                        className="px-6 py-3 text-xs font-semibold tracking-[0.2em] uppercase bg-sky-700 hover:bg-sky-600 text-sky-50"
                        onClick={() => {
                          setGameInProgress(true);
                          setTimedPreCountdown(5);
                        }}
                      >
                        Start timed run
                      </Button>
                    )}
                  </div>
                )}
            </div>

            {/* Right: Guess + controls */}
            <div className="flex flex-col space-y-4">
              {/* Game mode + timer */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-yellow-300/90">
                    Mode
                  </span>
                  <div className="inline-flex gap-1 rounded-md border border-border bg-black/40 p-0.5">
                    <Button
                      size="sm"
                      variant={examineGameMode === "limited" ? "secondary" : "ghost"}
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        if (gameInProgress && !isRunEnded) return;
                        setExamineGameMode("limited");
                        resetLimitedRun();
                      }}
                      disabled={gameInProgress && !isRunEnded}
                    >
                      Lives mode
                    </Button>
                    <Button
                      size="sm"
                      variant={examineGameMode === "timed" ? "secondary" : "ghost"}
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        if (gameInProgress && !isRunEnded) return;
                        setExamineGameMode("timed");
                        resetTimedRun();
                      }}
                      disabled={gameInProgress && !isRunEnded}
                    >
                      Timed (10:00)
                    </Button>
                  </div>
                </div>
                {gameInProgress && !isRunEnded && (
                  <div className="ml-auto" />
                )}
              </div>

              {/* Difficulty + category controls (design only) */}
              <div
                className={`flex flex-wrap items-center gap-3 text-xs ${
                  gameInProgress && !isRunEnded
                    ? "opacity-40 blur-[2px] pointer-events-none"
                    : ""
                }`}
              >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-yellow-300/90">
                      Difficulty
                    </span>
                    <div className="inline-flex gap-1 rounded-md border border-border bg-black/40 p-0.5">
                      <Button
                        size="sm"
                        variant={difficulty === "easy" ? "secondary" : "ghost"}
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setDifficulty("easy")}
                      >
                        Easy
                      </Button>
                      <Button
                        size="sm"
                        variant={difficulty === "hard" ? "secondary" : "ghost"}
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setDifficulty("hard")}
                      >
                        Hard
                      </Button>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-2 transition ${
                      difficulty === "hard" ? "opacity-40 blur-[2px] pointer-events-none" : ""
                    }`}
                  >
                    <span className="text-[11px] uppercase tracking-[0.16em] text-yellow-300/90">
                      Category
                    </span>
                    <div className="inline-flex gap-1 rounded-md border border-border bg-black/40 p-0.5">
                      <Button
                        size="sm"
                        variant={easyCategory === "items" ? "secondary" : "ghost"}
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setEasyCategory("items")}
                      >
                        Items
                      </Button>
                      <Button
                        size="sm"
                        variant={easyCategory === "npcs" ? "secondary" : "ghost"}
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setEasyCategory("npcs")}
                      >
                        NPCs
                      </Button>
                      <Button
                        size="sm"
                        variant={easyCategory === "objects" ? "secondary" : "ghost"}
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setEasyCategory("objects")}
                      >
                        Objects
                      </Button>
                    </div>
                  </div>
                </div>

              <div className="space-y-2">
                <label
                  htmlFor="guess"
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Your guess
                </label>
                <input
                  id="guess"
                  className="w-full rounded-md border border-border bg-secondary/70 px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="Type an ID or exact name (case doesn't matter)..."
                  value={guess}
                  onChange={(event) => setGuess(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCheckGuess();
                    }
                  }}
                  disabled={examineGameMode === "limited" && !hasActiveExamine}
                />
                <p className="text-[11px] text-muted-foreground">
                  You can guess by numeric ID or by the exact name of the item,
                  NPC, or object. If multiple entries share this examine text, any
                  matching ID or name will count as correct.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <Button
                  size="default"
                  className="w-full justify-center"
                  onClick={handleCheckGuess}
                  disabled={
                    !guess.trim() ||
                    (examineGameMode === "limited" &&
                      (!hasActiveExamine || remainingHearts <= 0)) ||
                    (examineGameMode === "timed" &&
                      (timeLeft <= 0 || !timedRunning || timedPreCountdown !== null))
                  }
                >
                  Check guess
                </Button>
                {examineGameMode === "limited" && (
                  <>
                    <Button
                      size="default"
                      variant="secondary"
                      className="w-full justify-center bg-amber-900 hover:bg-amber-800 text-amber-50"
                      onClick={() => {
                        if (remainingHearts <= 0) return;
                        // First New examine of a run should be free.
                        // Only decrement a life if we already have an active examine.
                        if (hasActiveExamine) {
                          setRemainingHearts((prev) => (prev > 0 ? prev - 1 : 0));
                        }
                        rollNewEntry();
                      }}
                      disabled={remainingHearts <= 0}
                    >
                      New examine
                    </Button>
                    <Button
                      size="default"
                      variant="outline"
                      className="w-full justify-center border-red-500 text-red-200 hover:bg-red-900/40"
                      onClick={() => setShowEndConfirm(true)}
                      disabled={!hasActiveExamine}
                    >
                      Reset run
                    </Button>
                  </>
                )}
                {examineGameMode === "timed" && (
                  <Button
                    size="default"
                    className="w-full justify-center bg-red-700 hover:bg-red-600 text-red-50"
                    onClick={() => setShowEndConfirm(true)}
                    disabled={!gameInProgress}
                  >
                    End run
                  </Button>
                )}
              </div>

              <div className="mt-auto pt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="px-2 py-1 rounded-full bg-black/40 border border-yellow-900/40">
                  Difficulty: {difficulty === "easy" ? "Easy" : "Hard"}
                </span>
                <span className="px-2 py-1 rounded-full bg-black/40 border border-yellow-900/40">
                  {difficulty === "easy"
                    ? `Category: ${
                        easyCategory === "items"
                          ? "Items only"
                          : easyCategory === "npcs"
                            ? "NPCs only"
                            : "Objects only"
                      }`
                    : "Category: Random (all)"}
                </span>
              </div>

              {/* feedback is now shown in the left examine panel */}
            </div>
          </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <a
              href="https://buymeacoffee.com/openrune"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              <Coffee className="h-3 w-3 text-amber-300" aria-hidden="true" />
              <span>Support</span>
            </a>
            <span className="h-3 w-px bg-border/60" />
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Github className="h-3 w-3 text-amber-300" aria-hidden="true" />
                <span>
                  Made by{" "}
                  <a
                    href="https://github.com/Mark7625"
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline text-amber-200"
                  >
                    Mark
                  </a>
                </span>
              </span>
              <span className="h-3 w-px bg-border/60" />
              <span className="inline-flex items-center gap-1 text-amber-200">
                <MessageCircle className="h-3 w-3" aria-hidden="true" />
                <span>Discord: mark_7625</span>
              </span>
            </span>
          </div>
          <span>© {new Date().getFullYear()} RuneGuess. All rights reserved.</span>
        </footer>
      </div>
    </main>
  );
}

