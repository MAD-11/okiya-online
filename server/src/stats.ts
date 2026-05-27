import { pubClient } from './redis';

interface GameResult {
  roomId: string;
  winner: 'host' | 'guest' | 'draw';
  players: { host: string; guest: string };
  timestamp: number;
  maxWins: number;
}

const REDIS_TIMEOUT = 2000; // 2 секунды

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Redis timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
  } catch (err) {
    console.error('saveGameResult failed (non‑critical):', err);
  }
}

export async function getPlayerStats(playerId: string): Promise<{
  games: number;
  wins: number;
  draws: number;
  history: GameResult[];
}> {
  try {
    const key = `okiya:stats:${playerId}`;
    const data = await withTimeout(pubClient.lrange(key, 0, 99), REDIS_TIMEOUT);
    const games = data.map((d: string) => JSON.parse(d));
    let wins = 0, draws = 0;
    games.forEach((g: GameResult) => {
      const isHost = g.players.host === playerId;
      if (g.winner === 'draw') draws++;
      else if ((g.winner === 'host' && isHost) || (g.winner === 'guest' && !isHost)) wins++;
    });
    return { games: games.length, wins, draws, history: games };
  } catch (err) {
    console.error('getPlayerStats failed, returning zeros:', err);
    return { games: 0, wins: 0, draws: 0, history: [] };
  }
}