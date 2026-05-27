import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { setupSocket } from './socket/handler';
import { pubClient, subClient, loadAllGames } from './redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { logger } from './logger';

const app = express();
const server = http.createServer(app);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100,
  message: 'Слишком много запросов, попробуйте позже',
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

start().catch(err => logger.error('Startup error', err));