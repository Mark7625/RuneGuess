/**
 * Game type IDs and path segments — keep in sync with server GameTypes.kt.
 *
 * Adding a new game:
 * 1. Add GAME_TYPE_* and PATH_* constants below.
 * 2. Add an entry to GAME_REGISTRY.
 * 3. Add API helpers in runeguess-server.ts (createSession, openSessionEvents, sessionPost for your path).
 * 4. Add a game component and wire it on the page (e.g. page.tsx / AppNav).
 */

export const GAME_TYPE_GUESS_THE_EXAMINE = "guess-the-examine" as const;
export const PATH_GUESS_THE_EXAMINE = "guesstheexamine" as const;

export const GAME_TYPE_GUESS_THE_MUSIC = "guess-the-music" as const;
export const PATH_GUESS_THE_MUSIC = "guessthemusic" as const;

export type GameTypeId = typeof GAME_TYPE_GUESS_THE_EXAMINE | typeof GAME_TYPE_GUESS_THE_MUSIC;

export type GameRegistryEntry = { gameTypeId: GameTypeId; pathSegment: string };

/** Single source of truth for "which games exist" — use for nav, leaderboard filters, etc. */
export const GAME_REGISTRY: readonly GameRegistryEntry[] = [
  { gameTypeId: GAME_TYPE_GUESS_THE_EXAMINE, pathSegment: PATH_GUESS_THE_EXAMINE },
  { gameTypeId: GAME_TYPE_GUESS_THE_MUSIC, pathSegment: PATH_GUESS_THE_MUSIC },
];

/** localStorage key for OSRS/RS3 game mode preference */
export const STORAGE_KEY_GAME_MODE = "runeguess_game_mode";
