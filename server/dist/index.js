"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const handler_1 = require("./socket/handler");
const logger_1 = require("./logger");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigin,
        methods: ['GET', 'POST'],
    },
});
async function start() {
    logger_1.logger.info('Starting server without Redis');
    (0, handler_1.setupSocket)(io, new Map());
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
        logger_1.logger.info(`Server running on port ${PORT}`);
    });
}
start().catch(err => logger_1.logger.error('Startup error', err));
