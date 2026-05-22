"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocket = setupSocket;
const Game_1 = require("../game/Game");
const games = new Map();
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}
function getClientGameState(game, playerSocketId) {
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
function setupSocket(io) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);
        socket.on('create_room', (maxWins, callback) => {
            const validWins = [1, 3, 5];
            if (!validWins.includes(maxWins))
                maxWins = 1;
            const roomId = generateRoomCode();
            const game = new Game_1.Game(maxWins);
            game.addPlayer(socket.id);
            game.setOnTimerExpired(() => {
                game.skipTurn();
                sendPersonalGameState(io, game);
                if (game.winner) {
                    sendPersonalGameOver(io, game);
                }
            });
            games.set(roomId, game);
            socket.join(roomId);
            callback({ roomId, state: getClientGameState(game, socket.id) });
        });
        socket.on('join_room', (roomId, callback) => {
            const game = games.get(roomId);
            if (!game || game.status !== 'waiting') {
                return callback({ error: 'Комната не найдена или игра уже началась' });
            }
            const added = game.addPlayer(socket.id);
            if (!added)
                return callback({ error: 'Комната полна' });
            socket.join(roomId);
            callback({ state: getClientGameState(game, socket.id) });
            const redSocket = io.sockets.sockets.get(game.players.red);
            const blackSocket = io.sockets.sockets.get(game.players.black);
            if (redSocket)
                redSocket.emit('game_started', getClientGameState(game, game.players.red));
            if (blackSocket)
                blackSocket.emit('game_started', getClientGameState(game, game.players.black));
        });
        socket.on('move', (roomId, row, col, callback) => {
            const game = games.get(roomId);
            if (!game)
                return callback({ error: 'Игра не найдена' });
            const success = game.makeMove(row, col, socket.id);
            if (!success)
                return callback({ error: 'Недопустимый ход' });
            sendPersonalGameState(io, game);
            if (game.winner) {
                sendPersonalGameOver(io, game);
            }
            callback({ success: true });
        });
        socket.on('restart_round', (roomId, callback) => {
            const game = games.get(roomId);
            if (!game)
                return callback({ error: 'Игра не найдена' });
            const started = game.voteRestart(socket.id);
            if (started) {
                sendPersonalGameState(io, game);
            }
            callback({ success: true });
        });
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
}
function sendPersonalGameState(io, game) {
    const redSocket = io.sockets.sockets.get(game.players.red);
    const blackSocket = io.sockets.sockets.get(game.players.black);
    if (redSocket)
        redSocket.emit('game_state', getClientGameState(game, game.players.red));
    if (blackSocket)
        blackSocket.emit('game_state', getClientGameState(game, game.players.black));
}
function sendPersonalGameOver(io, game) {
    const redSocket = io.sockets.sockets.get(game.players.red);
    const blackSocket = io.sockets.sockets.get(game.players.black);
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
    if (redSocket)
        redSocket.emit('game_over', dataRed);
    if (blackSocket)
        blackSocket.emit('game_over', dataBlack);
}
