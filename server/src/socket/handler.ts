import { Server, Socket } from 'socket.io';
import { Game } from '../game/Game';
import { saveGame, deleteGame } from '../redis';
import crypto from 'crypto';

let games: Map<string, Game>;
// Для автоматического завершения при длительном отключении
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

  // Проверяем, подключён ли соперник в данный момент
  let opponentConnected = false;
  if (io && playerSocketId) {
    const opponentId = isHost ? game.guestSocketId : game.hostSocketId;
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
      ? game.players.red === playerSocketId
        ? 'red'
        : 'black'
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
    opponentConnected, // новое поле
  };
}

export function setupSocket(io: Server, loadedGames: Map<string, Game>) {
  games = loadedGames;

  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    // Создание комнаты
    socket.on('create_room', (maxWins: number, callback) => {
      const validWins = [1, 3, 5];
      if (!validWins.includes(maxWins)) maxWins = 1;
      const roomId = generateRoomCode();
      const game = new Game(maxWins);
      game.addPlayer(socket.id);

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
      console.log(`Room ${roomId} created by host ${socket.id}`);

      callback({
        roomId,
        playerToken: hostToken,
        state: getClientGameState(game, socket.id, io)
      });
    });

    // Присоединение к комнате
    socket.on('join_room', (roomId: string, callback) => {
      const game = games.get(roomId);
      if (!game || game.status !== 'waiting') {
        return callback({ error: 'Комната не найдена или игра уже началась' });
      }
      const added = game.addPlayer(socket.id);
      if (!added) return callback({ error: 'Комната полна' });

      const guestToken = generatePlayerToken();
      game.guestToken = guestToken;

      socket.join(roomId);
      console.log(`Guest ${socket.id} joined room ${roomId}`);

      // Очищаем таймер авто-завершения, если соперник вернулся
      const timerKey = `${roomId}_${socket.id}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey)!);
        disconnectTimers.delete(timerKey);
      }

      callback({
        playerToken: guestToken,
        state: getClientGameState(game, socket.id, io)
      });

      saveGame(roomId, game);

      const redSocket = io.sockets.sockets.get(game.players.red!);
      const blackSocket = io.sockets.sockets.get(game.players.black!);
      if (redSocket) redSocket.emit('game_started', getClientGameState(game, game.players.red, io));
      if (blackSocket) blackSocket.emit('game_started', getClientGameState(game, game.players.black, io));
    });

    // Переподключение
    socket.on('reconnect_room', (roomId: string, playerToken: string, callback) => {
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Комната не найдена' });

      let role: 'host' | 'guest' | null = null;
      if (game.hostToken === playerToken) role = 'host';
      else if (game.guestToken === playerToken) role = 'guest';
      if (!role) return callback({ error: 'Неверный токен' });

      // Обновляем сокеты
      if (role === 'host') {
        if (game.players.red === game.hostSocketId) game.players.red = socket.id;
        else if (game.players.black === game.hostSocketId) game.players.black = socket.id;
        game.hostSocketId = socket.id;
      } else {
        if (game.players.red === game.guestSocketId) game.players.red = socket.id;
        else if (game.players.black === game.guestSocketId) game.players.black = socket.id;
        game.guestSocketId = socket.id;
      }

      socket.join(roomId);
      console.log(`Player ${role} reconnected to room ${roomId}`);

      // Очищаем таймер авто-завершения для этого игрока
      const timerKey = `${roomId}_${socket.id}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey)!);
        disconnectTimers.delete(timerKey);
      }

      socket.emit('game_state', getClientGameState(game, socket.id, io));

      if (game.status === 'playing' && game.players.red && game.players.black) {
        game.turnStartedAt = Date.now();
      }
      saveGame(roomId, game);
      callback({ success: true });
    });

    // Ход
    socket.on('move', (roomId: string, row: number, col: number, callback) => {
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Игра не найдена' });
      const success = game.makeMove(row, col, socket.id);
      if (!success) return callback({ error: 'Недопустимый ход' });

      console.log(`Move in room ${roomId}: ${socket.id} placed at (${row}, ${col})`);
      saveGame(roomId, game);
      sendPersonalGameState(io, game);

      if (game.winner) {
        sendPersonalGameOver(io, game);
        if (game.seriesWinner || game.maxWins === 1) {
          deleteGame(roomId);
          console.log(`Game in room ${roomId} finished, removed from Redis`);
        }
      }
      callback({ success: true });
    });

    // Продолжение серии (ещё одна игра)
    socket.on('restart_round', (roomId: string, callback) => {
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Игра не найдена' });
      const started = game.voteRestart(socket.id);
      if (started) {
        saveGame(roomId, game);
        sendPersonalGameState(io, game);
        console.log(`New round started in room ${roomId}`);
      }
      callback({ success: true });
    });

    // Полный сброс комнаты (новая игра в той же комнате)
    socket.on('reset_room', (roomId: string, callback) => {
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Комната не найдена' });

      const success = game.voteReset(socket.id);
      if (success) {
        saveGame(roomId, game);
        sendPersonalGameState(io, game);
        console.log(`Room ${roomId} fully reset`);
      }
      callback({ success: true });
    });

    // Сдаться
    socket.on('forfeit', (roomId: string, callback) => {
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Игра не найдена' });
      if (game.status !== 'playing') return callback({ error: 'Игра не активна' });

      const playerColor = game.players.red === socket.id ? 'red' : 'black';
      if (playerColor !== game.currentPlayer && game.currentPlayer !== undefined) {
        // Можно сдаться только в свой ход, но для удобства разрешим в любой момент
      }

      const opponent = playerColor === 'red' ? 'black' : 'red';
      game.winner = opponent;
      game.handleGameOver();
      saveGame(roomId, game);
      sendPersonalGameState(io, game);
      sendPersonalGameOver(io, game);
      console.log(`Player ${socket.id} forfeited in room ${roomId}`);
      if (game.seriesWinner || game.maxWins === 1) {
        deleteGame(roomId);
      }
      callback({ success: true });
    });

    // Отключение
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Проверяем все игры, где участвовал этот сокет
      for (const [roomId, game] of games.entries()) {
        if (game.hostSocketId === socket.id || game.guestSocketId === socket.id) {
          const isHost = game.hostSocketId === socket.id;
          const opponentSocketId = isHost ? game.guestSocketId : game.hostSocketId;

          // Если оба отключены, удаляем игру
          if (!opponentSocketId || !io.sockets.sockets.has(opponentSocketId)) {
            // Второй игрок тоже не в сети - удаляем игру
            games.delete(roomId);
            deleteGame(roomId);
            console.log(`Room ${roomId} deleted because both players disconnected`);
          } else {
            // Запускаем таймер на 60 секунд для автоматического завершения
            const timerKey = `${roomId}_${socket.id}`;
            const timer = setTimeout(() => {
              const currentGame = games.get(roomId);
              if (currentGame && currentGame.status === 'playing') {
                // Проверяем, что отключившийся так и не вернулся
                if (currentGame.hostSocketId === socket.id || currentGame.guestSocketId === socket.id) {
                  const winner = isHost ? 'black' : 'red';
                  currentGame.winner = winner;
                  currentGame.handleGameOver();
                  saveGame(roomId, currentGame);
                  sendPersonalGameState(io, currentGame);
                  sendPersonalGameOver(io, currentGame);
                  console.log(`Room ${roomId}: auto-forfeit after timeout`);
                  if (currentGame.seriesWinner || currentGame.maxWins === 1) {
                    deleteGame(roomId);
                  }
                }
              }
              disconnectTimers.delete(timerKey);
            }, 60000); // 60 секунд

            disconnectTimers.set(timerKey, timer);
            console.log(`Started auto-forfeit timer for room ${roomId}, player ${socket.id}`);
          }
          break;
        }
      }
    });
  });
}

function sendPersonalGameState(io: Server, game: Game) {
  const redSocket = io.sockets.sockets.get(game.players.red!);
  const blackSocket = io.sockets.sockets.get(game.players.black!);
  if (redSocket) redSocket.emit('game_state', getClientGameState(game, game.players.red, io));
  if (blackSocket) blackSocket.emit('game_state', getClientGameState(game, game.players.black, io));
}

function sendPersonalGameOver(io: Server, game: Game) {
  const redSocket = io.sockets.sockets.get(game.players.red!);
  const blackSocket = io.sockets.sockets.get(game.players.black!);

  const resultForRed = game.winner === 'red' ? 'win' : game.winner === 'draw' ? 'draw' : 'lose';
  const resultForBlack = game.winner === 'black' ? 'win' : game.winner === 'draw' ? 'draw' : 'lose';

  const dataRed = {
    winner: game.winner,
    yourResult: resultForRed,
    seriesWinner: game.seriesWinner,
  };
  const dataBlack = {
    winner: game.winner,
    yourResult: resultForBlack,
    seriesWinner: game.seriesWinner,
  };

  if (redSocket) redSocket.emit('game_over', dataRed);
  if (blackSocket) blackSocket.emit('game_over', dataBlack);
}