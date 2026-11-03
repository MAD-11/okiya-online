import { pubClient } from './redis';

interface GameResult {
  roomId: string;
  gameId: string;
  winner: 'host' | 'guest' | 'draw';
  players: { host: string; guest: string };
  nicks: { host: string; guest: string };
  timestamp: number;
  maxWins: number;
}

const REDIS_TIMEOUT = 2000;
const RATING_PREFIX = 'okiya:rating:';
const DEFAULT_RATING = 1000;
const K_FACTOR = 32;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Redis timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function getPlayerRating(playerId: string): Promise<number> {
  try {
    const val = await withTimeout(pubClient.get(RATING_PREFIX + playerId), REDIS_TIMEOUT);
    return val ? parseInt(val, 10) : DEFAULT_RATING;
  } catch {
    return DEFAULT_RATING;
  }
}

async function setPlayerRating(playerId: string, rating: number): Promise<void> {
  await withTimeout(pubClient.set(RATING_PREFIX + playerId, String(rating)), REDIS_TIMEOUT);
}

export function calculateNewRatings(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  kFactor: number = K_FACTOR
): { newA: number; newB: number } {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const newA = Math.round(ratingA + kFactor * (scoreA - expectedA));
  const newB = Math.round(ratingB + kFactor * ((1 - scoreA) - expectedB));
  return { newA, newB };
}

async function updateRatings(result: GameResult): Promise<void> {
  const hostId = result.players.host;
  const guestId = result.players.guest;
  if (!hostId || !guestId) return;

  const hostRating = await getPlayerRating(hostId);
  const guestRating = await getPlayerRating(guestId);

  let hostScore: number;
  if (result.winner === 'host') hostScore = 1;
  else if (result.winner === 'guest') hostScore = 0;
  else hostScore = 0.5;

  const { newA, newB } = calculateNewRatings(hostRating, guestRating, hostScore);
  await setPlayerRating(hostId, newA);
  await setPlayerRating(guestId, newB);
}

export async function saveGameResult(result: GameResult): Promise<void> {
  try {
    const hostKey = `okiya:stats:${result.players.host}`;
    const guestKey = `okiya:stats:${result.players.guest}`;
    const json = JSON.stringify(result);
    await withTimeout(pubClient.lpush(hostKey, json), REDIS_TIMEOUT);
    await withTimeout(pubClient.lpush(guestKey, json), REDIS_TIMEOUT);
    await withTimeout(pubClient.ltrim(hostKey, 0, 99), REDIS_TIMEOUT);
    await withTimeout(pubClient.ltrim(guestKey, 0, 99), REDIS_TIMEOUT);
    await updateRatings(result);
  } catch (err) {
    console.error('saveGameResult failed (non-critical):', err);
  }
}

export async function getPlayerStats(playerId: string): Promise<{
  games: number;
  wins: number;
  draws: number;
  rating: number;
  puzzlesSolved: number; // ← добавить
  history: GameResult[];
}> {
  try {
    const key = `okiya:stats:${playerId}`;
    const data = await withTimeout(pubClient.lrange(key, 0, 99), REDIS_TIMEOUT);
    const games = data.map((d: string) => JSON.parse(d));
    const rating = await getPlayerRating(playerId);
    const puzzlesSolved = await getPuzzlesSolved(playerId); // ← добавить

    let wins = 0, draws = 0;
    games.forEach((g: GameResult) => {
      const isHost = g.players.host === playerId;
      if (g.winner === 'draw') draws++;
      else if ((g.winner === 'host' && isHost) || (g.winner === 'guest' && !isHost)) wins++;
    });

    return {
      games: games.length,
      wins,
      draws,
      rating,
      puzzlesSolved, // ← добавить
      history: games,
    };
  } catch (err) {
    console.error('getPlayerStats failed:', err);
    return {
      games: 0, wins: 0, draws: 0,
      rating: DEFAULT_RATING,
      puzzlesSolved: 0,
      history: [],
    };
  }
}

// ============================================================
// PUZZLES
// ============================================================

const PUZZLES_SOLVED_PREFIX = 'okiya:puzzlesSolved:';
const PUZZLE_PREFIX = 'okiya:puzzle:';
const PUZZLE_TTL = 30 * 60; // 30 минут

interface StoredPuzzle {
  puzzle: any;
  playerId: string;
  createdAt: number;
}

export async function recordPuzzleSolved(playerId: string): Promise<number> {
  try {
    const key = PUZZLES_SOLVED_PREFIX + playerId;
    return await withTimeout(pubClient.incr(key), REDIS_TIMEOUT);
  } catch (err) {
    console.error('recordPuzzleSolved failed:', err);
    return 0;
  }
}

export async function getPuzzlesSolved(playerId: string): Promise<number> {
  try {
    const val = await withTimeout(pubClient.get(PUZZLES_SOLVED_PREFIX + playerId), REDIS_TIMEOUT);
    return val ? parseInt(val, 10) : 0;
  } catch (err) {
    console.error('getPuzzlesSolved failed:', err);
    return 0;
  }
}

export async function storeActivePuzzle(
  puzzleId: string,
  puzzle: any,
  playerId: string,
): Promise<void> {
  try {
    const key = PUZZLE_PREFIX + puzzleId;
    const data: StoredPuzzle = { puzzle, playerId, createdAt: Date.now() };
    await withTimeout(
      pubClient.set(key, JSON.stringify(data), 'EX', PUZZLE_TTL),
      REDIS_TIMEOUT,
    );
  } catch (err) {
    console.error('storeActivePuzzle failed:', err);
  }
}

/** Только чтение, без удаления. Нужно чтобы отклонить неверный ход, не сжигая пазл. */
export async function peekActivePuzzle(
  puzzleId: string,
  playerId: string,
): Promise<any | null> {
  try {
    const raw = await withTimeout(pubClient.get(PUZZLE_PREFIX + puzzleId), REDIS_TIMEOUT);
    if (!raw) return null;
    const stored: StoredPuzzle = JSON.parse(raw);
    if (stored.playerId !== playerId) return null;
    return stored.puzzle;
  } catch (err) {
    console.error('peekActivePuzzle failed:', err);
    return null;
  }
}

/** Атомарно: прочитать, проверить playerId, удалить. Возвращает пазл или null. */
export async function consumeActivePuzzle(
  puzzleId: string,
  playerId: string,
): Promise<any | null> {
  try {
    const key = PUZZLE_PREFIX + puzzleId;
    const raw = await withTimeout(pubClient.get(key), REDIS_TIMEOUT);
    if (!raw) return null;
    const stored: StoredPuzzle = JSON.parse(raw);
    if (stored.playerId !== playerId) return null;
    const deleted = await withTimeout(pubClient.del(key), REDIS_TIMEOUT);
    if (deleted === 0) return null; // параллельный запрос успел раньше
    return stored.puzzle;
  } catch (err) {
    console.error('consumeActivePuzzle failed:', err);
    return null;
  }
}