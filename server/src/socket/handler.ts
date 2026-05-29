import { Server, Socket } from 'socket.io';
import { Game } from '../game/Game';
import { saveGame, deleteGame, chatPublisher, chatSubscriber } from '../redis';
import { saveGameResult, getPlayerStats } from '../stats';
import { logger } from '../logger';
import crypto from 'crypto';
import { Mutex } from 'async-mutex';
import { z } from 'zod';

function sanitize(str: string): string {
  return str.replace(/[<>]/g, '').slice(0, 200);
}

const MoveSchema = z.object({
  roomId: z.string().length(4).regex(/^[A-Z0-9]+$/),
  row: z.number().int().min(0).max(3),
  col: z.number().int().min(0).max(3),
});

const JoinRoomSchema = z.object({
  roomId: z.string().length(4).regex(/^[A-Z0-9]+$/),
  playerId: z.string().min(1),
  nick: z.string().max(12),
});

let games: Map<string, Game>;
const disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
const chatMessages: Map<string, { sender: string; text: string; timestamp: number }[]> = new Map();
const roomMutexes = new Map<string, Mutex>();

function getRoomMutex(roomId: string): Mutex {
  if (!roomMutexes.has(roomId)) {
    roomMutexes.set(roomId, new Mutex());
  }
  return roomMutexes.get(roomId)!;
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generatePlayerToken(): string {
  return crypto.randomBytes(8).toString('hex');
}

function getClientGameState(game: Game, playerSocketId?: string, io?: Server) {
  const isHost = playerSocketId === game.hostSocketId;
  const myScore = isHost ? game.scores.host : game.scores.guest;
  const opponentScore = isHost ? game.scores.guest : game.scores.host;

  let opponentConnected = false;
  if (io && playerSocketId) {
    const isRed = game.players.red === playerSocketId;
    const opponentId = isRed ? game.players.black : game.players.red;
    if (opponentId) {
      opponentConnected = io.sockets.sockets.has(opponentId);
    }
  }

  const roomId = game.roomId || '';

  return {
    board: game.board,
    currentPlayer: game.currentPlayer,
    status: game.status,
    winner: game.winner,
    lastPickedTile: game.lastPickedTile,
    myColor: playerSocketId
      ? game.players.red === playerSocketId ? 'red' : 'black'
      : null,
    myScore,
    opponentScore,
    maxWins: game.maxWins,
    roundFinished: game.roundFinished,
    seriesWinner: game.seriesWinner,
    isHost: playerSocketId === game.hostSocketId,
    turnStartedAt: game.turnStartedAt,
    turnDuration: game.turnDuration,
    lastMove: game.lastMove,
    opponentConnected,
    nickRed: game.nickRed,
    nickBlack: game.nickBlack,
    myNick: playerSocketId === game.hostSocketId ? game.nickRed : (playerSocketId === game.guestSocketId ? game.nickBlack : ''),
    messages: chatMessages.get(roomId) || [],
    hostSkin: game.hostSkin,
  };
}

function cleanupRoomTimers(roomId: string) {
  for (const [key, timer] of disconnectTimers.entries()) {
    if (key.startsWith(roomId)) {
      clearTimeout(timer);
      disconnectTimers.delete(key);
    }
  }
}

// Подписка на чат через Redis (для масштабирования)
chatSubscriber.subscribe('chat');
chatSubscriber.on('message', (channel, message) => {
  try {
    const { roomId, msg } = JSON.parse(message);
    const io = (global as any).io;
    if (io) {
      io.to(roomId).emit('chat_message', msg);
    }
  } catch (e) {}
});

export function setupSocket(io: Server, loadedGames: Map<string, Game>) {
  games = loadedGames;
  (global as any).io = io;

  io.on('connection', (socket: Socket) => {
    logger.info('User connected: ' + socket.id);

    // Создание комнаты
    socket.on('create_room', (data: { maxWins: number; playerId: string; nick: string; skin?: string }, callback) => {
      const nick = sanitize(data.nick || 'Игрок').slice(0, 12);
      logger.info(`create_room from ${socket.id} with maxWins: ${data.maxWins}, playerId: ${data.playerId}, nick: ${nick}, skin: ${data.skin}`);
      const validWins = [1, 3, 5];
      let maxWins = data.maxWins;
      if (!validWins.includes(maxWins)) maxWins = 1;
      const roomId = generateRoomCode();
      const game = new Game(maxWins);
      game.roomId = roomId;
      game.addPlayer(socket.id);
      game.nickRed = nick;
      game.nickBlack = 'Чёрные';
      game.hostPlayerId = data.playerId;
      game.guestPlayerId = '';
      game.hostSkin = data.skin || 'sakura';

      const hostToken = generatePlayerToken();
      game.hostToken = hostToken;
      game.guestToken = null;

      game.setOnTimerExpired(() => {
        logger.info(`Timer expired in room ${roomId}`);
        game.skipTurn();
        sendPersonalGameState(io, game);
        if (game.winner) {
          sendPersonalGameOver(io, game);
        }
        saveGame(roomId, game);
      });

      games.set(roomId, game);
      socket.join(roomId);
      saveGame(roomId, game);
      logger.info(`Room ${roomId} created by host ${socket.id}`);

      callback({
        roomId,
        playerToken: hostToken,
        state: getClientGameState(game, socket.id, io)
      });
    });

    // Присоединение к комнате
    socket.on('join_room', (data: { roomId: string; playerId: string; nick: string }, callback) => {
      const validation = JoinRoomSchema.safeParse(data);
      if (!validation.success) {
        return callback({ error: 'Некорректные данные' });
      }
      const roomId = data.roomId.toUpperCase();
      const nick = sanitize(data.nick || 'Игрок').slice(0, 12);
      logger.info(`join_room from ${socket.id} for room ${roomId}, playerId: ${data.playerId}, nick: ${nick}`);

      const game = games.get(roomId);
      if (!game) {
        logger.warn(`Room ${roomId} not found`);
        return callback({ error: 'Комната не найдена' });
      }

      if (game.players.red && !io.sockets.sockets.has(game.players.red)) game.players.red = undefined;
      if (game.players.black && !io.sockets.sockets.has(game.players.black)) game.players.black = undefined;

      const canJoinAsRed = !game.players.red;
      const canJoinAsBlack = !game.players.black;
      if (!canJoinAsRed && !canJoinAsBlack) {
        logger.warn(`Room ${roomId} full`);
        return callback({ error: 'Комната полна' });
      }

      let role: 'red' | 'black';
      if (canJoinAsRed) {
        role = 'red';
        game.players.red = socket.id;
        game.hostSocketId = socket.id;
        game.hostToken = generatePlayerToken();
        game.nickRed = nick;
        game.hostPlayerId = data.playerId;
      } else {
        role = 'black';
        game.players.black = socket.id;
        game.guestSocketId = socket.id;
        game.guestToken = generatePlayerToken();
        game.nickBlack = nick;
        game.guestPlayerId = data.playerId;
      }

      if (game.players.red && game.players.black && game.status === 'waiting') {
        game.status = 'playing';
        game.turnStartedAt = Date.now();
      } else if (game.players.red && game.players.black && game.status !== 'playing') {
        game.turnStartedAt = Date.now();
      }

      socket.join(roomId);
      logger.info(`Player ${socket.id} joined room ${roomId} as ${role}`);

      const playerToken = role === 'red' ? game.hostToken : game.guestToken;
      callback({ playerToken, state: getClientGameState(game, socket.id, io) });
      saveGame(roomId, game);

      if (game.players.red && game.players.black) {
        io.to(roomId).emit('opponent_joined', {
          nick1: game.nickRed,
          nick2: game.nickBlack,
        });
        sendPersonalGameState(io, game);
      }
    });

    // Переподключение
    socket.on('reconnect_room', (roomId: string, playerToken: string, callback) => {
      logger.info(`reconnect_room from ${socket.id} to ${roomId}`);
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Комната не найдена' });

      let role: 'host' | 'guest' | null = null;
      if (game.hostToken === playerToken) role = 'host';
      else if (game.guestToken === playerToken) role = 'guest';
      if (!role) return callback({ error: 'Неверный токен' });

      if (role === 'host') {
        game.players.red = socket.id;
        game.hostSocketId = socket.id;
      } else {
        game.players.black = socket.id;
        game.guestSocketId = socket.id;
      }

      socket.join(roomId);
      logger.info(`Player ${socket.id} reconnected to room ${roomId} as ${role}`);

      const timerKey = `${roomId}_${socket.id}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey)!);
        disconnectTimers.delete(timerKey);
      }

      socket.emit('game_state', getClientGameState(game, socket.id, io));
      saveGame(roomId, game);
      callback({ success: true });
    });

    // Ход с мьютексом
    socket.on('move', async (roomId: string, row: number, col: number, callback) => {
      const validation = MoveSchema.safeParse({ roomId, row, col });
      if (!validation.success) {
        return callback({ error: 'Недопустимые координаты' });
      }
      const mutex = getRoomMutex(roomId);
      const release = await mutex.acquire();
      try {
        logger.info(`move from ${socket.id} in ${roomId} (${row},${col})`);
        const game = games.get(roomId);
        if (!game) return callback({ error: 'Игра не найдена' });
        const success = game.makeMove(row, col, socket.id);
        if (!success) return callback({ error: 'Недопустимый ход' });

        await saveGame(roomId, game);
        sendPersonalGameState(io, game);

        if (game.winner) {
          sendPersonalGameOver(io, game);
          if (game.seriesWinner || game.maxWins === 1) {
            await saveGameResult({
              roomId,
              winner: game.seriesWinner || (game.winner === 'draw' ? 'draw' : game.winner === 'red' ? 'host' : 'guest'),
              players: { host: game.hostPlayerId, guest: game.guestPlayerId },
              timestamp: Date.now(),
              maxWins: game.maxWins,
            });
            await deleteGame(roomId);
          }
        }
        callback({ success: true });
      } finally {
        release();
      }
    });

    // Продолжение серии
    socket.on('restart_round', (roomId: string, callback) => {
      logger.info(`restart_round from ${socket.id} in ${roomId}`);
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Игра не найдена' });
      const started = game.voteRestart(socket.id);
      if (started) {
        saveGame(roomId, game);
        sendPersonalGameState(io, game);
        logger.info(`New round in ${roomId}`);
      }
      callback({ success: true });
    });

    // Полный сброс комнаты
    socket.on('reset_room', (roomId: string, callback) => {
      logger.info(`reset_room from ${socket.id} in ${roomId}`);
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Игра не найдена' });
      const success = game.voteReset(socket.id);
      if (success) {
        saveGame(roomId, game);
        sendPersonalGameState(io, game);
        logger.info(`Room ${roomId} fully reset`);
      }
      callback({ success: true });
    });

    // Сдаться
    socket.on('forfeit', (roomId: string, callback) => {
      logger.info(`forfeit from ${socket.id} in ${roomId}`);
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Игра не найдена' });
      if (game.status !== 'playing') return callback({ error: 'Игра не активна' });

      const playerColor = game.players.red === socket.id ? 'red' : 'black';
      const opponent = playerColor === 'red' ? 'black' : 'red';
      game.winner = opponent;
      game.handleGameOver();
      saveGame(roomId, game);
      sendPersonalGameState(io, game);
      sendPersonalGameOver(io, game);
      logger.info(`Player ${socket.id} forfeited, winner: ${opponent}`);
      if (game.seriesWinner || game.maxWins === 1) {
        saveGameResult({
          roomId,
          winner: game.seriesWinner || (game.winner === 'red' ? 'host' : 'guest'),
          players: { host: game.hostPlayerId, guest: game.guestPlayerId },
          timestamp: Date.now(),
          maxWins: game.maxWins,
        });
        deleteGame(roomId);
      }
      callback({ success: true });
    });

    // Явный выход
    socket.on('leave_room', (roomId: string) => {
      logger.info(`leave_room from ${socket.id} in ${roomId}`);
      const game = games.get(roomId);
      if (!game) return;
      const isRed = game.players.red === socket.id;
      const isBlack = game.players.black === socket.id;
      if (!isRed && !isBlack) return;

      const maxWins = game.maxWins;
      const hostSkin = game.hostSkin;
      const nickRed = game.nickRed;
      const nickBlack = game.nickBlack;
      const hostPlayerId = game.hostPlayerId;
      const guestPlayerId = game.guestPlayerId;

      if (isRed) game.players.red = undefined;
      else game.players.black = undefined;

      if (!game.players.red && !game.players.black) {
        cleanupRoomTimers(roomId);
        games.delete(roomId);
        deleteGame(roomId);
        logger.info(`Room ${roomId} deleted (empty)`);
      } else {
        const newGame = new Game(maxWins);
        newGame.roomId = roomId;
        newGame.hostSkin = hostSkin;
        newGame.nickRed = nickRed;
        newGame.nickBlack = nickBlack;
        newGame.hostPlayerId = hostPlayerId;
        newGame.guestPlayerId = guestPlayerId;

        const remainingSocketId = game.players.red || game.players.black!;
        newGame.addPlayer(remainingSocketId);
        newGame.hostToken = generatePlayerToken();
        newGame.guestToken = null;

        games.set(roomId, newGame);
        saveGame(roomId, newGame);
        const remainingSocket = io.sockets.sockets.get(remainingSocketId);
        if (remainingSocket) {
          remainingSocket.emit('game_state', getClientGameState(newGame, remainingSocketId, io));
        }
        logger.info(`Room ${roomId} restarted after player left`);
      }
    });

    // Отключение с очисткой таймеров
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.id}`);
      for (const [roomId, game] of games.entries()) {
        if (game.players.red === socket.id || game.players.black === socket.id) {
          sendPersonalGameState(io, game);
          const timerKey = `${roomId}_${socket.id}`;
          const timer = setTimeout(() => {
            const currentGame = games.get(roomId);
            if (currentGame && currentGame.status === 'playing') {
              if (currentGame.players.red === socket.id || currentGame.players.black === socket.id) {
                const winner = currentGame.players.red === socket.id ? 'black' : 'red';
                currentGame.winner = winner;
                currentGame.handleGameOver();
                saveGame(roomId, currentGame);
                sendPersonalGameState(io, currentGame);
                sendPersonalGameOver(io, currentGame);
                logger.info(`Room ${roomId}: auto-forfeit, winner: ${winner}`);
                if (currentGame.seriesWinner || currentGame.maxWins === 1) {
                  saveGameResult({
                    roomId,
                    winner: currentGame.seriesWinner || (currentGame.winner === 'red' ? 'host' : 'guest'),
                    players: { host: currentGame.hostPlayerId, guest: currentGame.guestPlayerId },
                    timestamp: Date.now(),
                    maxWins: currentGame.maxWins,
                  });
                  deleteGame(roomId);
                }
              }
            }
            disconnectTimers.delete(timerKey);
          }, 60000);
          disconnectTimers.set(timerKey, timer);
          break;
        }
      }
    });

    // Чат с ограничением и публикацией в Redis
    socket.on('chat_message', (roomId: string, text: string) => {
      let sanitizedText = sanitize(text).slice(0, 200);
      if (!sanitizedText) return;
      const game = games.get(roomId);
      if (!game) return;
      let sender = 'Игрок';
      if (socket.id === game.hostSocketId) {
        sender = game.nickRed;
      } else if (socket.id === game.guestSocketId) {
        sender = game.nickBlack;
      }
      const msg = { sender, text: sanitizedText, timestamp: Date.now() };
      if (!chatMessages.has(roomId)) {
        chatMessages.set(roomId, []);
      }
      chatMessages.get(roomId)!.push(msg);
      if (chatMessages.get(roomId)!.length > 50) {
        chatMessages.set(roomId, chatMessages.get(roomId)!.slice(-50));
      }
      chatPublisher.publish('chat', JSON.stringify({ roomId, msg }));
      sendPersonalGameState(io, game);
    });

    // Список открытых комнат
    socket.on('list_rooms', (callback) => {
      const rooms: any[] = [];
      for (const [roomId, game] of games.entries()) {
        if (game.players.red && !io.sockets.sockets.has(game.players.red)) game.players.red = undefined;
        if (game.players.black && !io.sockets.sockets.has(game.players.black)) game.players.black = undefined;

        if (!game.players.red || !game.players.black) {
          rooms.push({
            roomId,
            players: `${game.players.red ? 1 : 0}/2`,
            status: game.status,
            nickRed: game.players.red ? game.nickRed : 'ожидание',
            nickBlack: game.players.black ? game.nickBlack : 'ожидание',
          });
        }
      }
      logger.info(`Returning ${rooms.length} public rooms`);
      callback(rooms);
    });

    // Профиль
    socket.on('get_profile', (playerId: string, callback) => {
      logger.info(`get_profile from ${socket.id} for playerId: ${playerId}`);
      if (!playerId) {
        callback({ games: 0, wins: 0, draws: 0, history: [] });
        return;
      }
      getPlayerStats(playerId)
        .then((stats: any) => callback(stats))
        .catch((err: any) => {
          logger.error('get_profile error', err);
          callback({ games: 0, wins: 0, draws: 0, history: [] });
        });
    });
  });
}

