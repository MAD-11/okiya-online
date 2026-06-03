import { Board, Tile, Plant, Symbol, Cell } from '../types/game';

const PLANTS: Plant[] = ['sakura', 'iris', 'pine', 'maple'];
const SYMBOLS: Symbol[] = ['sun', 'bird', 'rain', 'tanzaku'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (const plant of PLANTS) {
    for (const symbol of SYMBOLS) {
      tiles.push({ plant, symbol });
    }
  }
  return shuffle(tiles);
}

export function initBoard(): Board {
  const tiles = createTiles();
  const board: Board = [];
  for (let r = 0; r < 4; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < 4; c++) {
      row.push(tiles[r * 4 + c]);
    }
    board.push(row);
  }
  return board;
}

export function isValidMove(
  board: Board,
  row: number,
  col: number,
  lastPickedTile: Tile | null
): boolean {
  const cell = board[row][col];
  if (!cell || typeof cell === 'string') return false;
  if (!lastPickedTile) return true;
  const tile = cell as Tile;
  return tile.plant === lastPickedTile.plant || tile.symbol === lastPickedTile.symbol;
}

export function checkWin(board: Board, player: 'red' | 'black'): boolean {
  // 4 в ряд горизонтально
  for (let i = 0; i < 4; i++) {
    if (board[i].every(cell => cell === player)) return true;
  }
  // 4 в ряд вертикально
  for (let i = 0; i < 4; i++) {
    if (board.every(row => row[i] === player)) return true;
  }
  // главная диагональ
  if (board.every((row, idx) => row[idx] === player)) return true;
  // побочная диагональ
  if (board.every((row, idx) => row[3 - idx] === player)) return true;
  // квадрат 2x2
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (
        board[r][c] === player &&
        board[r][c + 1] === player &&
        board[r + 1][c] === player &&
        board[r + 1][c + 1] === player
      ) {
        return true;
      }
    }
  }
  return false;
}