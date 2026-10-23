import { Game } from '../src/game/Game';

describe('Game', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game(1);
    game.addPlayer('host-socket');
  });

  test('addPlayer: host заходит первым', () => {
    expect(game.players.red).toBe('host-socket');
    expect(game.hostSocketId).toBe('host-socket');
  });

  test('addPlayer: guest заходит вторым, статус playing', () => {
    game.addPlayer('guest-socket');
    expect(game.players.black).toBe('guest-socket');
    expect(game.status).toBe('playing');
  });

  test('addPlayer: третий игрок не может зайти', () => {
    game.addPlayer('guest-socket');
    expect(game.addPlayer('third-socket')).toBe(false);
  });

  test('makeMove: первый ход только с края', () => {
    game.addPlayer('guest-socket');
    expect(game.makeMove(1, 1, 'host-socket')).toBe(false);
    expect(game.makeMove(0, 0, 'host-socket')).toBe(true);
  });

  test('makeMove: не свой ход — отклоняется', () => {
    game.addPlayer('guest-socket');
    expect(game.makeMove(0, 0, 'guest-socket')).toBe(false);
  });

  test('makeMove: после победы статус finished', () => {
    game.addPlayer('guest-socket');
    game.board[0][0] = 'red';
    game.board[0][1] = 'red';
    game.board[0][2] = 'red';
    game.board[0][3] = { plant: 'sakura', symbol: 'sun' };
    game.currentPlayer = 'red';
    game.makeMove(0, 3, 'host-socket');
    expect(game.status).toBe('finished');
    expect(game.winner).toBe('red');
  });

  test('handleGameOver: победа увеличивает счёт', () => {
    game.addPlayer('guest-socket');
    game.winner = 'red';
    game.handleGameOver();
    expect(game.scores.host).toBe(1);
    expect(game.status).toBe('finished');
  });

  test('swapColors: счёт следует за игроком', () => {
    game.addPlayer('guest-socket');
    game.scores.host = 2;
    game.scores.guest = 1;
    // @ts-expect-error — приватный метод
    game.swapColors();
    expect(game.scores.host).toBe(1);
    expect(game.scores.guest).toBe(2);
    expect(game.players.red).toBe('guest-socket');
  });

  test('startNewRound: сбрасывает доску и меняет цвета', () => {
    game.addPlayer('guest-socket');
    game.status = 'finished';
    game.roundFinished = true;
    game.startNewRound();
    expect(game.status).toBe('playing');
    expect(game.currentPlayer).toBe('red');
    expect(game.roundFinished).toBe(false);
  });
});