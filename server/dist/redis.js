"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subClient = exports.pubClient = void 0;
exports.saveGame = saveGame;
exports.loadGame = loadGame;
exports.deleteGame = deleteGame;
exports.loadAllGames = loadAllGames;
const ioredis_1 = __importDefault(require("ioredis"));
const Game_1 = require("./game/Game");
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
exports.pubClient = new ioredis_1.default(redisUrl);
exports.subClient = exports.pubClient.duplicate();
const dataClient = new ioredis_1.default(redisUrl);
const GAME_PREFIX = 'okiya:game:';
function serializeGame(game) {
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
        maxWins: game.maxWins,
        scores: game.scores,
        roundFinished: game.roundFinished,
        seriesWinner: game.seriesWinner,
        turnStartedAt: game.turnStartedAt,
        turnDuration: game.turnDuration,
        lastMove: game.lastMove,
    });
}
function deserializeGame(data) {
    const obj = JSON.parse(data);
    const game = new Game_1.Game(obj.maxWins, obj.turnDuration);
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
    game.scores = obj.scores;
    game.roundFinished = obj.roundFinished;
    game.seriesWinner = obj.seriesWinner;
    game.turnStartedAt = obj.turnStartedAt;
    game.turnDuration = obj.turnDuration;
    game.lastMove = obj.lastMove;
    return game;
}
async function saveGame(roomId, game) {
    const key = GAME_PREFIX + roomId;
    await dataClient.set(key, serializeGame(game));
}
async function loadGame(roomId) {
    const key = GAME_PREFIX + roomId;
    const data = await dataClient.get(key);
    if (!data)
        return null;
    try {
        return deserializeGame(data);
    }
    catch (e) {
        console.error('Failed to deserialize game', roomId, e);
        return null;
    }
}
async function deleteGame(roomId) {
    await dataClient.del(GAME_PREFIX + roomId);
}
async function loadAllGames() {
    const games = new Map();
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
