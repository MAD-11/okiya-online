import { Board, Tile, Plant, Symbol, Cell } from '../game/types';
import { Puzzle, PuzzleDifficulty } from './types';

const PLANTS: Plant[] = ['sakura', 'iris', 'pine', 'maple'];
const SYMBOLS: Symbol[] = ['sun', 'bird', 'rain', 'tanzaku'];

const LINES: Array<Array<[number, number]>> = [
  [[0,0],[0,1],[0,2],[0,3]],
  [[1,0],[1,1],[1,2],[1,3]],
  [[2,0],[2,1],[2,2],[2,3]],
  [[3,0],[3,1],[3,2],[3,3]],
  [[0,0],[1,0],[2,0],[3,0]],
  [[0,1],[1,1],[2,1],[3,1]],
  [[0,2],[1,2],[2,2],[3,2]],
  [[0,3],[1,3],[2,3],[3,3]],
  [[0,0],[1,1],[2,2],[3,3]],
  [[0,3],[1,2],[2,1],[3,0]],
];

const SQUARES: Array<Array<[number, number]>> = [
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,1],[0,2],[1,1],[1,2]],
  [[0,2],[0,3],[1,2],[1,3]],
  [[1,0],[1,1],[2,0],[2,1]],
  [[1,1],[1,2],[2,1],[2,2]],
  [[1,2],[1,3],[2,2],[2,3]],
  [[2,0],[2,1],[3,0],[3,1]],
  [[2,1],[2,2],[3,1],[3,2]],
  [[2,2],[2,3],[3,2],[3,3]],
];

const ALL_WINNING = [...LINES, ...SQUARES];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function emptyBoard(): Board {
  const board: Board = [];
  for (let r = 0; r < 4; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < 4; c++) row.push(null);
    board.push(row);
  }
  return board;
}

// Возвращает tile, который совпадает с исходным по одному признаку,
// но не является тем же самым tile (другое растение или другой символ).
function makeMatchingTile(tile: Tile): Tile {
  if (Math.random() < 0.5) {
    return {
      plant: tile.plant,
      symbol: pick(SYMBOLS.filter(s => s !== tile.symbol)),
    };
  }
  return {
    plant: pick(PLANTS.filter(p => p !== tile.plant)),
    symbol: tile.symbol,
  };
}

// Заполняет свободные клетки случайными tile'ами, не пересекаясь с used.
function fillWithTiles(
  board: Board,
  cells: Array<[number, number]>,
  used: Set<string>
): void {
  for (const [r, c] of cells) {
    let tile: Tile;
    do {
      tile = { plant: pick(PLANTS), symbol: pick(SYMBOLS) };
    } while (used.has(`${tile.plant}/${tile.symbol}`));
    used.add(`${tile.plant}/${tile.symbol}`);
    board[r][c] = tile;
  }
}

// ============================================================
// WIN-IN-1
// Количество камней: 3 red (в линии) + 3 black (вне линии) = 6
// Это соответствует ходу красных: red = black = 3, сейчас 4-й ход red.
// ============================================================
export function generateWinIn1(): Puzzle {
  const line = pick(ALL_WINNING);
  const gapIdx = Math.floor(Math.random() * 4);
  const gapCell = line[gapIdx];

  const board = emptyBoard();

  // 3 красных камня в линии
  for (let i = 0; i < 4; i++) {
    if (i !== gapIdx) {
      const [r, c] = line[i];
      board[r][c] = 'red';
    }
  }

  // Фишка-ответ в гэпе
  const answerTile: Tile = { plant: pick(PLANTS), symbol: pick(SYMBOLS) };
  board[gapCell[0]][gapCell[1]] = answerTile;

  // lastPickedTile: совпадает с ответом, но это другая фишка
  // (её взял чёрный на прошлом ходу)
  const lastPickedTile = makeMatchingTile(answerTile);

  // 3 чёрных камня вне линии
  const freeCells: Array<[number, number]> = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === null) freeCells.push([r, c]);
    }
  }
  const shuffled = shuffle(freeCells);
  for (let i = 0; i < 3; i++) {
    const [r, c] = shuffled[i];
    board[r][c] = 'black';
  }

  // 9 случайных фишек в остальные клетки
  const used = new Set<string>([
    `${answerTile.plant}/${answerTile.symbol}`,
    `${lastPickedTile.plant}/${lastPickedTile.symbol}`,
  ]);
  fillWithTiles(board, shuffled.slice(3), used);

  return {
    id: generateId(),
    difficulty: 1,
    type: 'win',
    board,
    lastPickedTile,
    solution: [{ row: gapCell[0], col: gapCell[1] }],
    hint: 'Найди клетку, которая завершит линию из 4 красных камней.',
  };
}

// ============================================================
// BLOCK
// Количество камней: 3 black (в линии) + 3 red (вне линии) = 6
// red = black = 3, сейчас ход red. Нужно взять фишку из гэпа
// чёрных, чтобы заблокировать победу.
// ============================================================
export function generateBlockPuzzle(): Puzzle {
  const line = pick(ALL_WINNING);
  const gapIdx = Math.floor(Math.random() * 4);
  const gapCell = line[gapIdx];

  const board = emptyBoard();

  // 3 чёрных камня в линии
  for (let i = 0; i < 4; i++) {
    if (i !== gapIdx) {
      const [r, c] = line[i];
      board[r][c] = 'black';
    }
  }

  // Фишка-ответ в гэпе (эту надо взять, чтобы заблокировать)
  const gapTile: Tile = { plant: pick(PLANTS), symbol: pick(SYMBOLS) };
  board[gapCell[0]][gapCell[1]] = gapTile;

  // lastPickedTile: совпадает с gapTile, но другая фишка
  const lastPickedTile = makeMatchingTile(gapTile);

  // 3 красных камня вне линии
  const freeCells: Array<[number, number]> = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === null) freeCells.push([r, c]);
    }
  }
  const shuffled = shuffle(freeCells);
  for (let i = 0; i < 3; i++) {
    const [r, c] = shuffled[i];
    board[r][c] = 'red';
  }

  // 9 случайных фишек
  const used = new Set<string>([
    `${gapTile.plant}/${gapTile.symbol}`,
    `${lastPickedTile.plant}/${lastPickedTile.symbol}`,
  ]);
  fillWithTiles(board, shuffled.slice(3), used);

  return {
    id: generateId(),
    difficulty: 2,
    type: 'block',
    board,
    lastPickedTile,
    solution: [{ row: gapCell[0], col: gapCell[1] }],
    hint: 'У чёрных 3 камня в линию с пустой клеткой. Возьми фишку из этой клетки, чтобы заблокировать их победу.',
  };
}

export function generatePuzzle(difficulty: PuzzleDifficulty): Puzzle {
  if (difficulty === 1) return generateWinIn1();
  return generateBlockPuzzle();
}