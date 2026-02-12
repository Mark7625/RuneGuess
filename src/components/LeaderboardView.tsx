"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GAME_REGISTRY, GAME_TYPE_GUESS_THE_EXAMINE } from "@/lib/game-types";
import {
  getGlobalHighscores,
  getGamesPlayedHighscores,
  type GlobalHighscoreAggregate,
  type GlobalTopScoreEntry,
  type GlobalGamesPlayedEntry,
} from "@/lib/runeguess-server";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FaUser, FaTrophy, FaMedal, FaAward } from "react-icons/fa";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

type GameMode = "TIMED" | "LIMITED";
type HighscoreType = "TOP_SCORE" | "GAMES_PLAYED";
type Difficulty = "EASY" | "HARD";

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function LeaderboardView() {
  const [selectedGame, setSelectedGame] = useState<string>(GAME_TYPE_GUESS_THE_EXAMINE);
  const [selectedMode, setSelectedMode] = useState<GameMode>("LIMITED");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("EASY");
  const [highscoreType, setHighscoreType] = useState<HighscoreType>("TOP_SCORE");
  const [data, setData] = useState<{
    aggregates: GlobalHighscoreAggregate[];
    topScores: Record<string, GlobalTopScoreEntry[]>;
  } | null>(null);
  const [gamesPlayedData, setGamesPlayedData] = useState<GlobalGamesPlayedEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    
    if (highscoreType === "TOP_SCORE") {
      getGlobalHighscores({ 
        gameType: selectedGame, 
        mode: selectedMode,
        variant: selectedDifficulty,
        topLimit: 100 
      })
        .then((res) => {
          if (cancelled) return;
          if (res) {
            setData(res);
            setGamesPlayedData(null);
          } else {
            setError(true);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else if (highscoreType === "GAMES_PLAYED") {
      getGamesPlayedHighscores({
        gameType: selectedGame,
        mode: selectedMode,
        variant: selectedDifficulty,
        topLimit: 100
      })
        .then((res) => {
          if (cancelled) return;
          if (res) {
            setGamesPlayedData(res);
            setData(null);
          } else {
            setError(true);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    
    return () => {
      cancelled = true;
    };
  }, [selectedGame, selectedMode, selectedDifficulty, highscoreType]);

  // Get the appropriate data based on highscoreType
  let allEntries: (GlobalTopScoreEntry | GlobalGamesPlayedEntry)[] = [];
  if (highscoreType === "TOP_SCORE") {
    const timedScores = data?.topScores?.TIMED ?? [];
    const limitedScores = data?.topScores?.LIMITED ?? [];
    allEntries = selectedMode === "TIMED" ? timedScores : limitedScores;
  } else if (highscoreType === "GAMES_PLAYED") {
    allEntries = gamesPlayedData ?? [];
  }
  
  // Pagination
  const totalPages = Math.ceil(allEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEntries = allEntries.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGame, selectedMode, selectedDifficulty, highscoreType]);

  const modeLabel = selectedMode === "TIMED" ? "Timed" : "Lives";
  const typeLabel =
    highscoreType === "TOP_SCORE"
      ? "Top score"
      : "Games played";

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <header className="text-center flex-shrink-0">
        <div className="flex flex-col items-center gap-1">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-amber-200">
            <FaTrophy className="h-7 w-7" />
            Leaderboard
          </h1>
          <p className="text-xs text-muted-foreground">
            {typeLabel} · {modeLabel} · {selectedDifficulty === "EASY" ? "Easy" : "Hard"}
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col items-center flex-shrink-0 mt-3">
        {/* Game selector as full-width strip, visually connected to table */}
        <div className="w-full rounded-t-md border border-border bg-black/60">
          <div className="flex items-center justify-between gap-2 px-3 pt-1.5 pb-0">
            <div className="flex flex-wrap items-end gap-2 self-end">
              {GAME_REGISTRY.map((game) => (
                <Button
                  key={game.gameTypeId}
                  variant={selectedGame === game.gameTypeId ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-4 rounded-b-none border-b-0"
                  onClick={() => setSelectedGame(game.gameTypeId)}
                >
                  {game.gameTypeId === "guess-the-examine" ? "Guess the Examine" : game.gameTypeId}
                </Button>
              ))}
            </div>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              More games coming soon
            </span>
          </div>
        </div>

        {/* Sub-tabs for game mode, centered under game selector */}
        <Tabs
          value={selectedMode}
          onValueChange={(value) => setSelectedMode(value as GameMode)}
          className="flex-shrink-0"
        >
          <TabsList className="h-8 px-1 rounded-t-none">
            <TabsTrigger value="LIMITED" className="text-xs px-3">
              Lives
            </TabsTrigger>
            <TabsTrigger value="TIMED" className="text-xs px-3">
              Timed
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Difficulty selector */}
        <div className="flex items-center gap-2 mt-3">
          <Label className="text-xs text-muted-foreground">Difficulty:</Label>
          <Tabs value={selectedDifficulty} onValueChange={(value) => setSelectedDifficulty(value as Difficulty)}>
            <TabsList className="h-8">
              <TabsTrigger value="EASY" className="text-xs px-3">
                Easy
              </TabsTrigger>
              <TabsTrigger value="HARD" className="text-xs px-3">
                Hard
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Type selector stays compact below */}
        <div className="flex items-center gap-2 mt-3">
          <Label className="text-xs text-muted-foreground">Type:</Label>
          <Tabs value={highscoreType} onValueChange={(value) => setHighscoreType(value as HighscoreType)}>
            <TabsList className="h-8">
              <TabsTrigger value="TOP_SCORE" className="text-xs px-3">
                Top Score
              </TabsTrigger>
              <TabsTrigger value="GAMES_PLAYED" className="text-xs px-3">
                Games
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {error && !loading && (
        <Alert variant="destructive" className="flex-shrink-0">
          <AlertDescription>
            Could not load leaderboard. Make sure the server is running and try again.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden mt-4">
        {loading ? (
          <SkeletonTable 
            mode={selectedMode === "TIMED" ? "Timed" : "Lives"} 
            highscoreType={highscoreType}
          />
        ) : (data || gamesPlayedData) ? (
          <>
            <HighscoreTable 
              mode={selectedMode === "TIMED" ? "Timed" : "Lives"} 
              entries={currentEntries}
              highscoreType={highscoreType}
              startRank={startIndex + 1}
            />
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="gap-1"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous
                      </Button>
                    </PaginationItem>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 7) {
                        page = i + 1;
                      } else if (currentPage <= 4) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        page = totalPages - 6 + i;
                      } else {
                        page = currentPage - 3 + i;
                      }
                      return (
                        <PaginationItem key={page}>
                          <Button
                            variant={currentPage === page ? "outline" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="h-9 w-9 p-0"
                          >
                            {page}
                          </Button>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="gap-1"
                      >
                        Next
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function SkeletonTable({
  mode,
  highscoreType,
}: {
  mode: string;
  highscoreType: HighscoreType;
}) {
  const getColumnHeader = () => {
    switch (highscoreType) {
      case "TOP_SCORE":
        return "Score";
      case "GAMES_PLAYED":
        return "Games";
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardContent className="flex-1 overflow-y-scroll min-h-0 p-0">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 px-4 py-3 font-semibold">Rank</TableHead>
              <TableHead className="px-4 py-3 font-semibold">Player</TableHead>
              <TableHead className="w-24 px-4 py-3 text-right font-semibold">{getColumnHeader()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 12 }).map((_, i) => (
              <TableRow key={i} className="hover:bg-muted/50">
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-6" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Skeleton className="h-4 w-12 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function HighscoreTable({
  mode,
  entries,
  highscoreType,
  startRank = 1,
}: {
  mode: string;
  entries: (GlobalTopScoreEntry | GlobalGamesPlayedEntry)[];
  highscoreType: HighscoreType;
  startRank?: number;
}) {

  const getColumnHeader = () => {
    switch (highscoreType) {
      case "TOP_SCORE":
        return "Score";
      case "GAMES_PLAYED":
        return "Games";
    }
  };

  const getValue = (entry: GlobalTopScoreEntry | GlobalGamesPlayedEntry): string => {
    switch (highscoreType) {
      case "TOP_SCORE":
        return (entry as GlobalTopScoreEntry).score.toString();
      case "GAMES_PLAYED":
        return formatNumber((entry as GlobalGamesPlayedEntry).gamesPlayed);
    }
  };

  const getUserId = (entry: GlobalTopScoreEntry | GlobalGamesPlayedEntry): string => {
    return entry.userId;
  };

  const getUsername = (entry: GlobalTopScoreEntry | GlobalGamesPlayedEntry): string | null => {
    return entry.username;
  };

  const getPictureUrl = (entry: GlobalTopScoreEntry | GlobalGamesPlayedEntry): string | null => {
    return entry.pictureUrl;
  };

  // Always show a fixed number of rows so the table
  // visually fills the available height, padding with
  // "open slot" rows when there are not enough scores.
  const MAX_ROWS = 12;
  const placeholderCount = Math.max(0, MAX_ROWS - entries.length);

  return (
    <Card className="flex flex-col h-full">
      <CardContent className="flex-1 overflow-hidden min-h-0 p-0 flex flex-col">
        <div className="flex-1 flex flex-col min-h-0 overflow-y-scroll">
          <div className="h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50 border-b z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 px-4 py-3 font-semibold">Rank</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Player</TableHead>
                  <TableHead className="w-24 px-4 py-3 text-right font-semibold">{getColumnHeader()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-b-0">
                {/* Real scores */}
                {entries.map((entry, i) => {
                    const rank = startRank + i;
                    const userId = getUserId(entry);
                    const username = getUsername(entry);
                    const pictureUrl = getPictureUrl(entry);
                    return (
                      <TableRow
                        key={`${userId}-${highscoreType === "TOP_SCORE" ? (entry as GlobalTopScoreEntry).playedAt : (entry as GlobalGamesPlayedEntry).lastPlayedAt}-${i}`}
                        className="hover:bg-muted/50"
                      >
                        <TableCell className="px-4 py-3 font-medium text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            {rank === 1 && (
                              <FaTrophy className="h-4 w-4 text-yellow-400" />
                            )}
                            {rank === 2 && (
                              <FaMedal className="h-4 w-4 text-gray-300" />
                            )}
                            {rank === 3 && (
                              <FaAward className="h-4 w-4 text-amber-600" />
                            )}
                            <span>{rank}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {userId && !userId.startsWith("guest:") ? (
                            <Link
                              href={`/profile/${userId}`}
                              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                            >
                              <Avatar className="h-7 w-7">
                                {pictureUrl && (
                                  <AvatarImage
                                    src={pictureUrl}
                                    alt={username ?? "Player"}
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                  />
                                )}
                                <AvatarFallback className="bg-secondary">
                                  <FaUser className="h-3.5 w-3.5 text-amber-200" />
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-foreground hover:text-amber-200 transition-colors font-medium">
                                {username ?? "Anonymous"}
                              </span>
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                {pictureUrl && (
                                  <AvatarImage
                                    src={pictureUrl}
                                    alt={username ?? "Player"}
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                  />
                                )}
                                <AvatarFallback className="bg-secondary">
                                  <FaUser className="h-3.5 w-3.5 text-amber-200" />
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-foreground font-medium">
                                {username ?? "Anonymous"}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-semibold text-amber-200">
                          {getValue(entry)}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {/* Placeholder rows to visually fill the table */}
                {Array.from({ length: placeholderCount }).map((_, idx) => {
                  const rank = startRank + entries.length + idx;
                  return (
                    <TableRow
                      key={`placeholder-${rank}`}
                      className="opacity-60 hover:bg-transparent"
                    >
                      <TableCell className="px-4 py-3 font-medium text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{rank}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        Open spot – claim this rank
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-semibold text-muted-foreground">
                        —
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
