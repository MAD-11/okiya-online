import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { setupSocket } from './socket/handler';

const app = express();
const server = http.createServer(app);

// Разрешаем подключения только от нашего приложения на Vercel
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  },
});

setupSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});