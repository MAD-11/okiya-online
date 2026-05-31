import Redis from 'ioredis';
import { Game } from './game/Game';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisOptions = {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis reconnecting, attempt ${times}, delay ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
};

export const pubClient = new Redis(redisUrl, redisOptions);
export const subClient = pubClient.duplicate();
export const dataClient = new Redis(redisUrl, redisOptions);
export const chatPublisher = new Redis(redisUrl, redisOptions);
export const chatSubscriber = chatPublisher.duplicate();

// Обработчики ошибок
const handleRedisError = (err: Error, name: string) => {
  logger.error(`Redis ${name} error:`, err);
};

pubClient.on('error', (err) => handleRedisError(err, 'pubClient'));
subClient.on('error', (err) => handleRedisError(err, 'subClient'));
dataClient.on('error', (err) => handleRedisError(err, 'dataClient'));
chatPublisher.on('error', (err) => handleRedisError(err, 'chatPublisher'));
chatSubscriber.on('error', (err) => handleRedisError(err, 'chatSubscriber'));

pubClient.on('connect', () => logger.info('Redis pubClient connected'));
subClient.on('connect', () => logger.info('Redis subClient connected'));
dataClient.on('connect', () => logger.info('Redis dataClient connected'));

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
    hostPlayerId: game.hostPlayerId,
    guestPlayerId: game.guestPlayerId,
    maxWins: game.maxWins,
    scores: game.scores,
    roundFinished: game.roundFinished,
    seriesWinner: game.seriesWinner,
    turnStartedAt: game.turnStartedAt,
    turnDuration: game.turnDuration,
    lastMove: game.lastMove,
    hostSkin: game.hostSkin,
    guestSkin: game.guestSkin,
    isPrivate: game.isPrivate,
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
  game.hostPlayerId = obj.hostPlayerId || '';
  game.guestPlayerId = obj.guestPlayerId || '';
  game.scores = obj.scores;
  game.roundFinished = obj.roundFinished;
  game.seriesWinner = obj.seriesWinner;
  game.turnStartedAt = obj.turnStartedAt;
  game.turnDuration = obj.turnDuration;
  game.lastMove = obj.lastMove;
  game.hostSkin = obj.hostSkin || 'sakura';
  game.guestSkin = obj.guestSkin || 'sakura';
  game.isPrivate = obj.isPrivate || false;
  return game;
}

export async function saveGame(roomId: string, game: Game): Promise<void> {
  try {
    const key = GAME_PREFIX + roomId;
    await dataClient.set(key, serializeGame(game));
    await dataClient.expire(key, GAME_TTL);
  } catch (err) {
    logger.error(`Failed to save game ${roomId}:`, err);
  }
}

export async function loadGame(roomId: string): Promise<Game | null> {
  try {
    const key = GAME_PREFIX + roomId;
    const data = await dataClient.get(key);
    if (!data) return null;
    return deserializeGame(data);
  } catch (err) {
    logger.error(`Failed to load game ${roomId}:`, err);
    return null;
  }
}

export async function deleteGame(roomId: string): Promise<void> {
  try {
    await dataClient.del(GAME_PREFIX + roomId);
  } catch (err) {
    logger.error(`Failed to delete game ${roomId}:`, err);
  }
}

export async function loadAllGames(): Promise<Map<string, Game>> {
  const games = new Map<string, Game>();
  let cursor = '0';
  try {
    do {
      const reply = await dataClient.scan(cursor, 'MATCH', GAME_PREFIX + '*', 'COUNT', 100);
      cursor = reply[0];
      const keys = reply[1];
      for (const key of keys) {
        const roomId = key.replace(GAME_PREFIX, '');
        const game = await loadGame(roomId);
        if (game) {
          game.roomId = roomId;
          games.set(roomId, game);
        }
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.error('Failed to load all games:', err);
  }
  return games;
}

export async function closeRedisConnections(): Promise<void> {
  await Promise.all([
    pubClient.quit(),
    subClient.quit(),
    dataClient.quit(),
    chatPublisher.quit(),
    chatSubscriber.quit(),
  ]);
}