"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const socket_io_client_1 = require("socket.io-client");
const handler_1 = require("../src/socket/handler");
let io;
let clientSocket;
beforeAll(done => {
    const httpServer = (0, http_1.createServer)();
    io = new socket_io_1.Server(httpServer);
    (0, handler_1.setupSocket)(io, new Map());
    httpServer.listen(() => {
        const port = httpServer.address().port;
        clientSocket = (0, socket_io_client_1.io)(`http://localhost:${port}`);
        clientSocket.on('connect', done);
    });
});
afterAll(() => {
    io.close();
    clientSocket.close();
});
test('should create room', done => {
    clientSocket.emit('create_room', { maxWins: 1, nick: 'Tester' }, (res) => {
        expect(res.roomId).toBeDefined();
        done();
    });
});
