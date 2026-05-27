import { pubClient } from './redis';

interface GameResult {
  roomId: string;
  winner: 'host' | 'guest' | 'draw';
  players: { host: string; guest: string };
  timestamp: number;
  maxWins: number;
}

export async function saveGameResult(result: GameResult): Promise<void> {
  const hostKey = `okiya:stats:${result.players.host}`;
  const guestKey = `okiya:stats:${result.players.guest}`;
  const json = JSON.stringify(result);
  await pubClient.lpush(hostKey, json);
  await pubClient.lpush(guestKey, json);
  await pubClient.ltrim(hostKey, 0, 99);
  await pubClient.ltrim(guestKey, 0, 99);
}

export async function getPlayerStats(playerId: string): Promise<{
  games: number;
  wins: number;
  draws: number;
  history: GameResult[];
}> {
  const key = `okiya:stats:${playerId}`;
  const data = await pubClient.lrange(key, 0, 99);
  const games = data.map((d) => JSON.parse(d));
  let wins = 0,
    draws = 0;
  games.forEach((g: GameResult) => {
    const isHost = g.players.host === playerId;
    if (g.winner === 'draw') draws++;
    else if (
      (g.winner === 'host' && isHost) ||
      (g.winner === 'guest' && !isHost)
    )
      wins++;
  });
  return { games: games.length, wins, draws, history: games };
}