import { Server, Socket } from 'socket.io';
import { Game } from '../game/Game';
import { saveGame, deleteGame } from '../redis';
import { saveGameResult, getPlayerStats } from '../stats';
import { logger } from '../logger';
import crypto from 'crypto';
import { Winner } from '../game/types';

let games: Map<string, Game>;
const disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
const chatMessages: Map<string, { sender: string; text: string; timestamp: number }[]> = new Map();

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
    const opponentId = isHost ? game.guestSocketId : game.hostSocketId;
    if (opponentId) {
      opponentConnected = io.sockets.sockets.has(opponentId);
    }
  }

  const roomId = [...games.entries()].find(([, g]) => g === game)?.[0] || '';

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
  };
}

export function setupSocket(io: Server, loadedGames: Map<string, Game>) {
  // Санация загруженных игр: удаляем мёртвые сокеты и полностью пустые комнаты
  for (const [roomId, game] of loadedGames.entries()) {
    if (game.players.red && !io.sockets.sockets.has(game.players.red)) game.players.red = undefined;
    if (game.players.black && !io.sockets.sockets.has(game.players.black)) game.players.black = undefined;
    if (!game.players.red && !game.players.black) {
      loadedGames.delete(roomId);
      deleteGame(roomId);
      logger.info(`Removed empty room ${roomId} during startup`);
    }
  }
  games = loadedGames;

  io.on('connection', (socket: Socket) => {
    logger.info('User connected: ' + socket.id);

    // Создание комнаты
    socket.on('create_room', (data: { maxWins: number, nick: string }, callback) => {
      const validWins = [1, 3, 5];
      let maxWins = data.maxWins;
      if (!validWins.includes(maxWins)) maxWins = 1;
      const roomId = generateRoomCode();
      const game = new Game(maxWins);
      game.addPlayer(socket.id);
      game.nickRed = data.nick || 'Красные';
      game.nickBlack = 'Чёрные';

      const hostToken = generatePlayerToken();
      game.hostToken = hostToken;
      game.guestToken = null;

      game.setOnTimerExpired(() => {
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

    // Присоединение к комнате (теперь можно входить в любую, где есть свободный слот)
    socket.on('join_room', (data: { roomId: string, nick: string }, callback) => {
      const roomId = data.roomId.toUpperCase();
      const game = games.get(roomId);
      if (!game) {
        logger.warn(`Join attempt to non-existent room ${roomId}`);
        return callback({ error: 'Комната не найдена' });
      }

      // Автоматически чистим отключённые сокеты
      if (game.players.red && !io.sockets.sockets.has(game.players.red)) game.players.red = undefined;
      if (game.players.black && !io.sockets.sockets.has(game.players.black)) game.players.black = undefined;

      const canJoinAsRed = !game.players.red;
      const canJoinAsBlack = !game.players.black;
      if (!canJoinAsRed && !canJoinAsBlack) {
        return callback({ error: 'Комната полна' });
      }

      let role: 'red' | 'black';
      if (canJoinAsRed) {
        role = 'red';
        game.players.red = socket.id;
        game.hostSocketId = socket.id;
        game.hostToken = generatePlayerToken();
        game.nickRed = data.nick || 'Красные';
      } else {
        role = 'black';
        game.players.black = socket.id;
        game.guestSocketId = socket.id;
        game.guestToken = generatePlayerToken();
        game.nickBlack = data.nick || 'Чёрные';
      }

      // Если комната была в ожидании и теперь двое — начинаем
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
        sendPersonalGameState(io, game);
      }
    });

    // Переподключение
    socket.on('reconnect_room', (roomId: string, playerToken: string, callback) => {
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

    // Список комнат (показываем все, где есть свободный слот)
    socket.on('list_rooms', (callback) => {
      const rooms: any[] = [];
      for (const [roomId, game] of games.entries()) {
        if (!game.players.red || !game.players.black) {
          rooms.push({
            roomId,
            players: `${game.players.red ? 1 : 0}/2`,
            status: game.status,
            nickRed: game.nickRed || '???',
            nickBlack: game.nickBlack || '???',
          });
        }
      }
      logger.info(`Returning ${rooms.length} public rooms`);
      callback(rooms);
    });

    // Чат
    socket.on('chat_message', (roomId: string, text: string) => {
      const game = games.get(roomId);
      if (!game) return;
      const sender = game.players.red === socket.id ? game.nickRed : game.nickBlack;
      if (!chatMessages.has(roomId)) {
        chatMessages.set(roomId, []);
      }
      chatMessages.get(roomId)!.push({ sender, text, timestamp: Date.now() });
      if (chatMessages.get(roomId)!.length > 50) {
        chatMessages.set(roomId, chatMessages.get(roomId)!.slice(-50));
      }
      sendPersonalGameState(io, game);
    });

    // Профиль (теперь принимает любой идентификатор, чтобы показать хотя бы нули)
    socket.on('get_profile', (playerId: string, callback) => {
      if (!playerId) {
        callback({ games: 0, wins: 0, draws: 0, history: [] });
        return;
      }
      getPlayerStats(playerId).then(stats => callback(stats));
    });

    // Ход
    socket.on('move', (roomId: string, row: number, col: number, callback) => {
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Игра не найдена' });
      const success = game.makeMove(row, col, socket.id);
      if (!success) return callback({ error: 'Недопустимый ход' });

      logger.info(`Move in room ${roomId}: (${row}, ${col})`);
      saveGame(roomId, game);
      sendPersonalGameState(io, game);

      if (game.winner) {
        sendPersonalGameOver(io, game);
        if (game.seriesWinner || game.maxWins === 1) {
          let winner: 'host' | 'guest' | 'draw';
          if (game.seriesWinner) {
            winner = game.seriesWinner;
          } else if (game.winner === 'draw') {
            winner = 'draw';
          } else {
            winner = game.winner === 'red' ? 'host' : 'guest';
          }
          saveGameResult({
            roomId,
            winner,
            players: { host: game.hostToken!, guest: game.guestToken! },
            timestamp: Date.now(),
            maxWins: game.maxWins,
          });
          deleteGame(roomId);
        }
      }
      callback({ success: true });
    });

    // Продолжение серии
    socket.on('restart_round', (roomId: string, callback) => {
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Игра не найдена' });
      const started = game.voteRestart(socket.id);
      if (started) {
        saveGame(roomId, game);
        sendPersonalGameState(io, game);
        logger.info(`New round started in room ${roomId}`);
      }
      callback({ success: true });
    });

    // Полный сброс комнаты
    socket.on('reset_room', (roomId: string, callback) => {
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
      logger.info(`Player ${socket.id} forfeited in room ${roomId}`);
      if (game.seriesWinner || game.maxWins === 1) {
        const finalWinner: Winner = game.winner as Winner;
        let winner: 'host' | 'guest' | 'draw';
        if (game.seriesWinner) {
          winner = game.seriesWinner;
        } else if (finalWinner === 'draw') {
          winner = 'draw';
        } else {
          winner = finalWinner === 'red' ? 'host' : 'guest';
        }
        saveGameResult({
          roomId,
          winner,
          players: { host: game.hostToken!, guest: game.guestToken! },
          timestamp: Date.now(),
          maxWins: game.maxWins,
        });
        deleteGame(roomId);
      }
      callback({ success: true });
    });

    // Явный выход
    socket.on('leave_room', (roomId: string) => {
      const game = games.get(roomId);
      if (!game) return;
      const isRed = game.players.red === socket.id;
      const isBlack = game.players.black === socket.id;
      if (!isRed && !isBlack) return;
      logger.info(`Player ${socket.id} left room ${roomId}`);
      if (isRed) {
        game.players.red = undefined;
      } else {
        game.players.black = undefined;
      }
      if (!game.players.red && !game.players.black) {
        games.delete(roomId);
        deleteGame(roomId);
      } else {
        sendPersonalGameState(io, game);
        saveGame(roomId, game);
      }
    });

    // Отключение
    socket.on('disconnect', () => {
      logger.info('User disconnected: ' + socket.id);
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
                logger.info(`Room ${roomId}: auto-forfeit after timeout`);
                if (currentGame.seriesWinner || currentGame.maxWins === 1) {
                  const finalGameWinner: Winner = currentGame.winner as Winner;
                  let finalWinner: 'host' | 'guest' | 'draw';
                  if (currentGame.seriesWinner) {
                    finalWinner = currentGame.seriesWinner;
                  } else if (finalGameWinner === 'draw') {
                    finalWinner = 'draw';
                  } else {
                    finalWinner = finalGameWinner === 'red' ? 'host' : 'guest';
                  }
                  saveGameResult({
                    roomId,
                    winner: finalWinner,
                    players: { host: currentGame.hostToken!, guest: currentGame.guestToken! },
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