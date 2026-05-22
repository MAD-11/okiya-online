import { Server, Socket } from 'socket.io';
import { Game } from '../game/Game';
import { saveGame, deleteGame } from '../redis';
import crypto from 'crypto';

let games: Map<string, Game>;

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generatePlayerToken(): string {
  return crypto.randomBytes(8).toString('hex');
}

function getClientGameState(game: Game, playerSocketId?: string) {
  const isHost = playerSocketId === game.hostSocketId;
  const myScore = isHost ? game.scores.host : game.scores.guest;
  const opponentScore = isHost ? game.scores.guest : game.scores.host;

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

      callback({
        roomId,
        playerToken: hostToken,
        state: getClientGameState(game, socket.id)
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
      callback({
        playerToken: guestToken,
        state: getClientGameState(game, socket.id)
      });

      saveGame(roomId, game);

      const redSocket = io.sockets.sockets.get(game.players.red!);
      const blackSocket = io.sockets.sockets.get(game.players.black!);
      if (redSocket) redSocket.emit('game_started', getClientGameState(game, game.players.red));
      if (blackSocket) blackSocket.emit('game_started', getClientGameState(game, game.players.black));
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
        if (game.players.red === game.hostSocketId) game.players.red = socket.id;
        else if (game.players.black === game.hostSocketId) game.players.black = socket.id;
        game.hostSocketId = socket.id;
      } else {
        if (game.players.red === game.guestSocketId) game.players.red = socket.id;
        else if (game.players.black === game.guestSocketId) game.players.black = socket.id;
        game.guestSocketId = socket.id;
      }

      socket.join(roomId);
      socket.emit('game_state', getClientGameState(game, socket.id));

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

      saveGame(roomId, game);
      sendPersonalGameState(io, game);

      if (game.winner) {
        sendPersonalGameOver(io, game);
        if (game.seriesWinner || game.maxWins === 1) {
          // Серия завершена — удаляем из Redis
          deleteGame(roomId);
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
      }
      callback({ success: true });
    });

        // Полный сброс комнаты (новая игра в той же комнате)
    const resetVotes = new Map<string, Set<string>>();
    socket.on('reset_room', (roomId: string, callback) => {
      const game = games.get(roomId);
      if (!game) return callback({ error: 'Комната не найдена' });

      // Только хост или гость могут инициировать сброс
      if (socket.id !== game.hostSocketId && socket.id !== game.guestSocketId) {
        return callback({ error: 'Вы не участник этой комнаты' });
      }

      if (!resetVotes.has(roomId)) {
        resetVotes.set(roomId, new Set());
      }
      const votes = resetVotes.get(roomId)!;
      votes.add(socket.id);

      if (votes.size === 2) {
        // Оба игрока согласны – создаём новую игру с теми же токенами и игроками
        const newGame = new Game(game.maxWins, game.turnDuration);
        newGame.hostSocketId = game.hostSocketId;
        newGame.guestSocketId = game.guestSocketId;
        // Приводим типы: players ожидает string | undefined, а у нас string | null
        newGame.players.red = game.hostSocketId ?? undefined;
        newGame.players.black = game.guestSocketId ?? undefined;
        newGame.hostToken = game.hostToken;
        newGame.guestToken = game.guestToken;
        newGame.status = 'playing'; // оба игрока уже подключены
        newGame.setOnTimerExpired(() => {
          newGame.skipTurn();
          sendPersonalGameState(io, newGame);
          if (newGame.winner) {
            sendPersonalGameOver(io, newGame);
          }
          saveGame(roomId, newGame);
        });
        games.set(roomId, newGame);
        saveGame(roomId, newGame);
        resetVotes.delete(roomId);

        // Оповещаем обоих
        sendPersonalGameState(io, newGame);
        callback({ success: true });
      } else {
        callback({ success: true }); // голос принят, ждём второго
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
}

function sendPersonalGameState(io: Server, game: Game) {
  const redSocket = io.sockets.sockets.get(game.players.red!);
  const blackSocket = io.sockets.sockets.get(game.players.black!);
  if (redSocket) redSocket.emit('game_state', getClientGameState(game, game.players.red));
  if (blackSocket) blackSocket.emit('game_state', getClientGameState(game, game.players.black));
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