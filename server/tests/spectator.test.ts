import { createServer, Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { setupSocket } from '../src/socket/handler';

let httpServer: HttpServer;
let io: Server;
let port: number;

function connectClient(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const c = Client(`http://localhost:${port}`, { forceNew: true, reconnection: false });
    c.on('connect', () => resolve(c));
    c.on('connect_error', reject);
  });
}

function emitAck<T = any>(client: ClientSocket, event: string, ...args: any[]): Promise<T> {
  return new Promise((resolve) => {
    client.emit(event, ...args, (res: T) => resolve(res));
  });
}

beforeAll((done) => {
  httpServer = createServer();
  io = new Server(httpServer);
  setupSocket(io, new Map());
  httpServer.listen(0, () => {
    port = (httpServer.address() as any).port;
    done();
  });
});

afterAll((done) => {
  io.close();
  httpServer.close(() => done());
});

describe('Spectator mode — rejection cases', () => {
  test('rejects non-existent room', async () => {
    const c = await connectClient();
    const res = await emitAck(c, 'spectate_room', { roomId: 'ZZZZ' });
    expect(res.error).toBeDefined();
    c.disconnect();
  });

  test('rejects if game not started (1/2)', async () => {
    const host = await connectClient();
    const createRes = await emitAck(host, 'create_room', {
      maxWins: 1, playerId: 'p1', nick: 'Host'
    });
    const roomId = createRes.roomId;

    const spec = await connectClient();
    const res = await emitAck(spec, 'spectate_room', { roomId });
    expect(res.error).toBeDefined();
    expect(res.error).toMatch(/не началась/i);

    host.disconnect();
    spec.disconnect();
  });

  test('rejects private room', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const createRes = await emitAck(host, 'create_room', {
      maxWins: 1, playerId: 'p2', nick: 'Host2', isPrivate: true
    });
    const roomId = createRes.roomId;
    await emitAck(guest, 'join_room', { roomId, playerId: 'g2', nick: 'Guest2' });

    const spec = await connectClient();
    const res = await emitAck(spec, 'spectate_room', { roomId });
    expect(res.error).toBeDefined();
    expect(res.error).toMatch(/приватн/i);

    host.disconnect();
    guest.disconnect();
    spec.disconnect();
  });

  test('rejects if you are already a player', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const createRes = await emitAck(host, 'create_room', {
      maxWins: 1, playerId: 'p3', nick: 'Host3'
    });
    const roomId = createRes.roomId;
    await emitAck(guest, 'join_room', { roomId, playerId: 'g3', nick: 'Guest3' });

    const res = await emitAck(host, 'spectate_room', { roomId });
    expect(res.error).toBeDefined();
    expect(res.error).toMatch(/уже.*игрок/i);

    host.disconnect();
    guest.disconnect();
  });
});

describe('Spectator mode — success cases', () => {
  test('spectator joins full active room and gets isSpectator state', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const spec = await connectClient();

    const createRes = await emitAck(host, 'create_room', {
      maxWins: 1, playerId: 'h4', nick: 'Host4'
    });
    const roomId = createRes.roomId;
    await emitAck(guest, 'join_room', { roomId, playerId: 'g4', nick: 'Guest4' });

    const res = await emitAck(spec, 'spectate_room', { roomId });
    expect(res.error).toBeUndefined();
    expect(res.state).toBeDefined();
    expect(res.state.myColor).toBeNull();
    expect(res.state.isSpectator).toBe(true);
    expect(res.state.isHost).toBe(false);
    expect(res.state.myNick).toBe('Зритель');
    expect(res.state.nickRed).toBe('Host4');
    expect(res.state.nickBlack).toBe('Guest4');
    expect(res.state.status).toBe('playing');

    host.disconnect();
    guest.disconnect();
    spec.disconnect();
  });

  test('spectator cannot make a move', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const spec = await connectClient();

    const createRes = await emitAck(host, 'create_room', {
      maxWins: 1, playerId: 'h5', nick: 'Host5'
    });
    const roomId = createRes.roomId;
    await emitAck(guest, 'join_room', { roomId, playerId: 'g5', nick: 'Guest5' });
    await emitAck(spec, 'spectate_room', { roomId });

    // First move is allowed only on edge; spec tries corner (0,0)
    const moveRes = await emitAck(spec, 'move', roomId, 0, 0);
    expect(moveRes.error).toBeDefined();
    expect(moveRes.error).toMatch(/только игроки/i);

    host.disconnect();
    guest.disconnect();
    spec.disconnect();
  });

  test('spectator cannot forfeit', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const spec = await connectClient();

    const createRes = await emitAck(host, 'create_room', {
      maxWins: 1, playerId: 'h6', nick: 'Host6'
    });
    const roomId = createRes.roomId;
    await emitAck(guest, 'join_room', { roomId, playerId: 'g6', nick: 'Guest6' });
    await emitAck(spec, 'spectate_room', { roomId });

    const res = await emitAck(spec, 'forfeit', roomId);
    expect(res.error).toBeDefined();
    expect(res.error).toMatch(/только игроки/i);

    host.disconnect();
    guest.disconnect();
    spec.disconnect();
  });

  test('spectator receives updated state after player move', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const spec = await connectClient();

    const createRes = await emitAck(host, 'create_room', {
      maxWins: 1, playerId: 'h7', nick: 'Host7'
    });
    const roomId = createRes.roomId;
    await emitAck(guest, 'join_room', { roomId, playerId: 'g7', nick: 'Guest7' });
    await emitAck(spec, 'spectate_room', { roomId });

    const statePromise = new Promise<any>((resolve) => {
      spec.once('game_state', resolve);
    });

    // Хост делает первый ход (0,0 — угол, разрешён)
    await emitAck(host, 'move', roomId, 0, 0);

    const newState = await statePromise;
    expect(newState.board[0][0]).toBe('red');
    expect(newState.isSpectator).toBe(true);

    host.disconnect();
    guest.disconnect();
    spec.disconnect();
  });
});