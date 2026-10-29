import { Board, Tile, Plant, Symbol, Cell } from '../game/types';
import { initBoard } from '../game/Board';
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

function availableCells(board: Board, exclude: Set<string>): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (exclude.has(`${r},${c}`)) continue;
      if (typeof board[r][c] === 'string') continue;
      result.push([r, c]);
    }
  }
  return result;
}

// ============================================================
// EASY: Win in 1 — очевидный победный ход
// ============================================================
export function generateWinIn1(): Puzzle {
  const board = initBoard();
  const line = pick(ALL_WINNING);
  const answerIdx = Math.floor(Math.random() * 4);
  const answerCell = line[answerIdx];

  for (let i = 0; i < 4; i++) {
    if (i !== answerIdx) {
      const [r, c] = line[i];
      board[r][c] = 'red';
    }
  }

  // 2–3 чёрных камня вне линии
  const lineCells = new Set(line.map(([r, c]) => `${r},${c}`));
  const freeCells = availableCells(board, lineCells);
  const numBlack = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numBlack && freeCells.length > 0; i++) {
    const idx = Math.floor(Math.random() * freeCells.length);
    const [r, c] = freeCells[idx];
    board[r][c] = 'black';
    freeCells.splice(idx, 1);
  }

  const answerTile = board[answerCell[0]][answerCell[1]] as Tile;

  return {
    id: generateId(),
    difficulty: 1,
    type: 'win',
    board,
    lastPickedTile: answerTile,
    solution: [{ row: answerCell[0], col: answerCell[1] }],
    hint: 'Найди клетку, которая завершит линию из 4 красных камней.',
  };
}

// ============================================================
// MEDIUM: Win in 1 с обманками
// ============================================================
export function generateWinIn1WithDecoys(): Puzzle {
  const board = initBoard();
  const line = pick(ALL_WINNING);
  const answerIdx = Math.floor(Math.random() * 4);
  const answerCell = line[answerIdx];

  for (let i = 0; i < 4; i++) {
    if (i !== answerIdx) {
      const [r, c] = line[i];
      board[r][c] = 'red';
    }
  }

  const lineCells = new Set(line.map(([r, c]) => `${r},${c}`));
  const freeCells = availableCells(board, lineCells);

  // 2 чёрных камня
  for (let i = 0; i < 2 && freeCells.length > 0; i++) {
    const idx = Math.floor(Math.random() * freeCells.length);
    const [r, c] = freeCells[idx];
    board[r][c] = 'black';
    freeCells.splice(idx, 1);
  }

  const answerTile = board[answerCell[0]][answerCell[1]] as Tile;

  // 2–3 обманки: фишки, совпадающие с lastPickedTile, но не ведущие к победе
  const decoyCells = availableCells(board, lineCells);
  const numDecoys = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numDecoys && decoyCells.length > 0; i++) {
    const idx = Math.floor(Math.random() * decoyCells.length);
    const [r, c] = decoyCells[idx];
    decoyCells.splice(idx, 1);

    const matchByPlant = Math.random() < 0.5;
    const newTile: Tile = matchByPlant
      ? { plant: answerTile.plant, symbol: pick(SYMBOLS.filter(s => s !== answerTile.symbol)) }
      : { plant: pick(PLANTS.filter(p => p !== answerTile.plant)), symbol: answerTile.symbol };
    board[r][c] = newTile;
  }

  return {
    id: generateId(),
    difficulty: 2,
    type: 'win-hard',
    board,
    lastPickedTile: answerTile,
    solution: [{ row: answerCell[0], col: answerCell[1] }],
    hint: 'Найди клетку, которая завершит линию. Осторожно: не все совпадающие фишки ведут к победе.',
  };
}

// ============================================================
// HARD: Block — заблокируй угрозу чёрных
// ============================================================
export function generateBlockPuzzle(): Puzzle {
  const line = pick(ALL_WINNING);
  const gapIdx = Math.floor(Math.random() * 4);
  const gapCell = line[gapIdx];

  const L_TILE: Tile = { plant: 'sakura', symbol: 'sun' };   // lastPickedTile
  const G_TILE: Tile = { plant: 'sakura', symbol: 'bird' };  // tile in gap → block

  // Создаём пустую доску
  const board: Board = [];
  for (let r = 0; r < 4; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < 4; c++) row.push(null);
    board.push(row);
  }

  // Ставим G_TILE в гэп
  board[gapCell[0]][gapCell[1]] = G_TILE;

  // 3 чёрных камня — остальные клетки линии
  for (let i = 0; i < 4; i++) {
    if (i !== gapIdx) {
      const [r, c] = line[i];
      board[r][c] = 'black';
    }
  }

  // Собираем пустые клетки
  const empty: Array<[number, number]> = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === null) empty.push([r, c]);
    }
  }
  const shuffled = shuffle(empty);

  // 2 sakura-* фишки (dangerous legal moves), 1 красный камень, остальное — inert
  const sakuraFreeTiles: Tile[] = [
    { plant: 'sakura', symbol: 'rain' },
    { plant: 'sakura', symbol: 'tanzaku' },
  ];
  const inertTiles: Tile[] = [
    { plant: 'iris', symbol: 'bird' },
    { plant: 'iris', symbol: 'rain' },
    { plant: 'iris', symbol: 'tanzaku' },
    { plant: 'pine', symbol: 'bird' },
    { plant: 'pine', symbol: 'rain' },
    { plant: 'pine', symbol: 'tanzaku' },
    { plant: 'maple', symbol: 'bird' },
    { plant: 'maple', symbol: 'rain' },
    { plant: 'maple', symbol: 'tanzaku' },
  ];

  board[shuffled[0][0]][shuffled[0][1]] = sakuraFreeTiles[0];
  board[shuffled[1][0]][shuffled[1][1]] = sakuraFreeTiles[1];
  board[shuffled[2][0]][shuffled[2][1]] = 'red';

  for (let i = 3; i < shuffled.length; i++) {
    board[shuffled[i][0]][shuffled[i][1]] = pick(inertTiles);
  }

  return {
    id: generateId(),
    difficulty: 3,
    type: 'block',
    board,
    lastPickedTile: L_TILE,
    solution: [{ row: gapCell[0], col: gapCell[1] }],
    hint: 'У чёрных 3 камня в линию с пустой клеткой. Возьми фишку из этой клетки, чтобы заблокировать их победу.',
  };
}

// ============================================================
// Dispatcher
// ============================================================
export function generatePuzzle(difficulty: PuzzleDifficulty): Puzzle {
  if (difficulty === 1) return generateWinIn1();
  if (difficulty === 2) return generateWinIn1WithDecoys();
  return generateBlockPuzzle();
}