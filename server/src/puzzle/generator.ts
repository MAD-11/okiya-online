import { Board, Tile, Plant, Symbol } from '../game/types';
import { initBoard } from '../game/Board';
import { Puzzle, PuzzleDifficulty } from './types';

const PLANTS: Plant[] = ['sakura', 'iris', 'pine', 'maple'];
const SYMBOLS: Symbol[] = ['sun', 'bird', 'rain', 'tanzaku'];

// Все выигрышные линии на доске 4x4 (4 в ряд + 2x2 квадраты)
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

function matches(a: Tile, b: Tile): boolean {
  return a.plant === b.plant || a.symbol === b.symbol;
}

// Свободные клетки, не занятые линией и не занятые камнями
function availableCells(board: Board, exclude: Set<string>): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (exclude.has(`${r},${c}`)) continue;
      if (typeof board[r][c] === 'string') continue; // камень уже стоит
      result.push([r, c]);
    }
  }
  return result;
}

/**
 * Пазл «выиграй за 1 ход»:
 * - 3 красных камня в выигрышной позиции
 * - 1 пустая клетка в линии с фишкой (ответ)
 * - 2–3 чёрных камня вне линии (для реалистичности)
 * - lastPickedTile совпадает с фишкой-ответом (по растению или символу)
 */
export function generateWinIn1(): Puzzle {
  const board = initBoard();
  const line = pick(ALL_WINNING);

  // Какую клетку линии оставить пустой (это будет ответ)
  const answerIdx = Math.floor(Math.random() * 4);
  const answerCell = line[answerIdx];

  // Ставим красные камни на 3 клетки линии
  for (let i = 0; i < 4; i++) {
    if (i !== answerIdx) {
      const [r, c] = line[i];
      board[r][c] = 'red';
    }
  }

  // Добавляем 2–3 чёрных камня вне линии
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
    board,
    lastPickedTile: answerTile, // точное совпадение — легко найти
    solution: [{ row: answerCell[0], col: answerCell[1] }],
    hint: 'Найди клетку, которая завершит линию из 4 красных камней.',
  };
}

/**
 * Пазл «выиграй за 2 хода»:
 * - 2 красных камня в выигрышной позиции
 * - 2 пустые клетки в линии с фишками (ответ)
 * - Порядок ходов однозначен: lastPickedTile совпадает с первой фишкой,
 *   но НЕ совпадает со второй
 * - 2–3 чёрных камня вне линии
 *
 * Возвращает null, если не удалось сгенерировать (редко).
 */
function generateWinIn2(): Puzzle | null {
  const board = initBoard();
  const line = pick(ALL_WINNING);

  // Какие 2 клетки линии оставить как фишки (ответ)
  const indices = shuffle([0, 1, 2, 3]).slice(0, 2);
  const [firstIdx, secondIdx] = indices;
  const cell1 = line[firstIdx];
  const cell2 = line[secondIdx];

  // Ставим красные камни на 2 клетки линии
  for (let i = 0; i < 4; i++) {
    if (!indices.includes(i)) {
      const [r, c] = line[i];
      board[r][c] = 'red';
    }
  }

  // Чёрные камни вне линии
  const lineCells = new Set(line.map(([r, c]) => `${r},${c}`));
  const freeCells = availableCells(board, lineCells);
  const numBlack = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numBlack && freeCells.length > 0; i++) {
    const idx = Math.floor(Math.random() * freeCells.length);
    const [r, c] = freeCells[idx];
    board[r][c] = 'black';
    freeCells.splice(idx, 1);
  }

  const tile1 = board[cell1[0]][cell1[1]] as Tile;
  const tile2 = board[cell2[0]][cell2[1]] as Tile;

  // Обе фишки должны совпадать хотя бы по одному атрибуту — иначе
  // из них нельзя составить победную линию из 2 ходов
  if (!matches(tile1, tile2)) return null;

  // Строим lastPickedTile, который совпадает с tile1, но не с tile2.
  // Это гарантирует единственный порядок: сначала cell1, потом cell2.
  let lastTile: Tile;

  if (tile1.plant === tile2.plant) {
    // одинаковое растение, разные символы
    const otherPlant = PLANTS.find(p => p !== tile1.plant)!;
    lastTile = { plant: otherPlant, symbol: tile1.symbol };
  } else {
    // одинаковый символ, разные растения
    const otherSymbol = SYMBOLS.find(s => s !== tile1.symbol)!;
    lastTile = { plant: tile1.plant, symbol: otherSymbol };
  }

  return {
    id: generateId(),
    difficulty: 2,
    board,
    lastPickedTile: lastTile,
    solution: [
      { row: cell1[0], col: cell1[1] },
      { row: cell2[0], col: cell2[1] },
    ],
    hint: 'Нужно поставить 2 камня подряд. Начни с фишки, которая совпадает с последней взятой, и следи, чтобы следующий ход тоже совпадал с предыдущим.',
  };
}

/**
 * Безопасная версия win-in-2: несколько попыток, fallback на win-in-1.
 */
export function generateWinIn2Safe(maxAttempts = 20): Puzzle {
  for (let i = 0; i < maxAttempts; i++) {
    const p = generateWinIn2();
    if (p) return p;
  }
  return generateWinIn1();
}

/**
 * Универсальная точка входа.
 */
export function generatePuzzle(difficulty: PuzzleDifficulty): Puzzle {
  if (difficulty === 1) return generateWinIn1();
  return generateWinIn2Safe();
}