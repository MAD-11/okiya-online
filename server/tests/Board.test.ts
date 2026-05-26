import { initBoard, isValidMove, checkWin } from '../src/game/Board';

test('initBoard creates 4x4 board with unique tiles', () => {
  const board = initBoard();
  expect(board.length).toBe(4);
  const tiles = board.flat().filter(cell => cell && typeof cell !== 'string');
  expect(tiles.length).toBe(16);
});

test('checkWin detects horizontal line', () => {
  const board = Array(4).fill(null).map(() => Array(4).fill(null));
  board[0] = ['red', 'red', 'red', 'red'];
  expect(checkWin(board as any, 'red')).toBe(true);
});