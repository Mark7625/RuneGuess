/**
 * RuneGuess backend client.
 * Set NEXT_PUBLIC_RUNEGUESS_SERVER_URL in .env (e.g. http://localhost:8081).
 *
 * Adding a new game: add game type + path in lib/game-types.ts (and server GameTypes.kt),
 * then add start/events/actions API here and a game component that uses them.
 */

import { GAME_TYPE_GUESS_THE_EXAMINE, PATH_GUESS_THE_EXAMINE } from "./game-types";

// ---- Auth ----

export type AuthUser = {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  pictureUrl: string | null;
  token: string;
};

/** GET /api/auth/google/url → { url } */
export async function getGoogleLoginUrl(): Promise<string | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    const res = await fetch(apiUrl("/api/auth/google/url"));
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}

/** GET /api/auth/me with Bearer token */
export async function getMe(token: string): Promise<AuthUser | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}

/** POST /api/auth/logout (optional; client should clear token after) */
export async function logoutApi(token: string): Promise<void> {
  const base = getBaseUrl();
  if (!base) return;
  try {
    await fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // ignore
  }
}

/** PATCH /api/auth/username */
export async function setUsernameApi(
  token: string,
  username: string
): Promise<{ username: string; id: string } | { error: string }> {
  const base = getBaseUrl();
  if (!base) return { error: "Server not configured" };
  try {
    const res = await fetch(apiUrl("/api/auth/username"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) return { error: (data as { error?: string }).error ?? "Failed" };
    return data as { username: string; id: string };
  } catch {
    return { error: "Request failed" };
  }
}

// ---- Player stats & game logs ----

export type PlayerGameStat = {
  gameType: string;
  mode: string;
  gamesPlayed: number;
  questionsSeen: number;
  questionsCorrect: number;
  questionsWrong: number;
  lastPlayedAt: string; // ISO
};

export type GameSessionLogEntry = {
  sessionId: string;
  gameType: string;
  mode: string;
  settings: Record<string, string>;
  resultScore: number;
  resultQuestionsSeen: number;
  resultQuestionsCorrect: number;
  resultQuestionsWrong: number;
  playedAt: string; // ISO
};

/** GET /api/me/stats — optional gameType, mode query */
export async function getMyStats(
  token: string,
  options?: { gameType?: string; mode?: string }
): Promise<{ stats: PlayerGameStat[] } | null> {
  const base = getBaseUrl();
  if (!base) return null;
  const params = new URLSearchParams();
  if (options?.gameType) params.set("gameType", options.gameType);
  if (options?.mode) params.set("mode", options.mode);
  const q = params.toString();
  try {
    const res = await fetch(apiUrl(`/api/me/stats${q ? `?${q}` : ""}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as { stats: PlayerGameStat[] };
  } catch {
    return null;
  }
}

/** GET /api/me/game-logs — optional gameType, limit (default 50, max 100) */
export async function getMyGameLogs(
  token: string,
  options?: { gameType?: string; limit?: number }
): Promise<{ logs: GameSessionLogEntry[] } | null> {
  const base = getBaseUrl();
  if (!base) return null;
  const params = new URLSearchParams();
  if (options?.gameType) params.set("gameType", options.gameType);
  if (options?.limit != null) params.set("limit", String(Math.min(100, Math.max(1, options.limit))));
  const q = params.toString();
  try {
    const res = await fetch(apiUrl(`/api/me/game-logs${q ? `?${q}` : ""}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as { logs: GameSessionLogEntry[] };
  } catch {
    return null;
  }
}

// ---- Global highscores (public) ----

export type GlobalHighscoreAggregate = {
  gameType: string;
  mode: string;
  totalGamesPlayed: number;
  totalTimePlayedMs: number;
  updatedAt: number;
};

export type GlobalTopScoreEntry = {
  userId: string;
  username: string | null;
  pictureUrl: string | null;
  score: number;
  playedAt: number;
};

export type GlobalGamesPlayedEntry = {
  userId: string;
  username: string | null;
  pictureUrl: string | null;
  gamesPlayed: number;
  lastPlayedAt: number;
};


export type GlobalHighscoresResponse = {
  aggregates: GlobalHighscoreAggregate[];
  topScores: Record<string, GlobalTopScoreEntry[]>;
};

/** GET /api/highscores/global — no auth. Query: gameType, mode (optional), variant (optional), topLimit (default 50). */
export async function getGlobalHighscores(options?: {
  gameType?: string;
  mode?: string;
  variant?: string;
  topLimit?: number;
}): Promise<GlobalHighscoresResponse | null> {
  const base = getBaseUrl();
  if (!base) return null;
  const params = new URLSearchParams();
  if (options?.gameType) params.set("gameType", options.gameType);
  if (options?.mode) params.set("mode", options.mode);
  if (options?.variant) params.set("variant", options.variant);
  if (options?.topLimit != null) params.set("topLimit", String(Math.min(100, Math.max(1, options.topLimit))));
  const q = params.toString();
  try {
    const res = await fetch(apiUrl(`/api/highscores/global${q ? `?${q}` : ""}`));
    if (!res.ok) return null;
    return (await res.json()) as GlobalHighscoresResponse;
  } catch {
    return null;
  }
}

/** GET /api/highscores/games-played — no auth. Query: gameType, mode (required), variant (optional), topLimit (default 50). */
export async function getGamesPlayedHighscores(options: {
  gameType: string;
  mode: string;
  variant?: string;
  topLimit?: number;
}): Promise<GlobalGamesPlayedEntry[] | null> {
  const base = getBaseUrl();
  if (!base) return null;
  const params = new URLSearchParams();
  params.set("gameType", options.gameType);
  params.set("mode", options.mode);
  if (options.variant) params.set("variant", options.variant);
  if (options.topLimit != null) params.set("topLimit", String(Math.min(100, Math.max(1, options.topLimit))));
  try {
    const url = apiUrl(`/api/highscores/games-played?${params.toString()}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`getGamesPlayedHighscores failed: ${res.status} ${res.statusText}`, url);
      return null;
    }
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch (err) {
    console.error("getGamesPlayedHighscores error:", err);
    return null;
  }
}


// ---- Game ----

export type ExamineGameMode = "limited" | "timed" | "practice";
export type ExamineDifficulty = "easy" | "hard";
export type ExamineCategoryFilter = "items" | "npcs" | "objects";

export type GuessTheExamineConfig = {
  mode: ExamineGameMode;
  difficulty: ExamineDifficulty;
  easyCategory: ExamineCategoryFilter;
};

export type StartSessionResponse = {
  sessionId: string;
  gameType: string;
  config: GuessTheExamineConfig;
};

export type QuestionEvent = {
  maskedExamine: string;
  category: string;
  hintStage: number;
  hintImageUrl?: string | null; // Deprecated - use hintImageData instead
  hintImageData?: string | null; // Base64 encoded image data (data:image/png;base64,...)
};

export type TimerEvent = {
  secondsLeft: number;
};

export type GuessResultEvent = {
  correct: boolean;
  score: number;
  lives?: number;
  hintStage?: number;
  hint1Available?: boolean;
  hint2Available?: boolean;
};

export type GameEndedEvent = {
  reason: "lives" | "time";
  finalScore: number;
  wrongGuessCount?: number;
  skippedCount?: number;
};

export type PreCountdownEvent = {
  seconds: number;
};

export type RunEndedEvent = {
  score: number;
};

const DEFAULT_DEV_SERVER = "http://localhost:8081";

function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_RUNEGUESS_SERVER_URL ?? "";
  if (env) return env;
  if (typeof window !== "undefined" && window.location?.hostname === "localhost") {
    return DEFAULT_DEV_SERVER;
  }
  return "";
}

function apiUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

// ---- Admin (game health – allowed Google IDs only) ----

export type AdminCheckResponse = { allowed: boolean };
export type AdminSessionInfo = { sessionId: string; userId: string; username: string; mode?: string; category?: string | null };
export type ActiveByMode = { mode: string; count: number };
export type PracticeCategoryStats = { category: string; count: number };
export type AdminSessionsResponse = {
  sessions: AdminSessionInfo[];
  sessionIds: string[];
  count: number;
  activeByMode?: ActiveByMode[];
  practiceCategoryStats?: PracticeCategoryStats[];
};
export type GameModeMetrics = {
  gameType: string;
  mode: string;
  gamesStarted: number;
  gamesCompleted: number;
  timePlayedSeconds: number;
  updatedAt: number;
};
export type DailyGameModeMetrics = {
  date: string;
  gameType: string;
  mode: string;
  gamesStarted: number;
  gamesCompleted: number;
  timePlayedSeconds: number;
  updatedAt: number;
};
export type AdminMetricsGlobal = {
  totalGamesStarted: number;
  totalGamesStartedLoggedIn: number;
  totalGamesStartedGuest: number;
  totalGamesCompleted: number;
  totalGamesCompletedLoggedIn: number;
  totalGamesCompletedGuest: number;
  totalTimePlayedSecondsLoggedIn: number;
  totalTimePlayedSecondsGuest: number;
  updatedAt: number;
  perGameMode?: GameModeMetrics[];
};
export type AdminMetricsDaily = {
  date: string;
  gamesStarted: number;
  gamesStartedLoggedIn?: number;
  gamesStartedGuest?: number;
  gamesCompleted: number;
  timePlayedSecondsLoggedIn: number;
  timePlayedSecondsGuest: number;
  uniquePlayers: number;
  updatedAt?: number;
  perGameMode?: DailyGameModeMetrics[];
};
export type AdminEvent = {
  sessionId: string;
  gameType?: string;
  event: string;
  data: string;
  at: number;
};

async function adminFetch<T>(token: string, path: string): Promise<T | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function adminCheck(token: string): Promise<AdminCheckResponse | null> {
  return adminFetch<AdminCheckResponse>(token, "/api/admin/check");
}

export async function adminGetEvents(token: string): Promise<AdminEvent[] | null> {
  return adminFetch<AdminEvent[]>(token, "/api/admin/events");
}

export async function adminGetSessions(token: string): Promise<AdminSessionsResponse | null> {
  return adminFetch<AdminSessionsResponse>(token, "/api/admin/sessions");
}

export async function adminGetMetricsGlobal(token: string): Promise<AdminMetricsGlobal | null> {
  return adminFetch<AdminMetricsGlobal>(token, "/api/admin/metrics/global");
}

export async function adminGetMetricsDaily(token: string, date?: string): Promise<AdminMetricsDaily | null> {
  const path = date ? `/api/admin/metrics/daily?date=${encodeURIComponent(date)}` : "/api/admin/metrics/daily";
  return adminFetch<AdminMetricsDaily>(token, path);
}

/** POST /api/game/{path}/start — pass token when logged in so the session is tied to the user */
export async function createSession(
  config: GuessTheExamineConfig,
  token?: string | null
): Promise<StartSessionResponse | null> {
  const base = getBaseUrl();
  if (!base) return null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(apiUrl(`/api/game/${PATH_GUESS_THE_EXAMINE}/start`), {
      method: "POST",
      headers,
      body: JSON.stringify({
        gameType: GAME_TYPE_GUESS_THE_EXAMINE,
        config: {
          mode: config.mode.toUpperCase(),
          difficulty: config.difficulty.toUpperCase(),
          easyCategory: config.easyCategory.toUpperCase(),
        },
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** GET /api/game/{path}/{sessionId}/events — returns EventSource */
export function openSessionEvents(
  sessionId: string,
  handlers: {
    onQuestion?: (data: QuestionEvent) => void;
    onTimer?: (data: TimerEvent) => void;
    onGuessResult?: (data: GuessResultEvent) => void;
    onGameEnded?: (data: GameEndedEvent) => void;
    onPreCountdown?: (data: PreCountdownEvent) => void;
    onRunEnded?: (data: RunEndedEvent) => void;
  }
): EventSource {
  const url = apiUrl(`/api/game/${PATH_GUESS_THE_EXAMINE}/${sessionId}/events`);
  const es = new EventSource(url);

  es.addEventListener("question", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as QuestionEvent;
      handlers.onQuestion?.(data);
    } catch {}
  });
  es.addEventListener("timer", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as TimerEvent;
      handlers.onTimer?.(data);
    } catch {}
  });
  es.addEventListener("guess_result", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as GuessResultEvent;
      handlers.onGuessResult?.(data);
    } catch {}
  });
  es.addEventListener("game_ended", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as GameEndedEvent;
      handlers.onGameEnded?.(data);
    } catch {}
  });
  es.addEventListener("pre_countdown", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as PreCountdownEvent;
      handlers.onPreCountdown?.(data);
    } catch {}
  });
  es.addEventListener("run_ended", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as RunEndedEvent;
      handlers.onRunEnded?.(data);
    } catch {}
  });

  return es;
}

async function sessionPost(
  sessionId: string,
  path: string,
  body?: object
): Promise<Response> {
  const url = apiUrl(`/api/game/${PATH_GUESS_THE_EXAMINE}/${sessionId}${path}`);
  return fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** POST .../guess */
export async function submitGuess(
  sessionId: string,
  guess: string
): Promise<{ correct: boolean } | null> {
  const res = await sessionPost(sessionId, "/guess", { guess });
  if (!res.ok) return null;
  return res.json();
}

/** POST .../new-examine */
export async function requestNewExamine(sessionId: string): Promise<boolean> {
  const res = await sessionPost(sessionId, "/new-examine");
  return res.ok;
}

/** POST .../hint */
export async function requestHint(sessionId: string): Promise<boolean> {
  const res = await sessionPost(sessionId, "/hint");
  return res.ok;
}

/** POST .../start-timed */
export async function startTimed(sessionId: string): Promise<boolean> {
  const res = await sessionPost(sessionId, "/start-timed");
  return res.ok;
}

/** POST .../start-limited */
export async function startLimited(sessionId: string): Promise<boolean> {
  const res = await sessionPost(sessionId, "/start-limited");
  return res.ok;
}

/** POST .../start-practice */
export async function startPractice(sessionId: string): Promise<boolean> {
  const res = await sessionPost(sessionId, "/start-practice");
  return res.ok;
}

/** POST .../end */
export async function endRun(sessionId: string): Promise<boolean> {
  const res = await sessionPost(sessionId, "/end");
  return res.ok;
}

/** POST .../end with keepalive for page unload/close — removes session from server when user leaves */
export function endRunBeacon(sessionId: string, pathSegment?: string): void {
  const base = getBaseUrl();
  if (!base) return;
  const path = pathSegment ?? PATH_GUESS_THE_EXAMINE;
  const url = apiUrl(`/api/game/${path}/${sessionId}/end`);
  try {
    fetch(url, { method: "POST", keepalive: true });
  } catch {
    // ignore
  }
}
