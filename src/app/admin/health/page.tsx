"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import {
  adminCheck,
  adminGetEvents,
  adminGetMetricsDaily,
  adminGetMetricsGlobal,
  adminGetSessions,
  type AdminEvent,
  type AdminMetricsDaily,
  type AdminMetricsGlobal,
  type AdminSessionsResponse
} from "@/lib/runeguess-server";
import { Activity, BarChart3, Lock, LogIn, Radio } from "lucide-react";

type TabId = "events" | "health";

const GAME_DISPLAY_NAMES: Record<string, string> = {
  "guess-the-examine": "Guess the Examine",
};

/** Games we show in the active-sessions table: gameType -> list of mode ids from API */
const ACTIVE_SESSIONS_TABLE: { gameType: string; modes: string[] }[] = [
  { gameType: "guess-the-examine", modes: ["LIMITED", "TIMED", "PRACTICE"] },
];

function gameDisplayName(gameType: string): string {
  return GAME_DISPLAY_NAMES[gameType] ?? gameType;
}

function modeDisplayName(mode: string): string {
  if (!mode) return "";
  return mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
}

function formatTime(ms: number) {
  return new Date(ms).toISOString();
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function GameHealthPage() {
  const { user, loading: authLoading, token } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>("health");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [sessions, setSessions] = useState<AdminSessionsResponse | null>(null);
  const [metricsGlobal, setMetricsGlobal] = useState<AdminMetricsGlobal | null>(null);
  const [metricsDaily, setMetricsDaily] = useState<AdminMetricsDaily | null>(null);
  const [eventsFilter, setEventsFilter] = useState("");
  const [sessionsSearch, setSessionsSearch] = useState("");
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [globalByGameModeFilter, setGlobalByGameModeFilter] = useState<string>("all");
  const [dailyByGameModeFilter, setDailyByGameModeFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!token) {
      setAllowed(false);
      return;
    }
    const res = await adminCheck(token);
    setAllowed(res?.allowed ?? false);
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const [ev, ses, glob, daily] = await Promise.all([
        adminGetEvents(token),
        adminGetSessions(token),
        adminGetMetricsGlobal(token),
        adminGetMetricsDaily(token)
      ]);
      if (ev) setEvents(ev);
      if (ses) setSessions(ses);
      if (glob) setMetricsGlobal(glob);
      if (daily) setMetricsDaily(daily);
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && user && token) checkAccess();
    else if (!authLoading && !user) setAllowed(false);
  }, [authLoading, user, token, checkAccess]);

  useEffect(() => {
    if (allowed && token) {
      refresh();
      const id = setInterval(refresh, 5000);
      return () => clearInterval(id);
    }
  }, [allowed, token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Game Health</h1>
        <p className="text-muted-foreground text-center">Log in with Google to access this page.</p>
        <Button asChild>
          <a href="/">
            <LogIn className="mr-2 h-4 w-4" />
            Go to home
          </a>
        </Button>
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <Lock className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold text-foreground">Access denied</h1>
        <p className="text-muted-foreground text-center">You don’t have permission to view game health.</p>
        <Button variant="outline" asChild>
          <a href="/">Back to home</a>
        </Button>
      </div>
    );
  }

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  const normalizedGameType = (e: AdminEvent) => e.gameType?.trim() || "guess-the-examine";
  const gameTypes = Array.from(
    new Set(events.map(normalizedGameType))
  ).filter(Boolean).sort();
  const eventsForGame = gameFilter !== "all"
    ? events.filter((e) => normalizedGameType(e) === gameFilter)
    : events;
  const eventTypesForGame = Array.from(new Set(eventsForGame.map((e) => e.event))).sort();

  const filteredEvents = events.filter((e) => {
    const matchGame = gameFilter === "all" || normalizedGameType(e) === gameFilter;
    const matchSession =
      !eventsFilter.trim() ||
      e.sessionId.toLowerCase().includes(eventsFilter.toLowerCase()) ||
      e.event.toLowerCase().includes(eventsFilter.toLowerCase());
    const matchType = eventTypeFilter === "all" || e.event === eventTypeFilter;
    return matchGame && matchSession && matchType;
  });

  const sessionList = sessions?.sessions ?? [];
  const sessionsSearchLower = sessionsSearch.trim().toLowerCase();
  const filteredSessions = sessionsSearchLower
    ? sessionList.filter(
        (s) =>
          s.sessionId.toLowerCase().includes(sessionsSearchLower) ||
          (s.username && s.username.toLowerCase().includes(sessionsSearchLower))
      )
    : sessionList;

  return (
    <div className="min-h-screen h-screen flex flex-col bg-background text-foreground">
      <header className="shrink-0 z-10 border-b border-border bg-card">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-3 max-w-6xl">
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Game Health
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setTab("health")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  tab === "health"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                Health
              </button>
              <button
                type="button"
                onClick={() => setTab("events")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  tab === "events"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Radio className="h-4 w-4" />
                SSE Events
              </button>
            </div>
            <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-4 pb-5 max-w-6xl flex-1 flex flex-col min-h-0 overflow-auto">
        <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)} className="flex-1 flex flex-col min-h-0">
          <TabsContent value="health" className={`${tab === "health" ? "flex-1 flex flex-col min-h-0" : "hidden"}`}>
            <div className="flex flex-col gap-6 flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Active sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-mono font-bold text-primary tabular-nums">
                      {sessions?.count ?? 0} <span className="text-sm font-normal text-muted-foreground">total active</span>
                    </p>
                    <div className="mt-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/60">
                            <TableHead className="text-xs uppercase tracking-wider">Game</TableHead>
                            {(() => {
                              const allModes = [...new Set(ACTIVE_SESSIONS_TABLE.flatMap((g) => g.modes))].sort();
                              return allModes.map((mode) => (
                                <TableHead key={mode} className="text-right text-xs uppercase tracking-wider tabular-nums">
                                  {modeDisplayName(mode)}
                                </TableHead>
                              ));
                            })()}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const allModes = [...new Set(ACTIVE_SESSIONS_TABLE.flatMap((g) => g.modes))].sort();
                            const byMode = new Map((sessions?.activeByMode ?? []).map((a) => [a.mode, a.count]));
                            return ACTIVE_SESSIONS_TABLE.map(({ gameType }) => (
                              <TableRow key={gameType}>
                                <TableCell className="font-medium">{gameDisplayName(gameType)}</TableCell>
                                {allModes.map((mode) => (
                                  <TableCell key={mode} className="text-right font-mono tabular-nums">
                                    {byMode.get(mode) ?? 0}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ));
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Global metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {metricsGlobal ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Global metrics — Logged in</h3>
                      <dl className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <dt className="text-muted-foreground text-xs">Games started</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">{metricsGlobal.totalGamesStartedLoggedIn}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Games completed</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">{metricsGlobal.totalGamesCompletedLoggedIn}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Time played</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">
                            {formatDuration(metricsGlobal.totalTimePlayedSecondsLoggedIn)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Global metrics — Guest</h3>
                      <dl className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <dt className="text-muted-foreground text-xs">Games started</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">{metricsGlobal.totalGamesStartedGuest}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Games completed</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">{metricsGlobal.totalGamesCompletedGuest}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Time played</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">
                            {formatDuration(metricsGlobal.totalTimePlayedSecondsGuest)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No global metrics yet.</p>
                    )}
                  </CardContent>
                </Card>
            </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {metricsGlobal && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Global summary (all time)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {metricsGlobal && (
                        <>
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-sm">
                        <div>
                          <dt className="text-muted-foreground text-xs">Games started</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">{metricsGlobal.totalGamesStarted}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Games completed</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">{metricsGlobal.totalGamesCompleted}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Time (logged in)</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">
                            {formatDuration(metricsGlobal.totalTimePlayedSecondsLoggedIn)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Time (guest)</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">
                            {formatDuration(metricsGlobal.totalTimePlayedSecondsGuest)}
                          </dd>
                        </div>
                          </dl>
                        </>
                      )}
                      {metricsGlobal?.perGameMode && metricsGlobal.perGameMode.length > 0 && (
                        <div className={metricsGlobal ? "mt-4 pt-4 border-t border-border" : ""}>
                          <div className="inline-flex items-center gap-3 mb-4">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                              Global — By game mode
                            </Label>
                            <Select value={globalByGameModeFilter} onValueChange={setGlobalByGameModeFilter}>
                              <SelectTrigger className="min-w-[140px]">
                                <SelectValue placeholder="All games" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All games</SelectItem>
                                {[...new Set(metricsGlobal.perGameMode.map((pm) => pm.gameType))].sort().map((gt) => (
                                  <SelectItem key={gt} value={gt}>{gameDisplayName(gt)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {metricsGlobal.perGameMode
                      .filter((pm) => globalByGameModeFilter === "all" || pm.gameType === globalByGameModeFilter)
                      .map((pm) => {
                        const isPractice = pm.mode === "PRACTICE";
                        const categoryStats = isPractice ? sessions?.practiceCategoryStats : null;
                        const mostPopularCategory = categoryStats && categoryStats.length > 0 ? categoryStats[0] : null;
                        return (
                          <div key={`${pm.gameType}-${pm.mode}`} className="rounded-lg bg-muted/50 p-3">
                            <div className="font-medium text-foreground">{gameDisplayName(pm.gameType)} — {modeDisplayName(pm.mode)}</div>
                            <dl className="mt-1.5 grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs">
                              <dt className="text-muted-foreground">Started</dt>
                              <dd className="font-mono tabular-nums col-span-2">{pm.gamesStarted}</dd>
                              <dt className="text-muted-foreground">Completed</dt>
                              <dd className="font-mono tabular-nums col-span-2">{pm.gamesCompleted}</dd>
                              <dt className="text-muted-foreground">Time</dt>
                              <dd className="font-mono tabular-nums col-span-2">{formatDuration(pm.timePlayedSeconds)}</dd>
                              {isPractice && mostPopularCategory && (
                                <>
                                  <dt className="text-muted-foreground">Most popular</dt>
                                  <dd className="font-mono tabular-nums col-span-2">
                                    {mostPopularCategory.category} ({mostPopularCategory.count})
                                  </dd>
                                </>
                              )}
                            </dl>
                          </div>
                        );
                      })}
                  </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                <CardHeader>
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Today&apos;s metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metricsDaily ? (
                    <>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-6 gap-y-4 text-sm">
                        <div>
                          <dt className="text-muted-foreground text-xs">Date</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">
                            {metricsDaily.date}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Unique players</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">
                            {metricsDaily.uniquePlayers}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Games started</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">
                            {metricsDaily.gamesStarted}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Games completed</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">
                            {metricsDaily.gamesCompleted}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Time (logged in)</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">
                            {formatDuration(metricsDaily.timePlayedSecondsLoggedIn)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Time (guest)</dt>
                          <dd className="font-mono font-semibold tabular-nums mt-0.5">
                            {formatDuration(metricsDaily.timePlayedSecondsGuest)}
                          </dd>
                        </div>
                      </dl>

                      {metricsDaily.perGameMode && metricsDaily.perGameMode.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="inline-flex items-center gap-3 mb-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                              Today by game mode
                            </Label>
                            <Select
                              value={dailyByGameModeFilter}
                              onValueChange={setDailyByGameModeFilter}
                            >
                              <SelectTrigger className="min-w-[140px]">
                                <SelectValue placeholder="All games" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All games</SelectItem>
                                {[...new Set(metricsDaily.perGameMode.map((pm) => pm.gameType))]
                                  .sort()
                                  .map((gt) => (
                                    <SelectItem key={gt} value={gt}>
                                      {gameDisplayName(gt)}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {metricsDaily.perGameMode
                              .filter(
                                (pm) =>
                                  dailyByGameModeFilter === "all" ||
                                  pm.gameType === dailyByGameModeFilter
                              )
                              .map((pm) => {
                                const isPractice = pm.mode === "PRACTICE";
                                const categoryStats = isPractice ? sessions?.practiceCategoryStats : null;
                                const mostPopularCategory = categoryStats && categoryStats.length > 0 ? categoryStats[0] : null;
                                return (
                                  <div
                                    key={`${pm.date}-${pm.gameType}-${pm.mode}`}
                                    className="rounded-lg bg-muted/50 p-3"
                                  >
                                    <div className="font-medium text-foreground">
                                      {gameDisplayName(pm.gameType)} —{" "}
                                      {modeDisplayName(pm.mode)}
                                    </div>
                                    <dl className="mt-1.5 grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs">
                                      <dt className="text-muted-foreground">Started</dt>
                                      <dd className="font-mono tabular-nums col-span-2">
                                        {pm.gamesStarted}
                                      </dd>
                                      <dt className="text-muted-foreground">Completed</dt>
                                      <dd className="font-mono tabular-nums col-span-2">
                                        {pm.gamesCompleted}
                                      </dd>
                                      <dt className="text-muted-foreground">Time</dt>
                                      <dd className="font-mono tabular-nums col-span-2">
                                        {formatDuration(pm.timePlayedSeconds)}
                                      </dd>
                                      {isPractice && mostPopularCategory && (
                                        <>
                                          <dt className="text-muted-foreground">Most popular</dt>
                                          <dd className="font-mono tabular-nums col-span-2">
                                            {mostPopularCategory.category} ({mostPopularCategory.count})
                                          </dd>
                                        </>
                                      )}
                                    </dl>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">No daily metrics yet.</p>
                  )}
                </CardContent>
              </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="events" className={`${tab === "events" ? "flex-1 flex flex-col min-h-0" : "hidden"}`}>
            <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">
              <Card className="w-60 shrink-0 flex flex-col overflow-hidden">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Sessions
                  </CardTitle>
                  <Input
                    type="text"
                    placeholder="Search by id or username…"
                    aria-label="Search sessions"
                    value={sessionsSearch}
                    onChange={(e) => setSessionsSearch(e.target.value)}
                  />
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-2 space-y-1">
                  {filteredSessions.length ? (
                    filteredSessions.map((s) => (
                      <Button
                        key={s.sessionId}
                        variant={eventsFilter === s.sessionId ? "secondary" : "ghost"}
                        className="w-full justify-start h-auto py-2 px-2.5"
                        onClick={() => setEventsFilter(eventsFilter === s.sessionId ? "" : s.sessionId)}
                        title={s.sessionId}
                      >
                        <div className="w-full text-left">
                          <span className="font-mono text-muted-foreground block truncate text-xs" title={s.sessionId}>
                            {s.sessionId.slice(0, 8)}…
                          </span>
                          {s.username ? (
                            <span className="text-foreground font-medium block truncate mt-0.5 text-xs" title={s.username}>
                              {s.username}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic block mt-0.5 text-xs">Guest</span>
                          )}
                          {s.mode && (
                            <span className="text-muted-foreground block mt-0.5 text-xs">{modeDisplayName(s.mode)}</span>
                          )}
                        </div>
                      </Button>
                    ))
                  ) : (
                    <div className="px-2.5 py-4 text-muted-foreground text-sm text-center">
                      {sessionList.length ? "No matches" : "No active sessions"}
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="game-filter" className="text-sm whitespace-nowrap">
                        Game
                      </Label>
                      <Select
                        value={gameFilter}
                        onValueChange={(value) => {
                          setGameFilter(value);
                          setEventTypeFilter("all");
                        }}
                      >
                        <SelectTrigger id="game-filter" className="min-w-[140px]">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {gameTypes.map((g) => (
                            <SelectItem key={g} value={g}>
                              {gameDisplayName(g)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="event-type" className="text-sm whitespace-nowrap">
                        Event type
                      </Label>
                      <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                        <SelectTrigger id="event-type" className="min-w-[140px]">
                          <SelectValue placeholder={gameFilter !== "all" ? "All (this game)" : "All"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {gameFilter !== "all" ? "All (this game)" : "All"}
                          </SelectItem>
                          {eventTypesForGame.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
                <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <CardContent className="min-h-0 flex-1 overflow-auto">
                    {filteredEvents.length === 0 ? (
                      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
                        No events to show.
                      </div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {filteredEvents.map((e, i) => (
                          <li key={`${e.at}-${i}`} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                              <span className="rounded-md bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                                {e.event}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]" title={e.sessionId}>
                                {e.sessionId}
                              </span>
                              <span className="text-xs text-muted-foreground ml-auto">{formatTime(e.at)}</span>
                            </div>
                            <pre className="text-xs font-mono bg-muted/60 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all border border-border/50">
                              {e.data}
                            </pre>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          </Tabs>
        </main>
    </div>
  );
}
