import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { setupSocket } from '../src/socket/handler';

let io: Server;
let clientSocket: ClientSocket;

beforeAll(done => {
  const httpServer = createServer();
  io = new Server(httpServer);
  setupSocket(io, new Map());
  httpServer.listen(() => {
    const port = (httpServer.address() as any).port;
    clientSocket = Client(`http://localhost:${port}`);
    clientSocket.on('connect', done);
  });
});

afterAll(() => {
  io.close();
  clientSocket.close();
});

test('should create room', done => {
  clientSocket.emit('create_room', { maxWins: 1, nick: 'Tester' }, (res: any) => {
    expect(res.roomId).toBeDefined();
    done();
  });
});