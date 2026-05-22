import Redis from 'ioredis';
import { Game } from './game/Game';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Клиент для pub/sub и хранения состояния
export const pubClient = new Redis(redisUrl);
export const subClient = pubClient.duplicate(); // дубликат для подписки

// Клиент для хранения данных (можно использовать тот же pubClient, но для ясности отдельный)
const dataClient = new Redis(redisUrl);

const GAME_PREFIX = 'okiya:game:';

/**
 * Сериализует объект Game в JSON-строку для сохранения в Redis.
 * Сохраняем только поля, необходимые для восстановления.
 */
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
    maxWins: game.maxWins,
    scores: game.scores,
    roundFinished: game.roundFinished,
    seriesWinner: game.seriesWinner,
    turnStartedAt: game.turnStartedAt,
    turnDuration: game.turnDuration,
    lastMove: game.lastMove,
  });
}

/**
 * Восстанавливает объект Game из JSON-строки, полученной из Redis.
 */
function deserializeGame(data: string): Game {
  const obj = JSON.parse(data);
  const game = new Game(obj.maxWins, obj.turnDuration);
  // Восстанавливаем поля вручную, чтобы сохранить приватные методы и таймеры
  game.board = obj.board;
  game.currentPlayer = obj.currentPlayer;
  game.status = obj.status;
  game.winner = obj.winner;
  game.lastPickedTile = obj.lastPickedTile;
  game.players = obj.players;
  game.hostSocketId = obj.hostSocketId;
  game.guestSocketId = obj.guestSocketId;
  game.scores = obj.scores;
  game.roundFinished = obj.roundFinished;
  game.seriesWinner = obj.seriesWinner;
  game.turnStartedAt = obj.turnStartedAt;
  game.turnDuration = obj.turnDuration;
  game.lastMove = obj.lastMove;
  // Примечание: таймер при восстановлении не запускается, он запустится после первого хода.
  // Если игра была в статусе playing, нужно перезапустить таймер после восстановления (см. handler).
  return game;
}

// Сохранить игру
export async function saveGame(roomId: string, game: Game): Promise<void> {
  const key = GAME_PREFIX + roomId;
  await dataClient.set(key, serializeGame(game));
}

// Загрузить игру (возвращает null, если не найдена)
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

// Удалить игру (при завершении серии или выходе игроков)
export async function deleteGame(roomId: string): Promise<void> {
  await dataClient.del(GAME_PREFIX + roomId);
}

// Загрузить все активные игры (используется при старте сервера)
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