function sendPersonalGameState(io: Server, game: Game) {
  const redId = game.players.red;
  const blackId = game.players.black;
  if (redId) {
    const redSocket = io.sockets.sockets.get(redId);
    if (redSocket) redSocket.emit('game_state', getClientGameState(game, redId, io));
  }
  if (blackId) {
    const blackSocket = io.sockets.sockets.get(blackId);
    if (blackSocket) blackSocket.emit('game_state', getClientGameState(game, blackId, io));
  }
}

function sendPersonalGameOver(io: Server, game: Game) {
  const redId = game.players.red;
  const blackId = game.players.black;

  const resultForRed = game.winner === 'red' ? 'win' : game.winner === 'draw' ? 'draw' : 'lose';
  const resultForBlack = game.winner === 'black' ? 'win' : game.winner === 'draw' ? 'draw' : 'lose';

  const dataRed = { winner: game.winner, yourResult: resultForRed, seriesWinner: game.seriesWinner };
  const dataBlack = { winner: game.winner, yourResult: resultForBlack, seriesWinner: game.seriesWinner };

  if (redId) {
    const redSocket = io.sockets.sockets.get(redId);
    if (redSocket) redSocket.emit('game_over', dataRed);
  }
  if (blackId) {
    const blackSocket = io.sockets.sockets.get(blackId);
    if (blackSocket) blackSocket.emit('game_over', dataBlack);
  }
}