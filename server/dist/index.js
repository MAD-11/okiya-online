"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const handler_1 = require("./socket/handler");
const redis_1 = require("./redis");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigin,
        methods: ['GET', 'POST'],
    },
});
// Подключаем Redis Adapter для масштабирования
io.adapter((0, redis_adapter_1.createAdapter)(redis_1.pubClient, redis_1.subClient));
// Загружаем сохранённые игры перед подключением клиентов
async function start() {
    const savedGames = await (0, redis_1.loadAllGames)();
    console.log(`Loaded ${savedGames.size} games from Redis`);
    // Передаём сохранённые игры в обработчики
    (0, handler_1.setupSocket)(io, savedGames); // передадим Map с играми
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
start().catch(console.error);
