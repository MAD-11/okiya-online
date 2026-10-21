import { initBoard, isValidMove, checkWin, createTiles } from '../src/game/Board';

describe('initBoard', () => {
  test('creates 4x4 board with unique tiles', () => {
    const board = initBoard();
    expect(board.length).toBe(4);
    expect(board[0].length).toBe(4);
    const tiles = board.flat().filter(cell => cell && typeof cell !== 'string');
    expect(tiles.length).toBe(16);
  });

  test('every tile has plant and symbol', () => {
    const board = initBoard();
    board.flat().forEach(cell => {
      if (cell && typeof cell !== 'string') {
        expect(cell.plant).toBeDefined();
        expect(cell.symbol).toBeDefined();
      }
    });
  });
});

describe('isValidMove', () => {
  test('returns false for occupied cell', () => {
    const board = initBoard();
    board[0][0] = 'red';
    expect(isValidMove(board, 0, 0, null)).toBe(false);
  });

  test('first move allowed on edge', () => {
    const board = initBoard();
    expect(isValidMove(board, 0, 0, null)).toBe(true);
    expect(isValidMove(board, 0, 3, null)).toBe(true);
    expect(isValidMove(board, 3, 0, null)).toBe(true);
    expect(isValidMove(board, 3, 3, null)).toBe(true);
  });

  test('first move disallowed on center 2x2', () => {
    const board = initBoard();
    expect(isValidMove(board, 1, 1, null)).toBe(false);
    expect(isValidMove(board, 1, 2, null)).toBe(false);
    expect(isValidMove(board, 2, 1, null)).toBe(false);
    expect(isValidMove(board, 2, 2, null)).toBe(false);
  });

  test('subsequent move must match plant or symbol', () => {
    const board = initBoard();
    board[0][1] = { plant: 'sakura', symbol: 'sun' };
    board[0][2] = { plant: 'iris', symbol: 'rain' };
    expect(isValidMove(board, 0, 1, { plant: 'sakura', symbol: 'bird' })).toBe(true);
    expect(isValidMove(board, 0, 2, { plant: 'sakura', symbol: 'sun' })).toBe(false);
    expect(isValidMove(board, 0, 2, { plant: 'iris', symbol: 'sun' })).toBe(true);
  });
});

describe('checkWin', () => {
  test('detects horizontal line', () => {
    const board: any = Array(4).fill(null).map(() => Array(4).fill(null));
    board[0] = ['red', 'red', 'red', 'red'];
    expect(checkWin(board, 'red')).toBe(true);
  });

  test('detects vertical line', () => {
    const board: any = Array(4).fill(null).map(() => Array(4).fill(null));
    for (let i = 0; i < 4; i++) board[i][1] = 'black';
    expect(checkWin(board, 'black')).toBe(true);
  });

  test('detects main diagonal', () => {
    const board: any = Array(4).fill(null).map(() => Array(4).fill(null));
    for (let i = 0; i < 4; i++) board[i][i] = 'red';
    expect(checkWin(board, 'red')).toBe(true);
  });

  test('detects anti-diagonal', () => {
    const board: any = Array(4).fill(null).map(() => Array(4).fill(null));
    for (let i = 0; i < 4; i++) board[i][3 - i] = 'black';
    expect(checkWin(board, 'black')).toBe(true);
  });

  test('detects 2x2 square', () => {
    const board: any = Array(4).fill(null).map(() => Array(4).fill(null));
    board[1][1] = 'red';
    board[1][2] = 'red';
    board[2][1] = 'red';
    board[2][2] = 'red';
    expect(checkWin(board, 'red')).toBe(true);
  });

  test('returns false for no win', () => {
    const board: any = Array(4).fill(null).map(() => Array(4).fill(null));
    board[0][0] = 'red';
    board[0][1] = 'black';
    expect(checkWin(board, 'red')).toBe(false);
    expect(checkWin(board, 'black')).toBe(false);
  });

  test('does not detect 3 in row as win', () => {
    const board: any = Array(4).fill(null).map(() => Array(4).fill(null));
    board[0][0] = 'red';
    board[0][1] = 'red';
    board[0][2] = 'red';
    expect(checkWin(board, 'red')).toBe(false);
  });
});