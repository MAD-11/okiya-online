import { Board, Tile } from '../game/types';

export type PuzzleDifficulty = 1 | 2;

export interface Puzzle {
  id: string;
  difficulty: PuzzleDifficulty;
  board: Board;
  lastPickedTile: Tile;
  solution: Array<{ row: number; col: number }>;
  hint: string;
}

// Отправляется клиенту — solution нужен для проверки правильности хода
export type ClientPuzzle = Puzzle;