import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { setupSocket } from './socket/handler';
import { pubClient, subClient, loadAllGames, closeRedisConnections } from './redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { logger } from './logger';
import rateLimit from 'express-rate-limit';

const app = express();
const server = http.createServer(app);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
  },
});

io.adapter(createAdapter(pubClient, subClient));

async function start() {
  const savedGames = await loadAllGames();
  logger.info(`Loaded ${savedGames.size} games from Redis`);
  setupSocket(io, savedGames);

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

// FIX: graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully...');
  // Закрываем сервер, чтобы не принимать новые соединения
  server.close(async () => {
    logger.info('HTTP server closed');
    // Закрываем Redis соединения
    await closeRedisConnections();
    logger.info('Redis connections closed');
    process.exit(0);
  });
  // Если через 10 секунд не закрылся – принудительно
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch(err => logger.error('Startup error', err));