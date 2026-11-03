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

function countLineCells(
  cells: any[],
  color: 'red' | 'black',
  oppColor: 'red' | 'black',
): { mine: number; opp: number } {
  let mine = 0;
  let opp = 0;
  for (const c of cells) {
    if (c === color) mine++;
    else if (c === oppColor) opp++;
  }
  return { mine, opp };
}

function countLines(board: Board, color: 'red' | 'black', count: number): number {
  const oppColor = color === 'red' ? 'black' : 'red';
  let result = 0;
  const check = (cells: any[]) => {
    const { mine, opp } = countLineCells(cells, color, oppColor);
    if (mine === count && opp === 0) result++;
  };

  for (let i = 0; i < 4; i++) check(board[i]);
  for (let j = 0; j < 4; j++) check([board[0][j], board[1][j], board[2][j], board[3][j]]);
  check([board[0][0], board[1][1], board[2][2], board[3][3]]);
  check([board[0][3], board[1][2], board[2][1], board[3][0]]);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      check([board[r][c], board[r][c + 1], board[r + 1][c], board[r + 1][c + 1]]);
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
  lastTile: Tile | null,
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

  // Больше легальных ходов у оппонента = хуже для нас
  let oppFlex = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (isValidForColor(board, r, c, lastTile)) oppFlex++;
    }
  }
  score -= oppFlex * FLEXIBILITY_BONUS;

  return score;
}