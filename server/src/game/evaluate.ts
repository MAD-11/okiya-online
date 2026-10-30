import { Board, Tile } from './types';
import { checkWin } from './Board';

export const WIN_SCORE = 100000;
export const BLOCK_WIN_SCORE = 90000;
export const CREATE_THREE_SCORE = 1000;
export const BLOCK_THREE_SCORE = 800;
export const CREATE_TWO_SCORE = 40;
export const BLOCK_TWO_SCORE = 30;
export const CENTER_BONUS = 8;
export const FLEXIBILITY_BONUS = 2;

function countLines(board: Board, color: 'red' | 'black', count: number): number {
  let result = 0;
  for (let i = 0; i < 4; i++) {
    const row = board[i];
    const colorCount = row.filter(cell => cell === color).length;
    const oppCount = row.filter(cell => cell !== color && typeof cell !== 'string').length;
    if (colorCount === count && oppCount === 0) result++;
  }
  for (let j = 0; j < 4; j++) {
    let cc = 0, oc = 0;
    for (let i = 0; i < 4; i++) {
      if (board[i][j] === color) cc++;
      else if (board[i][j] !== null && typeof board[i][j] !== 'string') oc++;
    }
    if (cc === count && oc === 0) result++;
  }
  const d1 = [board[0][0], board[1][1], board[2][2], board[3][3]];
  if (d1.filter(c => c === color).length === count &&
      d1.filter(c => c !== color && typeof c !== 'string').length === 0) result++;
  const d2 = [board[0][3], board[1][2], board[2][1], board[3][0]];
  if (d2.filter(c => c === color).length === count &&
      d2.filter(c => c !== color && typeof c !== 'string').length === 0) result++;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cells = [board[r][c], board[r][c + 1], board[r + 1][c], board[r + 1][c + 1]];
      if (cells.filter(x => x === color).length === count &&
          cells.filter(x => x !== color && typeof x !== 'string').length === 0) result++;
    }
  }
  return result;
}

export function canWinNextMove(board: Board, color: 'red' | 'black', lastTile: Tile | null): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!isValidForColor(board, r, c, lastTile)) continue;
      const sim = board.map(row => [...row]);
      sim[r][c] = color;
      if (checkWin(sim, color)) return true;
    }
  }
  return false;
}

export function isValidForColor(board: Board, row: number, col: number, lastTile: Tile | null): boolean {
  const cell = board[row][col];
  if (!cell || typeof cell === 'string') return false;
  if (!lastTile) {
    // Первый ход: только край, не центр
    if (!(row === 0 || row === 3 || col === 0 || col === 3)) return false;
    if ((row === 1 || row === 2) && (col === 1 || col === 2)) return false;
    return true;
  }
  const tile = cell as Tile;
  return tile.plant === lastTile.plant || tile.symbol === lastTile.symbol;
}

export function evaluatePosition(
  board: Board,
  myColor: 'red' | 'black',
  oppColor: 'red' | 'black',
  lastTile: Tile | null
): number {
  let score = 0;
  if (checkWin(board, myColor)) return WIN_SCORE;
  if (canWinNextMove(board, oppColor, lastTile)) score -= BLOCK_WIN_SCORE;
  score += countLines(board, myColor, 3) * CREATE_THREE_SCORE;
  score += countLines(board, myColor, 2) * CREATE_TWO_SCORE;
  score -= countLines(board, oppColor, 3) * BLOCK_THREE_SCORE;
  score -= countLines(board, oppColor, 2) * BLOCK_TWO_SCORE;
  for (const [r, c] of [[1, 1], [1, 2], [2, 1], [2, 2]] as const) {
    if (board[r][c] === myColor) score += CENTER_BONUS;
    else if (board[r][c] === oppColor) score -= CENTER_BONUS / 2;
  }
  let flex = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (isValidForColor(board, r, c, lastTile)) flex++;
    }
  }
  score += flex * FLEXIBILITY_BONUS;
  return score;
}