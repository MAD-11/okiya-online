import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { setupSocket, clearAllDisconnectTimers, getActiveGamesCount, getAllActiveGames } from './socket/handler';
import { pubClient, subClient, loadAllGames, closeRedisConnections, saveGame } from './redis';
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

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
    activeGames: getActiveGamesCount(),
    activeSockets: io.sockets.sockets.size,
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    },
  });
});

// ============================================================
// START
// ============================================================
async function start() {
  const savedGames = await loadAllGames();
  logger.info(`Loaded ${savedGames.size} games from Redis`);
  setupSocket(io, savedGames);

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress, ignoring ${signal}`);
    return;
  }
  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Жёсткий таймаут — если что-то зависнет, убьём процесс через 30 сек
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30_000);
  forceExitTimer.unref();

  try {
    // 1. Останавливаем приём новых HTTP-соединений
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });

    // 2. Сохраняем все активные игры в Redis (чтобы не потерять при рестарте)
    const activeGames = getAllActiveGames();
    if (activeGames.size > 0) {
      logger.info(`Saving ${activeGames.size} active games to Redis...`);
      const savePromises = Array.from(activeGames.entries()).map(([roomId, game]) =>
        saveGame(roomId, game).catch(err =>
          logger.error(`Failed to save game ${roomId}:`, err)
        )
      );
      await Promise.all(savePromises);
      logger.info('All active games saved');
    }

    // 3. Закрываем все сокеты
    const sockets = await io.fetchSockets();
    logger.info(`Disconnecting ${sockets.length} sockets...`);
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    // 4. Очищаем таймеры отключения
    clearAllDisconnectTimers();
    logger.info('Disconnect timers cleared');

    // 5. Закрываем Redis-соединения
    await closeRedisConnections();
    logger.info('Redis connections closed');

    logger.info('Graceful shutdown complete');
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown:', err);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch(err => {
  logger.error('Startup error', err);
  process.exit(1);
});