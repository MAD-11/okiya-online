import { pubClient } from './redis';

interface GameResult {
  roomId: string;
  winner: 'host' | 'guest' | 'draw';
  players: { host: string; guest: string };
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

export async function recordPuzzleSolved(playerId: string): Promise<number> {
  try {
    const key = PUZZLES_SOLVED_PREFIX + playerId;
    const newCount = await withTimeout(pubClient.incr(key), REDIS_TIMEOUT);
    return newCount;
  } catch (err) {
    console.error('recordPuzzleSolved failed:', err);
    return 0;
  }
}

export async function getPuzzlesSolved(playerId: string): Promise<number> {
  try {
    const key = PUZZLES_SOLVED_PREFIX + playerId;
    const val = await withTimeout(pubClient.get(key), REDIS_TIMEOUT);
    return val ? parseInt(val, 10) : 0;
  } catch (err) {
    console.error('getPuzzlesSolved failed:', err);
    return 0;
  }
}

/**
 * Сохранить активный пазл в Redis (для валидации при решении).
 */
export async function storeActivePuzzle(
  puzzleId: string,
  difficulty: number
): Promise<void> {
  try {
    const key = PUZZLE_PREFIX + puzzleId;
    await withTimeout(
      pubClient.set(key, String(difficulty), 'EX', PUZZLE_TTL),
      REDIS_TIMEOUT
    );
  } catch (err) {
    console.error('storeActivePuzzle failed:', err);
  }
}

/**
 * Атомарно прочитать и удалить пазл (getdel).
 * Возвращает difficulty или null, если пазл не найден / уже использован / истёк.
 */
export async function consumeActivePuzzle(
  puzzleId: string
): Promise<number | null> {
  try {
    const key = PUZZLE_PREFIX + puzzleId;
    const val = await withTimeout(pubClient.getdel(key), REDIS_TIMEOUT);
    return val ? parseInt(val, 10) : null;
  } catch (err) {
    console.error('consumeActivePuzzle failed:', err);
    return null;
  }
}