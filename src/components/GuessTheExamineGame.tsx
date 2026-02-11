"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  HelpCircle,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createSession,
  endRun as apiEndRun,
  openSessionEvents,
  requestHint as apiRequestHint,
  requestNewExamine as apiRequestNewExamine,
  startLimited as apiStartLimited,
  startTimed as apiStartTimed,
  submitGuess as apiSubmitGuess,
  type GuessTheExamineConfig
} from "@/lib/runeguess-server";

type ExamineCategory = "items" | "npcs" | "objects";
type ExamineGameMode = "limited" | "timed";

export function GuessTheExamineGame() {
  const [examineGameMode, setExamineGameMode] =
    useState<ExamineGameMode>("limited");
  const [difficulty, setDifficulty] = useState<"easy" | "hard">("easy");
  const [easyCategory, setEasyCategory] = useState<
    "items" | "npcs" | "objects"
  >("items");
  const [hasActiveExamine, setHasActiveExamine] = useState(false);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<"idle" | "correct" | "incorrect">(
    "idle"
  );
  const [remainingHearts, setRemainingHearts] = useState(20);
  const [timedRunning, setTimedRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [timedScore, setTimedScore] = useState(0);
  const [livesScore, setLivesScore] = useState(0);
  const [timedPreCountdown, setTimedPreCountdown] = useState<number | null>(null);
  const [gameInProgress, setGameInProgress] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [maskedExamine, setMaskedExamine] = useState<string | null>(null);
  const [questionCategory, setQuestionCategory] = useState<ExamineCategory | null>(null);
  const [hintStageFromServer, setHintStageFromServer] = useState(0);
  const [hintImageUrl, setHintImageUrl] = useState<string | null>(null);
  const [hint1Available, setHint1Available] = useState(false);
  const [hint2Available, setHint2Available] = useState(false);
  const [gameEndedReason, setGameEndedReason] = useState<"lives" | "time" | null>(null);
  const [gameEndedScore, setGameEndedScore] = useState<number | null>(null);
  const [runEndedByUser, setRunEndedByUser] = useState(false);
  const [wrongGuessCount, setWrongGuessCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const hintStage = hintStageFromServer;
  const isTimedPrePhase =
    examineGameMode === "timed" && (!gameInProgress || timedPreCountdown !== null);

  const maxLives = difficulty === "easy" ? 20 : 10;
  const isLivesEnded = gameEndedReason === "lives" || (examineGameMode === "limited" && remainingHearts <= 0 && gameInProgress);
  const isTimedEnded = gameEndedReason === "time";
  const isRunEnded = isLivesEnded || isTimedEnded || runEndedByUser;

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const resetLimitedRun = useCallback(() => {
    setRemainingHearts(maxLives);
    setLivesScore(0);
    setResult("idle");
    setGuess("");
    setHasActiveExamine(false);
    setGameInProgress(false);
    setGameEndedReason(null);
    setGameEndedScore(null);
    setRunEndedByUser(false);
    setMaskedExamine(null);
    setQuestionCategory(null);
    setHintStageFromServer(0);
    setHintImageUrl(null);
    setHint1Available(false);
    setHint2Available(false);
    setWrongGuessCount(0);
    setSkippedCount(0);
    if (sessionId) {
      apiEndRun(sessionId);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSessionId(null);
    }
  }, [maxLives, sessionId]);

  const resetTimedRun = useCallback(() => {
    setTimedScore(0);
    setTimeLeft(600);
    setTimedRunning(false);
    setResult("idle");
    setGuess("");
    setTimedPreCountdown(null);
    setGameInProgress(false);
    setGameEndedReason(null);
    setGameEndedScore(null);
    setRunEndedByUser(false);
    setMaskedExamine(null);
    setQuestionCategory(null);
    setHintStageFromServer(0);
    setHintImageUrl(null);
    setHint1Available(false);
    setHint2Available(false);
    setWrongGuessCount(0);
    setSkippedCount(0);
    if (sessionId) {
      apiEndRun(sessionId);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSessionId(null);
    }
  }, [sessionId]);

  const getServerConfig = useCallback((): GuessTheExamineConfig => ({
    mode: examineGameMode,
    difficulty,
    easyCategory
  }), [examineGameMode, difficulty, easyCategory]);

  const startLimitedWithServer = useCallback(async () => {
    setServerError(null);
    const config = getServerConfig();
    if (config.mode !== "limited") return;
    const oldSid = sessionId;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (oldSid) {
      apiEndRun(oldSid);
    }
    setSessionId(null);
    setGameEndedReason(null);
    setGameEndedScore(null);
    setRunEndedByUser(false);
    setRemainingHearts(difficulty === "easy" ? 20 : 10);
    const res = await createSession(config);
    if (!res) {
      setServerError(
        "Cannot reach game server. Set NEXT_PUBLIC_RUNEGUESS_SERVER_URL (e.g. http://localhost:8081) in .env.local and ensure the backend is running."
      );
      return;
    }
    const sid = res.sessionId;
    const es = openSessionEvents(sid, {
      onQuestion: (d) => {
        setMaskedExamine(d.maskedExamine);
        setQuestionCategory((d.category?.toLowerCase() ?? "items") as ExamineCategory);
        setHintStageFromServer(d.hintStage ?? 0);
        setHintImageUrl(d.hintImageUrl ?? null);
        setResult("idle");
      },
      onGuessResult: (d) => {
        setResult(d.correct ? "correct" : "incorrect");
        setTimedScore(d.score);
        setLivesScore(d.score);
        if (d.lives != null) {
          setRemainingHearts(d.lives);
          if (d.lives <= 0) {
            setGameEndedReason("lives");
            setGameEndedScore(d.score);
          }
        }
        if (d.hintStage != null) setHintStageFromServer(d.hintStage);
        if (d.hint1Available != null) setHint1Available(d.hint1Available);
        if (d.hint2Available != null) setHint2Available(d.hint2Available);
        if (!d.correct) setWrongGuessCount((c) => c + 1);
      },
      onGameEnded: (d) => {
        setGameEndedReason(d.reason);
        setGameEndedScore(d.finalScore);
        if (d.wrongGuessCount != null) setWrongGuessCount(d.wrongGuessCount);
        if (d.skippedCount != null) setSkippedCount(d.skippedCount);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setSessionId(null);
      },
      onRunEnded: (d) => {
        setGameEndedScore(d.score);
        setRunEndedByUser(true);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setSessionId(null);
      }
    });
    eventSourceRef.current = es;
    setSessionId(sid);
    setGameInProgress(true);
    setHasActiveExamine(true);
    setResult("idle");
    setMaskedExamine(null);
    setLivesScore(0);
    setRemainingHearts(difficulty === "easy" ? 20 : 10);
    setWrongGuessCount(0);
    setSkippedCount(0);
    setHint1Available(false);
    setHint2Available(false);
    await apiStartLimited(sid);
  }, [getServerConfig, sessionId, difficulty]);

  const startTimedWithServer = useCallback(async () => {
    setServerError(null);
    const config = getServerConfig();
    if (config.mode !== "timed") return;
    const oldSid = sessionId;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (oldSid) {
      apiEndRun(oldSid);
    }
    setSessionId(null);
    setGameEndedReason(null);
    setGameEndedScore(null);
    setRunEndedByUser(false);
    const res = await createSession(config);
    if (!res) {
      setServerError(
        "Cannot reach game server. Set NEXT_PUBLIC_RUNEGUESS_SERVER_URL (e.g. http://localhost:8081) in .env.local and ensure the backend is running."
      );
      return;
    }
    const sid = res.sessionId;
    const es = openSessionEvents(sid, {
      onQuestion: (d) => {
        setMaskedExamine(d.maskedExamine);
        setQuestionCategory((d.category?.toLowerCase() ?? "items") as ExamineCategory);
        setHintStageFromServer(d.hintStage ?? 0);
        setHintImageUrl(d.hintImageUrl ?? null);
        setResult("idle");
        setTimedPreCountdown(null);
        setTimedRunning(true);
      },
      onTimer: (d) => setTimeLeft(d.secondsLeft),
      onGuessResult: (d) => {
        setResult(d.correct ? "correct" : "incorrect");
        setTimedScore(d.score);
        if (d.lives != null) setRemainingHearts(d.lives);
        if (d.hintStage != null) setHintStageFromServer(d.hintStage);
        if (d.hint1Available != null) setHint1Available(d.hint1Available);
        if (d.hint2Available != null) setHint2Available(d.hint2Available);
        if (!d.correct) setWrongGuessCount((c) => c + 1);
      },
      onGameEnded: (d) => {
        setGameEndedReason(d.reason);
        setGameEndedScore(d.finalScore);
        if (d.wrongGuessCount != null) setWrongGuessCount(d.wrongGuessCount);
        if (d.skippedCount != null) setSkippedCount(d.skippedCount);
        setTimedRunning(false);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setSessionId(null);
      },
      onPreCountdown: (d) => setTimedPreCountdown(d.seconds),
      onRunEnded: (d) => {
        setGameEndedScore(d.score);
        setRunEndedByUser(true);
        setTimedRunning(false);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setSessionId(null);
      }
    });
    eventSourceRef.current = es;
    setSessionId(sid);
    setGameInProgress(true);
    setTimedPreCountdown(5);
    setResult("idle");
    setMaskedExamine(null);
    setTimedScore(0);
    setTimeLeft(600);
    setTimedRunning(false);
    setWrongGuessCount(0);
    setSkippedCount(0);
    setHint1Available(false);
    setHint2Available(false);
    await apiStartTimed(sid);
  }, [getServerConfig, sessionId]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const handleCheckGuess = async () => {
    const value = guess.trim();
    if (!value || !sessionId) return;
    const res = await apiSubmitGuess(sessionId, value);
    if (res) {
      setResult(res.correct ? "correct" : "incorrect");
      setGuess("");
    }
  };

  const handleEndRun = () => {
    if (sessionId) {
      apiEndRun(sessionId);
      setShowEndConfirm(false);
    }
  };

  return (
    <>
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
      {serverError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-xl mx-4 px-4 py-3 rounded-lg border border-red-500/80 bg-red-950/95 text-red-100 text-sm flex items-center gap-3 shadow-lg">
          <XCircle className="h-5 w-5 shrink-0 text-red-400" />
          <span>{serverError}</span>
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-red-200 hover:text-red-50 hover:bg-red-900/50 h-8 px-2"
            onClick={() => setServerError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}
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
              {examineGameMode === "limited" && !hasActiveExamine && !gameInProgress ? (
                <span className="text-amber-200/80">
                  Press <span className="font-semibold">Start run</span> to begin. You have{" "}
                  <span className="font-semibold">
                    {difficulty === "easy" ? 20 : 10} lives
                  </span>
                  ; each correct guess gives you the next examine automatically.
                </span>
              ) : maskedExamine != null ? (
                maskedExamine
              ) : hasActiveExamine || gameInProgress ? (
                <span className="text-amber-200/80">Loading…</span>
              ) : (
                <span className="text-amber-200/80">
                  Press <span className="font-semibold">Start run</span> to begin. You have{" "}
                  <span className="font-semibold">
                    {difficulty === "easy" ? 20 : 10} lives
                  </span>
                  .
                </span>
              )}
            </div>
          </div>

          {/* Feedback + hint box */}
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
              <>
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                  {[...Array(16)].map((_, i) => (
                    <div
                      key={i}
                      className={`absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full animate-firework ${i % 3 === 0 ? "bg-amber-400" : i % 3 === 1 ? "bg-yellow-300" : "bg-amber-500"}`}
                      style={{
                        "--angle": `${(i * 360) / 16}deg`,
                        animationDelay: `${i * 0.02}s`
                      } as React.CSSProperties}
                    />
                  ))}
                </div>
                <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 text-center px-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-400/70 bg-black/60">
                    {isLivesEnded ? (
                      <XCircle className="h-7 w-7 text-red-400" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-7 w-7 text-emerald-300" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-base font-bold uppercase tracking-wide">
                    {isLivesEnded ? "Game over" : "Run complete!"}
                  </p>
                  <div className="flex flex-col gap-1.5 text-sm text-amber-100">
                    <p>
                      Score:{" "}
                      <span className="font-semibold text-amber-200">
                        {gameEndedScore ?? (examineGameMode === "limited" ? livesScore : timedScore)}
                      </span>
                    </p>
                    {examineGameMode === "limited" && (
                      <>
                        <p>
                          Skipped:{" "}
                          <span className="font-semibold text-amber-200">{skippedCount}</span>
                        </p>
                        <p>
                          Wrong guesses:{" "}
                          <span className="font-semibold text-amber-200">{wrongGuessCount}</span>
                        </p>
                      </>
                    )}
                    {examineGameMode === "timed" && (
                      <>
                        {isTimedEnded && (
                          <p className="text-xs text-emerald-100">
                            You correctly matched{" "}
                            <span className="font-semibold text-emerald-200">
                              {gameEndedScore ?? timedScore}
                            </span>{" "}
                            examines.
                          </p>
                        )}
                        <p>
                          Wrong guesses:{" "}
                          <span className="font-semibold text-amber-200">{wrongGuessCount}</span>
                        </p>
                      </>
                    )}
                    {runEndedByUser && !gameEndedReason && (
                      <p className="text-xs text-amber-100">
                        You ended the run.
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Use <span className="font-semibold">Start run</span> below or{" "}
                    <span className="font-semibold">Reset run</span> to play again.
                  </p>
                </div>
              </>
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
                        Correct! Enter your next guess in the box to the right.
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

                  <div className="text-xs text-amber-100 max-w-md pb-1 space-y-1">
                    {hintStageFromServer === 0 && !hint1Available && (
                      <p className="text-amber-200/80">
                        Hints are locked. Get{" "}
                        <span className="font-semibold">1 incorrect guess</span> on this examine to unlock the category hint.
                      </p>
                    )}
                    {hintStageFromServer >= 1 && questionCategory && (
                      <p className="text-amber-100">
                        <span className="font-semibold">Hint 1:</span> This examine belongs to an{" "}
                        {questionCategory === "items"
                          ? "item"
                          : questionCategory === "npcs"
                            ? "NPC"
                            : "object"}
                        .
                      </p>
                    )}
                    {hintStageFromServer >= 2 && (
                      <>
                        <p className="text-amber-100">
                          <span className="font-semibold">Hint 2:</span> Image below.
                        </p>
                        {hintImageUrl && (
                          <div className="mt-2 rounded border border-amber-700/50 overflow-hidden bg-black/40 max-w-[200px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={hintImageUrl} alt="Hint" className="w-full h-auto object-contain" />
                          </div>
                        )}
                      </>
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
            <span className="block" title={hintStageFromServer >= 2 ? "Both hints used for this examine." : (hint1Available && hintStageFromServer < 1) || (hint2Available && hintStageFromServer < 2) ? "Click to use the next available hint (1 per examine each)." : "Hint 1 unlocks after 1 wrong guess; hint 2 after 3 wrong on this examine."}>
              <Button
                size="default"
                variant="outline"
                className={`w-full justify-center ${
                  ((hint1Available && hintStageFromServer < 1) || (hint2Available && hintStageFromServer < 2))
                    ? "bg-sky-600 border-sky-500 text-white hover:bg-sky-500"
                    : "border-sky-500 text-sky-200 hover:bg-sky-900/40"
                }`}
                onClick={async () => {
                  if (sessionId) await apiRequestHint(sessionId);
                }}
                disabled={
                  !((hint1Available && hintStageFromServer < 1) || (hint2Available && hintStageFromServer < 2)) ||
                  !sessionId ||
                  (examineGameMode === "limited" && remainingHearts <= 0) ||
                  (examineGameMode === "timed" &&
                    (timeLeft <= 0 || !timedRunning || timedPreCountdown !== null))
                }
              >
                Get hint ({hintStage}/2)
              </Button>
            </span>
          </div>

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
                    onClick={async () => {
                      await startTimedWithServer();
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
            {gameInProgress && !isRunEnded && <div className="ml-auto" />}
          </div>

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
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCheckGuess();
                }
              }}
              disabled={examineGameMode === "limited" && !hasActiveExamine}
            />
            <p className="text-[11px] text-muted-foreground">
              You can guess by numeric ID or by the exact name of the item, NPC, or object. If multiple entries share this examine text, any matching ID or name will count as correct.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <Button
              size="default"
              className="w-full justify-center"
              onClick={handleCheckGuess}
              disabled={
                !guess.trim() ||
                !sessionId ||
                (examineGameMode === "limited" &&
                  (!hasActiveExamine || remainingHearts <= 0)) ||
                (examineGameMode === "timed" &&
                  (timeLeft <= 0 || !timedRunning || timedPreCountdown !== null))
              }
            >
              Check guess
            </Button>
            {examineGameMode === "limited" && hasActiveExamine && remainingHearts > 0 && sessionId && (
              <Button
                size="default"
                variant="outline"
                className="w-full justify-center border-amber-500 text-amber-200 hover:bg-amber-900/40"
                onClick={async () => {
                  if (sessionId) {
                    setSkippedCount((c) => c + 1);
                    await apiRequestNewExamine(sessionId);
                  }
                }}
              >
                Skip (lose 1 life)
              </Button>
            )}
            {examineGameMode === "limited" && (
              <>
                {(!gameInProgress || isRunEnded || remainingHearts <= 0) && (
                  <Button
                    size="default"
                    variant="secondary"
                    className="w-full justify-center bg-amber-900 hover:bg-amber-800 text-amber-50"
                    onClick={async () => {
                      await startLimitedWithServer();
                    }}
                  >
                    Start run
                  </Button>
                )}
                <Button
                  size="default"
                  variant="outline"
                  className="w-full justify-center border-red-500 text-red-200 hover:bg-red-900/40"
                  onClick={() => setShowEndConfirm(true)}
                  disabled={!hasActiveExamine && !isRunEnded}
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
                ? `Category: ${easyCategory === "items" ? "Items only" : easyCategory === "npcs" ? "NPCs only" : "Objects only"}`
                : "Category: Random (all)"}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
