import { pubClient } from './redis';
import { Board, Tile } from './game/types';

const REPLAY_MOVES_PREFIX = 'okiya:replay:moves:';
const REPLAY_META_PREFIX = 'okiya:replay:meta:';
const REPLAY_TTL = 7 * 24 * 60 * 60; // 7 дней

export interface ReplayMove {
  row: number;
  col: number;
  player: 'red' | 'black';
  tile: Tile;
  timestamp: number;
}

export interface ReplayMeta {
  gameId: string;
  board: Board;
  lastPickedTile: Tile | null;
  players: { red: string; black: string };
  roomId: string;
  maxWins: number;
  startedAt: number;
}

export async function saveReplayMeta(meta: ReplayMeta): Promise<void> {
  try {
    const key = REPLAY_META_PREFIX + meta.gameId;
    await pubClient.set(key, JSON.stringify(meta), 'EX', REPLAY_TTL);
  } catch (err) {
    console.error('saveReplayMeta failed:', err);
  }
}

export async function saveReplayMove(gameId: string, move: ReplayMove): Promise<void> {
  try {
    const key = REPLAY_MOVES_PREFIX + gameId;
    await pubClient.rpush(key, JSON.stringify(move));
    await pubClient.expire(key, REPLAY_TTL);
  } catch (err) {
    console.error('saveReplayMove failed:', err);
  }
}

export async function getReplay(gameId: string): Promise<{
  meta: ReplayMeta | null;
  moves: ReplayMove[];
}> {
  try {
    const metaRaw = await pubClient.get(REPLAY_META_PREFIX + gameId);
    const movesRaw = await pubClient.lrange(REPLAY_MOVES_PREFIX + gameId, 0, -1);
    return {
      meta: metaRaw ? (JSON.parse(metaRaw) as ReplayMeta) : null,
      moves: movesRaw.map(m => JSON.parse(m) as ReplayMove),
    };
  } catch (err) {
    console.error('getReplay failed:', err);
    return { meta: null, moves: [] };
  }
}