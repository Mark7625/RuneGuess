"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FaCheckCircle, FaClock, FaHeart, FaQuestionCircle, FaTimesCircle } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import {
  createSession,
  endRun as apiEndRun,
  endRunBeacon,
  openSessionEvents,
  requestHint as apiRequestHint,
  requestNewExamine as apiRequestNewExamine,
  startLimited as apiStartLimited,
  startTimed as apiStartTimed,
  startPractice as apiStartPractice,
  submitGuess as apiSubmitGuess,
  type GuessTheExamineConfig
} from "@/lib/runeguess-server";

type ExamineCategory = "items" | "npcs" | "objects";
type ExamineGameMode = "limited" | "timed" | "practice";

export type GuessTheExamineGameHandle = { endRun: () => void };

export const GuessTheExamineGame = forwardRef<GuessTheExamineGameHandle, { onGameActiveChange?: (active: boolean) => void }>(
  function GuessTheExamineGame({ onGameActiveChange }, ref) {
  const auth = useAuth();
  const sessionToken = auth?.user?.token ?? null;
  const [examineGameMode, setExamineGameMode] =
    useState<ExamineGameMode>("limited");
  const [difficulty, setDifficulty] = useState<"easy" | "hard">("easy");
  const [practiceCategory, setPracticeCategory] = useState<"items" | "npcs" | "objects">("items");
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
  const [hintImageData, setHintImageData] = useState<string | null>(null);
  const [hint1Available, setHint1Available] = useState(false);
  const [hint2Available, setHint2Available] = useState(false);
  const [gameEndedReason, setGameEndedReason] = useState<"lives" | "time" | null>(null);
  const [gameEndedScore, setGameEndedScore] = useState<number | null>(null);
  const [runEndedByUser, setRunEndedByUser] = useState(false);
  const [wrongGuessCount, setWrongGuessCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;

  // When user closes tab or navigates away, tell server to remove session from active list
  useEffect(() => {
    const onLeave = () => {
      if (sessionIdRef.current) endRunBeacon(sessionIdRef.current);
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, []);

  const endRunAndNotify = useCallback(() => {
    const sid = sessionIdRef.current;
    if (sid) {
      apiEndRun(sid);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSessionId(null);
      setGameInProgress(false);
      onGameActiveChange?.(false);
    }
  }, [onGameActiveChange]);

  useImperativeHandle(ref, () => ({ endRun: endRunAndNotify }), [endRunAndNotify]);

  const hintStage = hintStageFromServer;

  const maxLives = difficulty === "easy" ? 20 : 10;
  const isLivesEnded =
    gameEndedReason === "lives" ||
    (examineGameMode === "limited" && remainingHearts <= 0 && gameInProgress);
  const isTimedEnded = gameEndedReason === "time";
  const isRunEnded = isLivesEnded || isTimedEnded || runEndedByUser;

  const isTimedPrePhase =
    examineGameMode === "timed" &&
    !isRunEnded &&
    (!gameInProgress || timedPreCountdown !== null);

  const isPreGamePhase =
    !gameInProgress && !hasActiveExamine && !isRunEnded;

  const isLeftBlurred = isPreGamePhase || isTimedPrePhase;

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
    setHintImageData(null);
    setHint1Available(false);
    setHint2Available(false);
    setWrongGuessCount(0);
    setSkippedCount(0);
    if (sessionId) {
      apiEndRun(sessionId);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSessionId(null);
      onGameActiveChange?.(false);
    }
  }, [maxLives, sessionId, onGameActiveChange]);

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
    setHintImageData(null);
    setHint1Available(false);
    setHint2Available(false);
    setWrongGuessCount(0);
    setSkippedCount(0);
    if (sessionId) {
      apiEndRun(sessionId);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSessionId(null);
      onGameActiveChange?.(false);
    }
  }, [sessionId, onGameActiveChange]);

  const getServerConfig = useCallback((): GuessTheExamineConfig => ({
    mode: examineGameMode,
    difficulty: examineGameMode === "practice" ? "easy" : difficulty, // Practice mode always easy
    easyCategory: examineGameMode === "practice" ? practiceCategory : "items" // Use practiceCategory for practice mode
  }), [examineGameMode, difficulty, practiceCategory]);

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
    const res = await createSession(config, sessionToken);
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
        // Prefer base64 data over URL for security
        setHintImageData(d.hintImageData ?? d.hintImageUrl ?? null);
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
        onGameActiveChange?.(false);
      },
      onRunEnded: (d) => {
        setGameEndedScore(d.score);
        setRunEndedByUser(true);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setSessionId(null);
        onGameActiveChange?.(false);
      }
    });
    eventSourceRef.current = es;
    setSessionId(sid);
    setGameInProgress(true);
    onGameActiveChange?.(true);
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
  }, [getServerConfig, sessionId, difficulty, sessionToken, onGameActiveChange]);

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
    const res = await createSession(config, sessionToken);
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
        // Prefer base64 data over URL for security
        setHintImageData(d.hintImageData ?? d.hintImageUrl ?? null);
        setResult("idle");
        setTimedPreCountdown(null);
        setTimedRunning(true);
        setHasActiveExamine(true);
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
        onGameActiveChange?.(false);
      },
      onPreCountdown: (d) => setTimedPreCountdown(d.seconds),
      onRunEnded: (d) => {
        setGameEndedScore(d.score);
        setRunEndedByUser(true);
        setTimedRunning(false);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setSessionId(null);
        onGameActiveChange?.(false);
      }
    });
    eventSourceRef.current = es;
    setSessionId(sid);
    setGameInProgress(true);
    onGameActiveChange?.(true);
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
  }, [getServerConfig, sessionId, sessionToken, onGameActiveChange]);

  const startPracticeWithServer = useCallback(async () => {
    setServerError(null);
    const config = getServerConfig();
    if (config.mode !== "practice") return;
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
    const res = await createSession(config, sessionToken);
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
        // Prefer base64 data over URL for security
        setHintImageData(d.hintImageData ?? d.hintImageUrl ?? null);
        setResult("idle");
        setHasActiveExamine(true);
      },
      onGuessResult: (d) => {
        setResult(d.correct ? "correct" : "incorrect");
        setTimedScore(d.score);
        setLivesScore(d.score);
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
        onGameActiveChange?.(false);
      },
      onRunEnded: (d) => {
        setGameEndedScore(d.score);
        setRunEndedByUser(true);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setSessionId(null);
        onGameActiveChange?.(false);
      }
    });
    eventSourceRef.current = es;
    setSessionId(sid);
    setGameInProgress(true);
    onGameActiveChange?.(true);
    setHasActiveExamine(true);
    setResult("idle");
    setMaskedExamine(null);
    setLivesScore(0);
    setWrongGuessCount(0);
    setSkippedCount(0);
    setHint1Available(false);
    setHint2Available(false);
    await apiStartPractice(sid);
  }, [getServerConfig, sessionId, practiceCategory, sessionToken, onGameActiveChange]);

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
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {examineGameMode === "limited" ? "Reset current run?" : examineGameMode === "practice" ? "End practice session?" : "End current run?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {examineGameMode === "limited" ? (
                <>
                  This will reset your current{" "}
                  <span className="font-semibold text-amber-200">lives run</span>, restoring all
                  lives and clearing your progress on this run.
                </>
              ) : examineGameMode === "practice" ? (
                <>
                  This will end your current{" "}
                  <span className="font-semibold text-amber-200">practice session</span> and clear your progress.
                </>
              ) : (
                <>
                  This will end your current{" "}
                  <span className="font-semibold text-sky-200">timed</span> game and reset your
                  timer and score.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndRun}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {examineGameMode === "limited" ? "Reset run" : examineGameMode === "practice" ? "End practice" : "End run"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {serverError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-xl mx-4">
          <Alert variant="destructive" className="flex items-center gap-3">
            <FaTimesCircle className="h-5 w-5 shrink-0" />
            <AlertDescription className="flex-1">{serverError}</AlertDescription>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 h-8 px-2"
              onClick={() => setServerError(null)}
            >
              Dismiss
            </Button>
          </Alert>
        </div>
      )}
      <Card className="min-h-[520px] overflow-hidden bg-black/60">
        {/* Top mode strip */}
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-black/85 via-zinc-900/80 to-black/85 px-4 py-2">
          <div className="w-[120px]"></div> {/* Spacer to balance layout */}
          <h2 className="text-sm font-semibold text-yellow-200 uppercase tracking-[0.2em]">
            Guess The Examine{examineGameMode === "limited" ? " - Lives mode" : examineGameMode === "timed" ? " - Timed mode" : " - Practice mode"}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="uppercase tracking-[0.18em] text-amber-300/80">
              Difficulty
            </span>
            <span className="inline-flex items-center rounded-full border border-amber-500/60 bg-black/60 px-2 py-0.5 font-mono text-[11px] text-amber-100">
              {examineGameMode === "practice" ? "Easy" : difficulty === "easy" ? "Easy" : "Hard"}
            </span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] p-5 md:p-6">
          {/* Left: Examine, feedback & meta */}
          <div className="relative flex flex-col border-b border-border pb-4 md:border-b-0 md:border-r md:pr-5">
          <div
            className={`space-y-4 ${
              isLeftBlurred ? "blur-sm pointer-events-none select-none" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              {/* Hint button or placeholder to keep badges on the right */}
              {difficulty === "hard" && examineGameMode === "timed" ? (
                <div className="h-7 w-[120px]" />
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-7 px-6 text-xs whitespace-nowrap ${
                            ((hint1Available && hintStageFromServer < 1) || (hint2Available && hintStageFromServer < 2))
                              ? "bg-sky-600 border-sky-500 text-white hover:bg-sky-500"
                              : "border-sky-500 text-sky-200 hover:bg-sky-900/40"
                          } ${isLeftBlurred ? "blur-sm pointer-events-none select-none" : ""}`}
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
                          Get Hint ({hintStage}/2)
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {hintStageFromServer >= 2 ? (
                        "Both hints used for this examine."
                      ) : (hint1Available && hintStageFromServer < 1) || (hint2Available && hintStageFromServer < 2) ? (
                        "Click to use the next available hint (1 per examine each)."
                      ) : (
                        `Unlock next hint in ${hintStageFromServer === 0 ? "1" : "2"} wrong guess${hintStageFromServer === 0 ? "" : "es"}`
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {examineGameMode === "timed" ? (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs rounded-full bg-black/40 border px-2 py-0.5 ${
                      timeLeft <= 120
                        ? "border-red-500 text-red-300"
                        : timeLeft <= 360
                          ? "border-yellow-500 text-yellow-200"
                          : "border-emerald-500 text-emerald-200"
                    }`}
                  >
                    <FaClock className="h-3 w-3 mr-1" aria-hidden="true" />
                    {formatTime(timeLeft)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-emerald-500 bg-emerald-900/60 text-[11px] font-semibold text-emerald-100">
                    <span className="uppercase tracking-[0.18em] text-emerald-300/90 mr-1">
                      Score
                    </span>
                    <span className="font-mono text-xs">{timedScore}</span>
                  </Badge>
                </div>
              ) : examineGameMode === "practice" ? (
                <Badge variant="outline" className="rounded-full border-emerald-500 bg-emerald-900/60 text-[11px] font-semibold text-emerald-100">
                  <span className="uppercase tracking-[0.18em] text-emerald-300/90 mr-1">
                    Score
                  </span>
                  <span className="font-mono text-xs">{livesScore}</span>
                </Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs rounded-full bg-black/40 border-amber-500 text-amber-200">
                    <FaHeart className="h-3 w-3 mr-1 text-red-300" aria-hidden="true" />
                    <span className="uppercase tracking-[0.18em] text-amber-300/90 mr-1">
                      Lives
                    </span>
                    <span className="font-mono text-xs">{remainingHearts}</span>
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-amber-400 bg-amber-900/60 text-[11px] font-semibold text-amber-100">
                    <span className="uppercase tracking-[0.18em] text-amber-300/90 mr-1">
                      Score
                    </span>
                    <span className="font-mono text-xs">{livesScore}</span>
                  </Badge>
                </div>
              )}
            </div>
            <Card className="bg-gradient-to-br from-stone-900/95 via-stone-950 to-stone-900 border-yellow-900/50 min-h-[80px]">
              <CardContent className="p-4 text-sm leading-relaxed text-amber-50">
                {isRunEnded ? (
                  <span className="text-amber-200/80">
                    Press <span className="font-semibold">Start run</span> to begin a new game.
                  </span>
                ) : examineGameMode === "limited" && !hasActiveExamine && !gameInProgress ? (
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
              </CardContent>
            </Card>
          </div>

          {/* Feedback + hint box */}
          <Card
            className={`mt-4 min-h-[280px] bg-black/60 relative overflow-hidden ${
              result === "correct"
                ? "border-emerald-600"
                : result === "incorrect"
                  ? "border-red-700"
                  : "border-yellow-900/70"
            } ${isLeftBlurred ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            <CardContent className="px-4 py-3 text-sm text-amber-50">
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
                      <FaTimesCircle className="h-7 w-7 text-red-400" aria-hidden="true" />
                    ) : (
                      <FaCheckCircle className="h-7 w-7 text-emerald-300" aria-hidden="true" />
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
                          Skipped:{" "}
                          <span className="font-semibold text-amber-200">{skippedCount}</span>
                        </p>
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
                        <FaCheckCircle className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                      )}
                      {result === "incorrect" && (
                        <FaTimesCircle className="h-6 w-6 text-red-300" aria-hidden="true" />
                      )}
                      {result === "idle" && (
                        <FaQuestionCircle className="h-6 w-6 text-amber-300" aria-hidden="true" />
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

                  {/* Hide hint text for hard mode timed games */}
                  {!(difficulty === "hard" && examineGameMode === "timed") && (
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
                          {hintImageData && (
                            <div className="mt-2 mx-auto rounded border border-amber-700/50 overflow-hidden bg-black/40 max-w-[200px]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={hintImageData.startsWith('data:') ? hintImageData : `data:image/png;base64,${hintImageData}`} 
                                alt="Hint" 
                                className="w-full h-auto object-contain"
                                onContextMenu={(e) => e.preventDefault()}
                                draggable={false}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            </CardContent>
          </Card>

          {examineGameMode === "timed" && timedPreCountdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-6xl md:text-7xl font-black text-sky-300 animate-bounce drop-shadow-[0_0_18px_rgba(56,189,248,0.9)]">
                {timedPreCountdown}
              </div>
            </div>
          )}
        </div>

        {/* Right: Settings (pre-game) or Guess controls (during game) */}
        <div className="flex flex-col space-y-4">
          {!gameInProgress || isRunEnded ? (
            <>
              {/* Pre-game: Settings */}
              <div className="space-y-4">
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
                          setExamineGameMode("limited");
                          resetLimitedRun();
                        }}
                      >
                        Lives mode
                      </Button>
                      <Button
                        size="sm"
                        variant={examineGameMode === "timed" ? "secondary" : "ghost"}
                        className="h-7 px-2 text-[11px]"
                        onClick={() => {
                          setExamineGameMode("timed");
                          resetTimedRun();
                        }}
                      >
                        Timed (10:00)
                      </Button>
                      <Button
                        size="sm"
                        variant={examineGameMode === "practice" ? "secondary" : "ghost"}
                        className="h-7 px-2 text-[11px]"
                        onClick={() => {
                          setExamineGameMode("practice");
                        }}
                      >
                        Practice
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Category selector - only for practice mode */}
                {examineGameMode === "practice" && (
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-yellow-300/90">
                        Category
                      </span>
                      <div className="inline-flex gap-1 rounded-md border border-border bg-black/40 p-0.5">
                        <Button
                          size="sm"
                          variant={practiceCategory === "items" ? "secondary" : "ghost"}
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setPracticeCategory("items")}
                        >
                          Items
                        </Button>
                        <Button
                          size="sm"
                          variant={practiceCategory === "npcs" ? "secondary" : "ghost"}
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setPracticeCategory("npcs")}
                        >
                          NPCs
                        </Button>
                        <Button
                          size="sm"
                          variant={practiceCategory === "objects" ? "secondary" : "ghost"}
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setPracticeCategory("objects")}
                        >
                          Objects
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Difficulty selector - hidden for practice mode */}
                {examineGameMode !== "practice" && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
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
                </div>
                )}

              {/* Game mode explanation */}
              <Card className="bg-gradient-to-br from-amber-950/40 via-amber-900/30 to-amber-950/40 border-amber-800/50 min-h-[200px]">
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-amber-200 uppercase tracking-wide">
                    {examineGameMode === "limited" ? "Lives Mode" : examineGameMode === "timed" ? "Timed Mode" : "Practice Mode"}
                  </h3>
                  {examineGameMode === "limited" ? (
                    <div className="text-xs text-amber-100/90 space-y-1.5">
                      <p>
                        Start with <span className="font-semibold text-amber-200">{difficulty === "easy" ? 20 : 10} lives</span>. Each correct guess automatically loads the next examine.
                      </p>
                      <p>
                        Wrong guesses reduce your lives. You can skip an examine, but it costs 1 life. The run ends when you run out of lives.
                      </p>
                      <p className="text-amber-200/80 pt-1">
                        <span className="font-semibold">Categories:</span> Mixed (Items, NPCs, Objects)
                      </p>
                    </div>
                  ) : examineGameMode === "practice" ? (
                    <div className="text-xs text-amber-100/90 space-y-1.5">
                      <p>
                        Practice mode lets you focus on a specific category. See how many you can get!
                      </p>
                      <p>
                        No lives limit, no time limit. Each correct guess loads the next examine. Wrong guesses don't end the run.
                      </p>
                      <p className="text-amber-200/80 pt-1">
                        <span className="font-semibold">Category:</span> {practiceCategory === "items" ? "Items only" : practiceCategory === "npcs" ? "NPCs only" : "Objects only"}
                      </p>
                      <p className="text-amber-200/80 pt-1">
                        <span className="font-semibold">Note:</span> Practice mode scores are not tracked on leaderboards.
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-100/90 space-y-1.5">
                      <p>
                        You have <span className="font-semibold text-amber-200">10 minutes</span> to correctly guess as many examines as possible.
                      </p>
                      <p>
                        Each correct guess increases your score. Wrong guesses don't end the run, but they don't add points. You can skip an examine, but it costs <span className="font-semibold text-amber-200">30 seconds</span>. The run ends when time runs out.
                      </p>
                      {difficulty === "hard" && (
                        <p className="text-amber-200/80 pt-1">
                          <span className="font-semibold">Hard mode:</span> No hints available.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Start button */}
              <div className="space-y-2 pt-1">
                {examineGameMode === "limited" && (
                  <Button
                    size="default"
                    variant="secondary"
                    className="w-full justify-center bg-sky-700 hover:bg-sky-600 text-sky-50"
                    onClick={async () => {
                      await startLimitedWithServer();
                    }}
                  >
                    Start run
                  </Button>
                )}
                {examineGameMode === "timed" && (
                  <Button
                    size="default"
                    variant="secondary"
                    className="w-full justify-center bg-sky-700 hover:bg-sky-600 text-sky-50"
                    onClick={async () => {
                      await startTimedWithServer();
                    }}
                  >
                    Start timed run
                  </Button>
                )}
                {examineGameMode === "practice" && (
                  <Button
                    size="default"
                    variant="secondary"
                    className="w-full justify-center bg-sky-700 hover:bg-sky-600 text-sky-50"
                    onClick={async () => {
                      await startPracticeWithServer();
                    }}
                  >
                    Start practice
                  </Button>
                )}
              </div>
              </div>
            </>
          ) : (
            <>
              {/* During game: Guess input and controls */}
              <div className="space-y-2">
                <Label htmlFor="guess" className="text-xs font-semibold tracking-wide uppercase">
                  Your guess
                </Label>
                <Input
                  id="guess"
                  className="bg-secondary/70 placeholder:text-muted-foreground/70"
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
                      (timeLeft <= 0 || !timedRunning || timedPreCountdown !== null)) ||
                    (examineGameMode === "practice" && !hasActiveExamine)
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
                {examineGameMode === "practice" && hasActiveExamine && sessionId && (
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
                    Skip
                  </Button>
                )}
                {examineGameMode === "timed" && hasActiveExamine && sessionId && timedRunning && timeLeft > 0 && timedPreCountdown === null && (
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
                    Skip (-30s)
                  </Button>
                )}
                {examineGameMode === "limited" && (
                  <Button
                    size="default"
                    variant="outline"
                    className="w-full justify-center border-red-500 text-red-200 hover:bg-red-900/40"
                    onClick={() => setShowEndConfirm(true)}
                    disabled={!hasActiveExamine && !isRunEnded}
                  >
                    Reset run
                  </Button>
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
                {examineGameMode === "practice" && (
                  <Button
                    size="default"
                    variant="outline"
                    className="w-full justify-center border-red-500 text-red-200 hover:bg-red-900/40"
                    onClick={() => setShowEndConfirm(true)}
                    disabled={!hasActiveExamine && !isRunEnded}
                  >
                    End practice
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
        </div>
      </Card>
    </>
  );
});
