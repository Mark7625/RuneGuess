"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FaCheckCircle, FaClock, FaHeart, FaQuestionCircle, FaTimesCircle, FaPlay, FaPause, FaMusic } from "react-icons/fa";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import {
  createMusicSession,
  endMusicRun as apiEndMusicRun,
  endMusicRunBeacon,
  openMusicSessionEvents,
  requestMusicHint as apiRequestMusicHint,
  requestNewSong as apiRequestNewSong,
  startMusicLimited as apiStartMusicLimited,
  startMusicTimed as apiStartMusicTimed,
  startMusicPractice as apiStartMusicPractice,
  submitMusicGuess as apiSubmitMusicGuess,
  getMusicSongNames,
  getMusicStreamUrl,
  type GuessTheMusicConfig,
  type MusicQuestionEvent,
} from "@/lib/runeguess-server";
import { usePathname } from "next/navigation";

type MusicGameMode = "limited" | "timed" | "practice";

export type GuessTheMusicGameHandle = { endRun: () => void };

export const GuessTheMusicGame = forwardRef<GuessTheMusicGameHandle, { onGameActiveChange?: (active: boolean) => void }>(
  function GuessTheMusicGame({ onGameActiveChange }, ref) {
  const auth = useAuth();
  const sessionToken = auth?.user?.token ?? null;
  const pathname = usePathname();
  const [musicGameMode, setMusicGameMode] = useState<MusicGameMode>("limited");
  const [hasActiveSong, setHasActiveSong] = useState(false);
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [result, setResult] = useState<"idle" | "correct" | "incorrect">("idle");
  const [remainingHearts, setRemainingHearts] = useState(20);
  const [timedRunning, setTimedRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [timedScore, setTimedScore] = useState(0);
  const [livesScore, setLivesScore] = useState(0);
  const [timedPreCountdown, setTimedPreCountdown] = useState<number | null>(null);
  const [gameInProgress, setGameInProgress] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  
  // Music player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [songDuration, setSongDuration] = useState(30); // Fake duration in seconds
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Song list state - populated from backend
  const [songList, setSongList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hintStage, setHintStage] = useState(0);
  const [hint1Available, setHint1Available] = useState(false);
  const [hint2Available, setHint2Available] = useState(false);
  const [songDetails, setSongDetails] = useState<string | null>(null);
  
  const [gameEndedReason, setGameEndedReason] = useState<"lives" | "time" | null>(null);
  const [gameEndedScore, setGameEndedScore] = useState<number | null>(null);
  const [gameOverAnswer, setGameOverAnswer] = useState<string | null>(null);
  const [lastSkippedSongName, setLastSkippedSongName] = useState<string | null>(null);
  const [runEndedByUser, setRunEndedByUser] = useState(false);
  const [wrongGuessCount, setWrongGuessCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSongName, setCurrentSongName] = useState<string | null>(null);
  const [currentSongLink, setCurrentSongLink] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const currentSongNameRef = useRef<string | null>(null);
  const gameHasEndedRef = useRef(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  sessionIdRef.current = sessionId;
  currentSongNameRef.current = currentSongName;

  const maxLives = 20;
  const isLivesEnded = gameEndedReason === "lives" || (musicGameMode === "limited" && remainingHearts <= 0 && gameInProgress);
  const isTimedEnded = gameEndedReason === "time";
  const isRunEnded = isLivesEnded || isTimedEnded || runEndedByUser;

  const isTimedPrePhase = musicGameMode === "timed" && !isRunEnded && (!gameInProgress || timedPreCountdown !== null);
  const isPreGamePhase = !gameInProgress && !hasActiveSong && !isRunEnded;
  const isLeftBlurred = isPreGamePhase || isTimedPrePhase || isRunEnded;

  // When user closes tab or navigates away, tell server to remove session from active list
  useEffect(() => {
    const onLeave = () => {
      if (sessionIdRef.current) endMusicRunBeacon(sessionIdRef.current);
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, []);

  // When run ends, stop playback immediately (handles ref pointing to previous song if a new one was loading)
  useEffect(() => {
    if (isRunEnded) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      setIsPlaying(false);
    }
  }, [isRunEnded]);

  // Fetch song names when entering the music game tab
  useEffect(() => {
    const isMusicGameTab = pathname === "/guessthemusic";
    if (isMusicGameTab && songList.length === 0 && !gameInProgress) {
      getMusicSongNames().then((names) => {
        if (names && names.length > 0) {
          setSongList(names);
        }
      }).catch(() => {
        // Silently fail if backend is not available
      });
    }
  }, [pathname, songList.length, gameInProgress]);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const formatTimeShort = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Filter songs based on search
  const filteredSongs = songList.filter(song =>
    song.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Initialize audio - recreate when song link changes. Keep previous song playing until new one is ready (no pause on skip).
  useEffect(() => {
    if (hasActiveSong && currentSongLink && !isRunEnded) {
      const previousAudio = audioRef.current;
      const audio = new Audio(currentSongLink);

      const handleCanPlay = () => {
        if (previousAudio && previousAudio !== audio) {
          previousAudio.pause();
          previousAudio.currentTime = 0;
        }
        audioRef.current = audio;
        setIsPlaying(true);
        setSongDuration(audio.duration || 30);
        audio.play().catch(() => {});
      };

      const handleLoadedMetadata = () => {
        setSongDuration(audio.duration || 30);
      };

      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (hasActiveSong && gameInProgress) {
          audio.play().catch(() => {});
        }
      };

      audio.addEventListener("canplay", handleCanPlay);
      audio.addEventListener("loadedmetadata", handleLoadedMetadata);
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", handleEnded);

      return () => {
        audio.removeEventListener("canplay", handleCanPlay);
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", handleEnded);
        audio.pause();
        if (audioRef.current === audio) audioRef.current = null;
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [hasActiveSong, currentSongLink, gameInProgress, isRunEnded]);

  // Auto-play when song starts
  useEffect(() => {
    if (hasActiveSong && audioRef.current && !isLeftBlurred) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else if (audioRef.current && (isLeftBlurred || !hasActiveSong)) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [hasActiveSong, isLeftBlurred]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const resetLimitedRun = useCallback(() => {
    // Clear any intervals
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    setRemainingHearts(maxLives);
    setLivesScore(0);
    setResult("idle");
    setSelectedSong(null);
    setHasActiveSong(false);
    setGameInProgress(false);
    setGameEndedReason(null);
    setGameEndedScore(null);
    setRunEndedByUser(false);
    setGameOverAnswer(null);
    setLastSkippedSongName(null);
    setSongList([]);
    setHintStage(0);
    setHint1Available(false);
    setHint2Available(false);
    setSongDetails(null);
    setWrongGuessCount(0);
    setSkippedCount(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setSearchQuery("");
    setTimedRunning(false);
    setTimedPreCountdown(null);
    setCurrentSongName(null);
    setCurrentSongLink(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (sessionId) {
      apiEndMusicRun(sessionId);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSessionId(null);
      onGameActiveChange?.(false);
    }
  }, [maxLives, sessionId, onGameActiveChange]);

  const resetTimedRun = useCallback(() => {
    // Clear any intervals
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    setTimedScore(0);
    setTimeLeft(600);
    setTimedRunning(false);
    setResult("idle");
    setSelectedSong(null);
    setTimedPreCountdown(null);
    setGameInProgress(false);
    setGameEndedReason(null);
    setGameEndedScore(null);
    setRunEndedByUser(false);
    setGameOverAnswer(null);
    setHasActiveSong(false);
    setSongList([]);
    setHintStage(0);
    setHint1Available(false);
    setHint2Available(false);
    setSongDetails(null);
    setWrongGuessCount(0);
    setSkippedCount(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setSearchQuery("");
    setCurrentSongName(null);
    setCurrentSongLink(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (sessionId) {
      apiEndMusicRun(sessionId);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSessionId(null);
      onGameActiveChange?.(false);
    }
  }, [sessionId, onGameActiveChange]);

  const resetPracticeRun = useCallback(() => {
    // Clear any intervals
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    setLivesScore(0);
    setResult("idle");
    setSelectedSong(null);
    setHasActiveSong(false);
    setGameInProgress(false);
    setGameEndedReason(null);
    setGameEndedScore(null);
    setRunEndedByUser(false);
    setGameOverAnswer(null);
    setLastSkippedSongName(null);
    setSongList([]);
    setHintStage(0);
    setHint1Available(false);
    setHint2Available(false);
    setSongDetails(null);
    setWrongGuessCount(0);
    setSkippedCount(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setSearchQuery("");
    setTimedRunning(false);
    setTimedPreCountdown(null);
    setCurrentSongName(null);
    setCurrentSongLink(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (sessionId) {
      apiEndMusicRun(sessionId);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSessionId(null);
      onGameActiveChange?.(false);
    }
  }, [sessionId, onGameActiveChange]);

  const getServerConfig = useCallback((): GuessTheMusicConfig => ({
    mode: musicGameMode,
  }), [musicGameMode]);

  const startLimitedWithServer = useCallback(async () => {
    setServerError(null);
    const config = getServerConfig();
    if (config.mode !== "limited") return;
    const oldSid = sessionId;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (oldSid) {
      apiEndMusicRun(oldSid);
    }
    setSessionId(null);
    setGameEndedReason(null);
    setGameEndedScore(null);
    setRunEndedByUser(false);
    gameHasEndedRef.current = false;
    setRemainingHearts(maxLives);
    const res = await createMusicSession(config, sessionToken);
    if (!res) {
      setServerError(
        "Cannot reach game server. Set NEXT_PUBLIC_RUNEGUESS_SERVER_URL (e.g. http://localhost:8081) in .env.local and ensure the backend is running."
      );
      return;
    }
    const sid = res.sessionId;
    const es = openMusicSessionEvents(sid, {
      onQuestion: (d: MusicQuestionEvent) => {
        if (gameHasEndedRef.current) return;
        const isHintUpdate = currentSongNameRef.current === d.songName;
        setCurrentSongName(d.songName);
        if (!isHintUpdate) setCurrentSongLink(getMusicStreamUrl(sid, Date.now()));
        setSongList(d.allSongs);
        setHintStage(d.hintStage ?? 0);
        setSongDetails(d.unlockDetails ?? null);
        setResult("idle");
        setHasActiveSong(true);
      },
      onGuessResult: (d) => {
        setResult(d.correct ? "correct" : "incorrect");
        if (d.correct) setLastSkippedSongName(null);
        setTimedScore(d.score);
        setLivesScore(d.score);
        if (d.lives != null) {
          setRemainingHearts(d.lives);
          if (d.lives <= 0) {
            setGameEndedReason("lives");
            setGameEndedScore(d.score);
          }
        }
        if (d.hintStage != null) setHintStage(d.hintStage);
        if (d.hint1Available != null) setHint1Available(d.hint1Available);
        if (d.hint2Available != null) setHint2Available(d.hint2Available);
        if (!d.correct) setWrongGuessCount((c) => c + 1);
      },
      onGameEnded: (d) => {
        gameHasEndedRef.current = true;
        setGameOverAnswer(currentSongNameRef.current ?? null);
        setGameEndedReason(d.reason);
        setGameEndedScore(d.finalScore);
        if (d.wrongGuessCount != null) setWrongGuessCount(d.wrongGuessCount);
        if (d.skippedCount != null) setSkippedCount(d.skippedCount);
        setHasActiveSong(false);
        setCurrentSongLink(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setSessionId(null);
        onGameActiveChange?.(false);
      },
      onRunEnded: (d) => {
        gameHasEndedRef.current = true;
        setGameOverAnswer(currentSongNameRef.current ?? null);
        setGameEndedScore(d.score);
        setRunEndedByUser(true);
        setHasActiveSong(false);
        setCurrentSongLink(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
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
    setHasActiveSong(false);
    setResult("idle");
    setCurrentSongName(null);
    setCurrentSongLink(null);
    setGameOverAnswer(null);
    setLastSkippedSongName(null);
    setLivesScore(0);
    setRemainingHearts(maxLives);
    setWrongGuessCount(0);
    setSkippedCount(0);
    setHint1Available(false);
    setHint2Available(false);
    await apiStartMusicLimited(sid);
  }, [getServerConfig, sessionId, maxLives, sessionToken, onGameActiveChange]);

  const startTimedWithServer = useCallback(async () => {
    setServerError(null);
    const config = getServerConfig();
    if (config.mode !== "timed") return;
    const oldSid = sessionId;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (oldSid) {
      apiEndMusicRun(oldSid);
    }
    setSessionId(null);
    setGameEndedReason(null);
    setGameEndedScore(null);
    setRunEndedByUser(false);
    gameHasEndedRef.current = false;
    const res = await createMusicSession(config, sessionToken);
    if (!res) {
      setServerError(
        "Cannot reach game server. Set NEXT_PUBLIC_RUNEGUESS_SERVER_URL (e.g. http://localhost:8081) in .env.local and ensure the backend is running."
      );
      return;
    }
    const sid = res.sessionId;
    const es = openMusicSessionEvents(sid, {
      onQuestion: (d: MusicQuestionEvent) => {
        const isHintUpdate = currentSongNameRef.current === d.songName;
        setCurrentSongName(d.songName);
        if (!isHintUpdate) setCurrentSongLink(getMusicStreamUrl(sid, Date.now()));
        setSongList(d.allSongs);
        setHintStage(d.hintStage ?? 0);
        setSongDetails(d.unlockDetails ?? null);
        setResult("idle");
        setTimedPreCountdown(null);
        setTimedRunning(true);
        setHasActiveSong(true);
      },
      onTimer: (d) => setTimeLeft(d.secondsLeft),
      onGuessResult: (d) => {
        setResult(d.correct ? "correct" : "incorrect");
        if (d.correct) setLastSkippedSongName(null);
        setTimedScore(d.score);
        if (d.lives != null) setRemainingHearts(d.lives);
        if (d.hintStage != null) setHintStage(d.hintStage);
        if (d.hint1Available != null) setHint1Available(d.hint1Available);
        if (d.hint2Available != null) setHint2Available(d.hint2Available);
        if (!d.correct) setWrongGuessCount((c) => c + 1);
      },
      onGameEnded: (d) => {
        gameHasEndedRef.current = true;
        setGameOverAnswer(currentSongNameRef.current ?? null);
        setGameEndedReason(d.reason);
        setGameEndedScore(d.finalScore);
        if (d.wrongGuessCount != null) setWrongGuessCount(d.wrongGuessCount);
        if (d.skippedCount != null) setSkippedCount(d.skippedCount);
        setTimedRunning(false);
        setHasActiveSong(false);
        setCurrentSongLink(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
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
        setHasActiveSong(false);
        setCurrentSongLink(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
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
    setCurrentSongName(null);
    setCurrentSongLink(null);
    setGameOverAnswer(null);
    setLastSkippedSongName(null);
    setTimedScore(0);
    setTimeLeft(600);
    setTimedRunning(false);
    setWrongGuessCount(0);
    setSkippedCount(0);
    setHint1Available(false);
    setHint2Available(false);
    await apiStartMusicTimed(sid);
  }, [getServerConfig, sessionId, sessionToken, onGameActiveChange]);

  const startPracticeWithServer = useCallback(async () => {
    setServerError(null);
    const config = getServerConfig();
    if (config.mode !== "practice") return;
    const oldSid = sessionId;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (oldSid) {
      apiEndMusicRun(oldSid);
    }
    setSessionId(null);
    setGameEndedReason(null);
    setGameEndedScore(null);
    setRunEndedByUser(false);
    gameHasEndedRef.current = false;
    const res = await createMusicSession(config, sessionToken);
    if (!res) {
      setServerError(
        "Cannot reach game server. Set NEXT_PUBLIC_RUNEGUESS_SERVER_URL (e.g. http://localhost:8081) in .env.local and ensure the backend is running."
      );
      return;
    }
    const sid = res.sessionId;
    const es = openMusicSessionEvents(sid, {
      onQuestion: (d: MusicQuestionEvent) => {
        if (gameHasEndedRef.current) return;
        const isHintUpdate = currentSongNameRef.current === d.songName;
        setCurrentSongName(d.songName);
        if (!isHintUpdate) setCurrentSongLink(getMusicStreamUrl(sid, Date.now()));
        setSongList(d.allSongs);
        setHintStage(d.hintStage ?? 0);
        setSongDetails(d.unlockDetails ?? null);
        setResult("idle");
        setHasActiveSong(true);
      },
      onGuessResult: (d) => {
        setResult(d.correct ? "correct" : "incorrect");
        if (d.correct) setLastSkippedSongName(null);
        setTimedScore(d.score);
        setLivesScore(d.score);
        if (d.hintStage != null) setHintStage(d.hintStage);
        if (d.hint1Available != null) setHint1Available(d.hint1Available);
        if (d.hint2Available != null) setHint2Available(d.hint2Available);
        if (!d.correct) setWrongGuessCount((c) => c + 1);
      },
      onGameEnded: (d) => {
        gameHasEndedRef.current = true;
        setGameOverAnswer(currentSongNameRef.current ?? null);
        setGameEndedReason(d.reason);
        setGameEndedScore(d.finalScore);
        if (d.wrongGuessCount != null) setWrongGuessCount(d.wrongGuessCount);
        if (d.skippedCount != null) setSkippedCount(d.skippedCount);
        setHasActiveSong(false);
        setCurrentSongLink(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setSessionId(null);
        onGameActiveChange?.(false);
      },
      onRunEnded: (d) => {
        gameHasEndedRef.current = true;
        setGameOverAnswer(currentSongNameRef.current ?? null);
        setGameEndedScore(d.score);
        setRunEndedByUser(true);
        setHasActiveSong(false);
        setCurrentSongLink(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
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
    setHasActiveSong(false);
    setResult("idle");
    setCurrentSongName(null);
    setCurrentSongLink(null);
    setGameOverAnswer(null);
    setLastSkippedSongName(null);
    setLivesScore(0);
    setWrongGuessCount(0);
    setSkippedCount(0);
    setHint1Available(false);
    setHint2Available(false);
    await apiStartMusicPractice(sid);
  }, [getServerConfig, sessionId, sessionToken, onGameActiveChange]);

  const endRunAndNotify = useCallback(() => {
    const sid = sessionIdRef.current;
    if (sid) {
      apiEndMusicRun(sid);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSessionId(null);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setGameInProgress(false);
    setHasActiveSong(false);
    setIsPlaying(false);
    onGameActiveChange?.(false);
  }, [onGameActiveChange]);

  useImperativeHandle(ref, () => ({ endRun: endRunAndNotify }), [endRunAndNotify]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const handleRequestHint = async () => {
    if (sessionId) {
      await apiRequestMusicHint(sessionId);
    }
  };

  const handleSongSelect = (song: string) => {
    setSelectedSong(song);
  };

  const handleConfirmGuess = async () => {
    if (!selectedSong || !sessionId) return;
    const res = await apiSubmitMusicGuess(sessionId, selectedSong);
    if (res) {
      setResult(res.correct ? "correct" : "incorrect");
      setSelectedSong(null);
    }
  };

  const handleSkip = async () => {
    if (sessionId) {
      setLastSkippedSongName(currentSongNameRef.current ?? currentSongName);
      setSkippedCount((prev) => prev + 1);
      await apiRequestNewSong(sessionId);
      setSelectedSong(null);
      setResult("idle");
    }
  };

  const handleEndRun = () => {
    endRunAndNotify();
    setShowEndConfirm(false);
    setRunEndedByUser(true);
  };

  return (
    <>
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {musicGameMode === "limited" ? "Reset current run?" : musicGameMode === "practice" ? "End practice session?" : "End current run?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {musicGameMode === "limited" ? (
                <>
                  This will reset your current{" "}
                  <span className="font-semibold text-amber-200">lives run</span>, restoring all
                  lives and clearing your progress on this run.
                </>
              ) : musicGameMode === "practice" ? (
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
              {musicGameMode === "limited" ? "Reset run" : musicGameMode === "practice" ? "End practice" : "End run"}
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
      <Card className="h-[700px] flex flex-col overflow-hidden bg-black/60">
        {/* Top mode strip */}
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-black/85 via-zinc-900/80 to-black/85 px-4 py-2 shrink-0">
          <div className="w-[120px]"></div>
          <h2 className="text-sm font-semibold text-yellow-200 uppercase tracking-[0.2em]">
            Guess The Music{musicGameMode === "limited" ? " - Lives mode" : musicGameMode === "timed" ? " - Timed mode" : " - Practice mode"}
          </h2>
          <div className="w-[120px]"></div>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] p-5 md:p-6 flex-1 min-h-0 overflow-hidden">
          {/* Left: Music player & song list OR Game ended message */}
          <div className={`relative flex flex-col h-full border-b border-border pb-4 md:border-b-0 md:border-r md:pr-5 min-h-0 ${
            isLeftBlurred ? "blur-sm pointer-events-none select-none" : ""
          }`}>
            <div
              className={`space-y-4 ${
                isLeftBlurred ? "blur-sm pointer-events-none select-none" : ""
              }`}
            >
              {/* Hint button and badges */}
              <div className="flex items-center justify-between gap-2">
                {/* Hint button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-7 px-6 text-xs whitespace-nowrap ${
                            ((hint1Available && hintStage < 1) || (hint2Available && hintStage < 2))
                              ? "bg-sky-600 border-sky-500 text-white hover:bg-sky-500"
                              : "border-sky-500 text-sky-200 hover:bg-sky-900/40"
                          } ${isLeftBlurred ? "blur-sm pointer-events-none select-none" : ""}`}
                          onClick={handleRequestHint}
                          disabled={
                            !((hint1Available && hintStage < 1) || (hint2Available && hintStage < 2)) ||
                            (musicGameMode === "limited" && remainingHearts <= 0) ||
                            (musicGameMode === "timed" && (timeLeft <= 0 || !timedRunning || timedPreCountdown !== null)) ||
                            isLeftBlurred
                          }
                        >
                          Get Hint ({hintStage}/2)
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {hintStage >= 2 ? (
                        "Both hints used for this song."
                      ) : (hint1Available && hintStage < 1) || (hint2Available && hintStage < 2) ? (
                        "Click to use the next available hint."
                      ) : (
                        `Unlock next hint with ${hintStage === 0 ? "1" : "2"} wrong guess${hintStage === 0 ? "" : "es"}`
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Badges */}
                {musicGameMode === "timed" ? (
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
                      <span className="uppercase tracking-[0.18em] text-emerald-300/90 mr-1">Score</span>
                      <span className="font-mono text-xs">{timedScore}</span>
                    </Badge>
                  </div>
                ) : musicGameMode === "practice" ? (
                  <Badge variant="outline" className="rounded-full border-emerald-500 bg-emerald-900/60 text-[11px] font-semibold text-emerald-100">
                    <span className="uppercase tracking-[0.18em] text-emerald-300/90 mr-1">Score</span>
                    <span className="font-mono text-xs">{livesScore}</span>
                  </Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs rounded-full bg-black/40 border-amber-500 text-amber-200">
                      <FaHeart className="h-3 w-3 mr-1 text-red-300" aria-hidden="true" />
                      <span className="uppercase tracking-[0.18em] text-amber-300/90 mr-1">Lives</span>
                      <span className="font-mono text-xs">{remainingHearts}</span>
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-amber-400 bg-amber-900/60 text-[11px] font-semibold text-amber-100">
                      <span className="uppercase tracking-[0.18em] text-amber-300/90 mr-1">Score</span>
                      <span className="font-mono text-xs">{livesScore}</span>
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <div className={`flex flex-col flex-1 min-h-0 ${
              isLeftBlurred ? "blur-sm pointer-events-none select-none" : ""
            }`}>
                {/* Music Player */}
                <Card className="bg-gradient-to-br from-stone-900/95 via-stone-950 to-stone-900 border-yellow-900/50 mt-4 shrink-0">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-12 w-12 rounded-full border-amber-500/60 bg-black/60 opacity-50 cursor-not-allowed"
                        disabled={true}
                      >
                        <FaPause className="h-5 w-5 text-amber-200/50" />
                      </Button>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-amber-200">
                            {hasActiveSong ? "Now Playing" : "No song playing"}
                          </span>
                          <span className="text-xs text-amber-200/70 font-mono">
                            {formatTimeShort(currentTime)} / {formatTimeShort(songDuration)}
                          </span>
                        </div>
                        <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
                            style={{ width: `${(currentTime / songDuration) * 100}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1 text-xs text-amber-200/60">
                          <span>Time remaining: {formatTimeShort(Math.max(0, songDuration - currentTime))}</span>
                          <span>{Math.round(((songDuration - currentTime) / songDuration) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Song List */}
                <Card className="bg-gradient-to-br from-stone-900/95 via-stone-950 to-stone-900 border-yellow-900/50 flex-1 min-h-0 flex flex-col mt-4">
                  <CardContent className="p-4 flex flex-col flex-1 min-h-0">
                    <div className="mb-3 shrink-0">
                      <Input
                        placeholder="Search songs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-black/60 border-amber-500/60 text-amber-100 placeholder:text-amber-200/50"
                      />
                    </div>
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="space-y-1 pr-4">
                        {filteredSongs.map((song) => (
                          <button
                            key={song}
                            onClick={() => handleSongSelect(song)}
                            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                              selectedSong === song
                                ? "bg-amber-600/40 border border-amber-500/60 text-amber-100"
                                : "bg-black/40 hover:bg-black/60 text-amber-200/80 hover:text-amber-100"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <FaMusic className="h-3 w-3 text-amber-400/60" />
                              <span className="text-sm">{song}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="mt-2 text-xs text-amber-200/60 shrink-0">
                      {filteredSongs.length} song{filteredSongs.length !== 1 ? "s" : ""} found
                    </div>
                  </CardContent>
                </Card>
            </div>
          </div>

          {/* Right: Feedback & controls */}
          <div className="flex flex-col space-y-4">
            {/* Feedback card */}
            {(gameInProgress || isRunEnded) && (
              <Card
                className={`min-h-[280px] bg-black/60 relative overflow-hidden ${
                  result === "correct"
                    ? "border-emerald-600"
                    : result === "incorrect"
                      ? "border-red-700"
                      : "border-yellow-900/70"
                }`}
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
                      {gameOverAnswer && (
                        <p className="text-sm text-amber-200">
                          The song was: <span className="font-semibold text-amber-100">{gameOverAnswer}</span>
                        </p>
                      )}
                      <div className="flex flex-col gap-1.5 text-sm text-amber-100">
                        <p>
                          Score:{" "}
                          <span className="font-semibold text-amber-200">
                            {gameEndedScore ?? (musicGameMode === "limited" ? livesScore : timedScore)}
                          </span>
                        </p>
                        {musicGameMode === "limited" && (
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
                        {musicGameMode === "timed" && (
                          <>
                            {isTimedEnded && (
                              <p className="text-xs text-emerald-100">
                                You correctly guessed{" "}
                                <span className="font-semibold text-emerald-200">
                                  {gameEndedScore ?? timedScore}
                                </span>{" "}
                                songs.
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
                          <p className="text-xs text-amber-100">You ended the run.</p>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Use <span className="font-semibold">Start run</span> below to play again.
                      </p>
                    </div>
                  </>
                ) : gameInProgress && hasActiveSong ? (
                  <>
                    {result === "correct" && (
                      <>
                        <div className="pointer-events-none absolute -top-6 left-4 h-10 w-10 rounded-full border border-amber-400/40 animate-ping" />
                        <div className="pointer-events-none absolute -top-4 right-6 h-10 w-10 rounded-full border border-amber-300/30 animate-ping" />
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
                            Correct! Select your next guess from the list.
                          </p>
                        )}
                        {result === "incorrect" && (
                          <p className="font-semibold text-red-200">
                            Not quite. Try another song or skip to the next one.
                          </p>
                        )}
                        {result === "idle" && !lastSkippedSongName && (
                          <p className="text-amber-200/90">
                            Select a song from the list and confirm your guess.
                          </p>
                        )}
                        {lastSkippedSongName && (
                          <p className="text-sm text-amber-200">
                            The song was: <span className="font-semibold text-amber-100">{lastSkippedSongName}</span>
                          </p>
                        )}
                      </div>

                      {/* Hint details */}
                      <div className="text-xs text-amber-100 max-w-md pb-1 space-y-1">
                        {hintStage >= 1 && songDetails && (
                          <p className="text-amber-100">
                            <span className="font-semibold">Hint 1:</span> {songDetails}
                          </p>
                        )}
                        {hintStage >= 2 && (
                          <p className="text-amber-100">
                            <span className="font-semibold">Hint 2:</span> Song list reduced to {songList.length} options.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
                </CardContent>
              </Card>
            )}

            {/* Selected song display — always show; placeholder when none selected */}
            <Card className="bg-gradient-to-br from-amber-950/40 via-amber-900/30 to-amber-950/40 border-amber-800/50">
              <CardContent className="p-3">
                <p className="text-xs text-amber-200/80 mb-1">Selected:</p>
                <p className={`text-sm font-semibold ${selectedSong ? "text-amber-200" : "text-amber-200/50 italic"}`}>
                  {selectedSong ?? "Select a song"}
                </p>
              </CardContent>
            </Card>

            {/* Game controls */}
            {!gameInProgress || isRunEnded ? (
              <>
                {/* Pre-game: Settings */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-yellow-300/90">Mode</span>
                      <div className="inline-flex gap-1 rounded-md border border-border bg-black/40 p-0.5">
                        <Button
                          size="sm"
                          variant={musicGameMode === "limited" ? "secondary" : "ghost"}
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            setMusicGameMode("limited");
                            resetLimitedRun();
                          }}
                        >
                          Lives mode
                        </Button>
                        <Button
                          size="sm"
                          variant={musicGameMode === "timed" ? "secondary" : "ghost"}
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            setMusicGameMode("timed");
                            resetTimedRun();
                          }}
                        >
                          Timed (10:00)
                        </Button>
                        <Button
                          size="sm"
                          variant={musicGameMode === "practice" ? "secondary" : "ghost"}
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            setMusicGameMode("practice");
                            resetPracticeRun();
                          }}
                        >
                          Practice
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Game mode explanation */}
                  <Card className="bg-gradient-to-br from-amber-950/40 via-amber-900/30 to-amber-950/40 border-amber-800/50 min-h-[200px]">
                    <CardContent className="p-4 space-y-2">
                      <h3 className="text-sm font-semibold text-amber-200 uppercase tracking-wide">
                        {musicGameMode === "limited" ? "Lives Mode" : musicGameMode === "timed" ? "Timed Mode" : "Practice Mode"}
                      </h3>
                      {musicGameMode === "limited" ? (
                        <div className="text-xs text-amber-100/90 space-y-1.5">
                          <p>
                            Start with <span className="font-semibold text-amber-200">20 lives</span>. Each correct guess automatically loads the next song.
                          </p>
                          <p>
                            Wrong guesses reduce your lives. You can skip a song, but it costs 1 life. The run ends when you run out of lives.
                          </p>
                        </div>
                      ) : musicGameMode === "practice" ? (
                        <div className="text-xs text-amber-100/90 space-y-1.5">
                          <p>
                            Practice mode lets you guess songs without limits. See how many you can get!
                          </p>
                          <p>
                            No lives limit, no time limit. Each correct guess loads the next song. Wrong guesses don't end the run.
                          </p>
                          <p className="text-amber-200/80 pt-1">
                            <span className="font-semibold">Note:</span> Practice mode scores are not tracked on leaderboards.
                          </p>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-100/90 space-y-1.5">
                          <p>
                            You have <span className="font-semibold text-amber-200">10 minutes</span> to correctly guess as many songs as possible.
                          </p>
                          <p>
                            Each correct guess increases your score. Wrong guesses don't end the run, but they don't add points. You can skip a song, but it costs <span className="font-semibold text-amber-200">30 seconds</span>. The run ends when time runs out.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Start button */}
                  <div className="space-y-2 pt-1">
                    {musicGameMode === "limited" && (
                      <Button
                        size="default"
                        variant="secondary"
                        className="w-full justify-center bg-sky-700 hover:bg-sky-600 text-sky-50"
                        onClick={startLimitedWithServer}
                      >
                        Start run
                      </Button>
                    )}
                    {musicGameMode === "timed" && (
                      <Button
                        size="default"
                        variant="secondary"
                        className="w-full justify-center bg-sky-700 hover:bg-sky-600 text-sky-50"
                        onClick={startTimedWithServer}
                      >
                        Start timed run
                      </Button>
                    )}
                    {musicGameMode === "practice" && (
                      <Button
                        size="default"
                        variant="secondary"
                        className="w-full justify-center bg-sky-700 hover:bg-sky-600 text-sky-50"
                        onClick={startPracticeWithServer}
                      >
                        Start practice
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* During game: Confirm guess and controls */}
                <div className="space-y-2">
                  <Button
                    size="default"
                    className="w-full justify-center"
                    onClick={handleConfirmGuess}
                    disabled={
                      !selectedSong ||
                      (musicGameMode === "limited" && (!hasActiveSong || remainingHearts <= 0)) ||
                      (musicGameMode === "timed" && (timeLeft <= 0 || !timedRunning || timedPreCountdown !== null)) ||
                      (musicGameMode === "practice" && !hasActiveSong)
                    }
                  >
                    Confirm Guess
                  </Button>
                  {musicGameMode === "limited" && hasActiveSong && remainingHearts > 0 && (
                    <Button
                      size="default"
                      variant="outline"
                      className="w-full justify-center border-amber-500 text-amber-200 hover:bg-amber-900/40"
                      onClick={handleSkip}
                    >
                      Skip (lose 1 life)
                    </Button>
                  )}
                  {musicGameMode === "practice" && hasActiveSong && (
                    <Button
                      size="default"
                      variant="outline"
                      className="w-full justify-center border-amber-500 text-amber-200 hover:bg-amber-900/40"
                      onClick={handleSkip}
                    >
                      Skip
                    </Button>
                  )}
                  {musicGameMode === "timed" && hasActiveSong && timedRunning && timeLeft > 0 && timedPreCountdown === null && (
                    <Button
                      size="default"
                      variant="outline"
                      className="w-full justify-center border-amber-500 text-amber-200 hover:bg-amber-900/40"
                      onClick={handleSkip}
                    >
                      Skip (-30s)
                    </Button>
                  )}
                  {musicGameMode === "limited" && (
                    <Button
                      size="default"
                      variant="outline"
                      className="w-full justify-center border-red-500 text-red-200 hover:bg-red-900/40"
                      onClick={() => setShowEndConfirm(true)}
                      disabled={!hasActiveSong && !isRunEnded}
                    >
                      Reset run
                    </Button>
                  )}
                  {musicGameMode === "timed" && (
                    <Button
                      size="default"
                      className="w-full justify-center bg-red-700 hover:bg-red-600 text-red-50"
                      onClick={() => setShowEndConfirm(true)}
                      disabled={!gameInProgress}
                    >
                      End run
                    </Button>
                  )}
                  {musicGameMode === "practice" && (
                    <Button
                      size="default"
                      variant="outline"
                      className="w-full justify-center border-red-500 text-red-200 hover:bg-red-900/40"
                      onClick={() => setShowEndConfirm(true)}
                      disabled={!hasActiveSong && !isRunEnded}
                    >
                      End practice
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {musicGameMode === "timed" && timedPreCountdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="text-6xl md:text-7xl font-black text-sky-300 animate-bounce drop-shadow-[0_0_18px_rgba(56,189,248,0.9)]">
              {timedPreCountdown}
            </div>
          </div>
        )}
      </Card>
    </>
  );
});
