import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { setupSocket } from './socket/handler';
import { pubClient, subClient, loadAllGames } from './redis';
import { createAdapter } from '@socket.io/redis-adapter';

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
  },
});

// Подключаем Redis Adapter для масштабирования
io.adapter(createAdapter(pubClient, subClient));

// Загружаем сохранённые игры перед подключением клиентов
async function start() {
  const savedGames = await loadAllGames();
  console.log(`Loaded ${savedGames.size} games from Redis`);
  // Передаём сохранённые игры в обработчики
  setupSocket(io, savedGames); // передадим Map с играми

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(console.error);