import { Server, Socket } from 'socket.io';
import { Game } from '../game/Game';
import { saveGame, deleteGame } from '../redis';
import { saveGameResult, getPlayerStats } from '../stats';
import { logger } from '../logger';
import crypto from 'crypto';

let games: Map<string, Game>;
const disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

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
  };
}

export function setupSocket(io: Server, loadedGames: Map<string, Game>) {
  games = loadedGames;

  io.on('connection', (socket: Socket) => {
    logger.info('User connected: ' + socket.id);

    // Создание комнаты
    socket.on('create_room', (data: { maxWins: number; playerId: string; nick: string }, callback) => {
      logger.info(`create_room from ${socket.id} with maxWins: ${data.maxWins}, playerId: ${data.playerId}, nick: ${data.nick}`);
      const validWins = [1, 3, 5];
      let maxWins = data.maxWins;
      if (!validWins.includes(maxWins)) maxWins = 1;
      const roomId = generateRoomCode();
      const game = new Game(maxWins);
      game.addPlayer(socket.id);
      game.nickRed = data.nick || 'Красные';
      game.nickBlack = 'Чёрные';
      game.hostPlayerId = data.playerId;
      game.guestPlayerId = ''; // будет заполнен при входе гостя

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
      logger.info(`join_room from ${socket.id} for room ${data.roomId}, playerId: ${data.playerId}, nick: ${data.nick}`);
      const roomId = data.roomId.toUpperCase();
      const game = games.get(roomId);
      if (!game) {
        logger.warn(`Room ${roomId} not found`);
        return callback({ error: 'Комната не найдена' });
      }

      // Чистим мёртвые сокеты
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
        game.nickRed = data.nick || 'Красные';
        game.hostPlayerId = data.playerId;
      } else {
        role = 'black';
        game.players.black = socket.id;
        game.guestSocketId = socket.id;
        game.guestToken = generatePlayerToken();
        game.nickBlack = data.nick || 'Чёрные';
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
        logger.info(`Sending game_state to both in room ${roomId}`);
        sendPersonalGameState(io, game);
      }
    });

    // Переподключение
    socket.on('reconnect_room', (roomId: string, playerToken: string, callback) => {
      logger.info(`reconnect_room from ${socket.id} to ${roomId}`);
      const game = games.get(roomId);
      if (!game) {
        logger.warn(`Room ${roomId} not found for reconnect`);
        return callback({ error: 'Комната не найдена' });
      }

      let role: 'host' | 'guest' | null = null;
      if (game.hostToken === playerToken) role = 'host';
      else if (game.guestToken === playerToken) role = 'guest';
      if (!role) {
        logger.warn(`Invalid token ${playerToken} for room ${roomId}`);
        return callback({ error: 'Неверный токен' });
      }

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

    // Ход
    socket.on('move', (roomId: string, row: number, col: number, callback) => {
      logger.info(`move from ${socket.id} in ${roomId} (${row},${col})`);
      const game = games.get(roomId);
      if (!game) {
        logger.warn(`Room ${roomId} not found for move`);
        return callback({ error: 'Игра не найдена' });
      }
      const success = game.makeMove(row, col, socket.id);
      if (!success) {
        logger.warn(`Invalid move by ${socket.id}`);
        return callback({ error: 'Недопустимый ход' });
      }

      saveGame(roomId, game);
      sendPersonalGameState(io, game);

      if (game.winner) {
        sendPersonalGameOver(io, game);
        if (game.seriesWinner || game.maxWins === 1) {
          // Сохраняем статистику
          saveGameResult({
            roomId,
            winner: game.seriesWinner || (game.winner === 'draw' ? 'draw' : game.winner === 'red' ? 'host' : 'guest'),
            players: { host: game.hostPlayerId, guest: game.guestPlayerId },
            timestamp: Date.now(),
            maxWins: game.maxWins,
          });
          deleteGame(roomId);
        }
      }
      callback({ success: true });
    });

    // Продолжение серии (ещё одна игра)
    socket.on('restart_round', (roomId: string, callback) => {
      logger.info(`restart_round from ${socket.id} in ${roomId}`);
      const game = games.get(roomId);
      if (!game) {
        logger.warn(`Room ${roomId} not found for restart`);
        return callback({ error: 'Игра не найдена' });
      }
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
      if (!game) {
        logger.warn(`Room ${roomId} not found for reset`);
        return callback({ error: 'Игра не найдена' });
      }
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
      if (!game) {
        logger.warn(`Room ${roomId} not found for forfeit`);
        return callback({ error: 'Игра не найдена' });
      }
      if (game.status !== 'playing') {
        logger.warn(`Game not active in ${roomId}`);
        return callback({ error: 'Игра не активна' });
      }

      const playerColor = game.players.red === socket.id ? 'red' : 'black';
      const opponent = playerColor === 'red' ? 'black' : 'red';
      game.winner = opponent;
      game.handleGameOver();
      saveGame(roomId, game);
      sendPersonalGameState(io, game);
      sendPersonalGameOver(io, game);
      logger.info(`Player ${socket.id} forfeited, winner: ${opponent}`);
      if (game.seriesWinner || game.maxWins === 1) {
        // Сохраняем статистику
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
      if (!game) {
        logger.warn(`Room ${roomId} not found for leave`);
        return;
      }
      const isRed = game.players.red === socket.id;
      const isBlack = game.players.black === socket.id;
      if (!isRed && !isBlack) {
        logger.warn(`Socket ${socket.id} not in room ${roomId}`);
        return;
      }
      if (isRed) game.players.red = undefined;
      else game.players.black = undefined;

      if (!game.players.red && !game.players.black) {
        games.delete(roomId);
        deleteGame(roomId);
        logger.info(`Room ${roomId} deleted (empty)`);
      } else {
        sendPersonalGameState(io, game);
        saveGame(roomId, game);
      }
    });

    // Отключение
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
                  // Сохраняем статистику
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