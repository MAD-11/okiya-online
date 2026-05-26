import Redis from 'ioredis';
import { Game } from './game/Game';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const pubClient = new Redis(redisUrl);
export const subClient = pubClient.duplicate();
const dataClient = new Redis(redisUrl);

const GAME_PREFIX = 'okiya:game:';
const GAME_TTL = 3600; // 1 час

function serializeGame(game: Game): string {
  return JSON.stringify({
    board: game.board,
    currentPlayer: game.currentPlayer,
    status: game.status,
    winner: game.winner,
    lastPickedTile: game.lastPickedTile,
    players: game.players,
    hostSocketId: game.hostSocketId,
    guestSocketId: game.guestSocketId,
    hostToken: game.hostToken,
    guestToken: game.guestToken,
    nickRed: game.nickRed,
    nickBlack: game.nickBlack,
    maxWins: game.maxWins,
    scores: game.scores,
    roundFinished: game.roundFinished,
    seriesWinner: game.seriesWinner,
    turnStartedAt: game.turnStartedAt,
    turnDuration: game.turnDuration,
    lastMove: game.lastMove,
  });
}

function deserializeGame(data: string): Game {
  const obj = JSON.parse(data);
  const game = new Game(obj.maxWins, obj.turnDuration);
  game.board = obj.board;
  game.currentPlayer = obj.currentPlayer;
  game.status = obj.status;
  game.winner = obj.winner;
  game.lastPickedTile = obj.lastPickedTile;
  game.players = obj.players;
  game.hostSocketId = obj.hostSocketId;
  game.guestSocketId = obj.guestSocketId;
  game.hostToken = obj.hostToken;
  game.guestToken = obj.guestToken;
  game.nickRed = obj.nickRed || 'Красные';
  game.nickBlack = obj.nickBlack || 'Чёрные';
  game.scores = obj.scores;
  game.roundFinished = obj.roundFinished;
  game.seriesWinner = obj.seriesWinner;
  game.turnStartedAt = obj.turnStartedAt;
  game.turnDuration = obj.turnDuration;
  game.lastMove = obj.lastMove;
  return game;
}

export async function saveGame(roomId: string, game: Game): Promise<void> {
  const key = GAME_PREFIX + roomId;
  await dataClient.set(key, serializeGame(game));
  await dataClient.expire(key, GAME_TTL);
}

export async function loadGame(roomId: string): Promise<Game | null> {
  const key = GAME_PREFIX + roomId;
  const data = await dataClient.get(key);
  if (!data) return null;
  try {
    return deserializeGame(data);
  } catch (e) {
    console.error('Failed to deserialize game', roomId, e);
    return null;
  }
}

export async function deleteGame(roomId: string): Promise<void> {
  await dataClient.del(GAME_PREFIX + roomId);
}

export async function loadAllGames(): Promise<Map<string, Game>> {
  const games = new Map<string, Game>();
  const keys = await dataClient.keys(GAME_PREFIX + '*');
  for (const key of keys) {
    const roomId = key.replace(GAME_PREFIX, '');
    const game = await loadGame(roomId);
    if (game) {
      games.set(roomId, game);
    }
  }
  return games;
}