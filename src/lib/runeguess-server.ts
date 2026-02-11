/**
 * RuneGuess backend client.
 * Server: http://0.0.0.0:8081
 * Set NEXT_PUBLIC_RUNEGUESS_SERVER_URL in .env (e.g. http://localhost:8081).
 */

// ---- Auth (Ktor server) ----

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

// ---- Game ----

export type ExamineGameMode = "limited" | "timed";
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
  hintImageUrl?: string | null;
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

/** POST /api/game/guesstheexamine/start */
export async function createSession(
  config: GuessTheExamineConfig
): Promise<StartSessionResponse | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    const res = await fetch(apiUrl("/api/game/guesstheexamine/start"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameType: "guess-the-examine",
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

/** GET /api/game/guesstheexamine/{sessionId}/events — returns EventSource */
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
  const url = apiUrl(`/api/game/guesstheexamine/${sessionId}/events`);
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
  const url = apiUrl(`/api/game/guesstheexamine/${sessionId}${path}`);
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

/** POST .../end */
export async function endRun(sessionId: string): Promise<boolean> {
  const res = await sessionPost(sessionId, "/end");
  return res.ok;
}
