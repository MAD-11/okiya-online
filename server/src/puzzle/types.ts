import { Board, Tile } from '../game/types';

export type PuzzleDifficulty = 1 | 2 | 3;
export type PuzzleType = 'win' | 'win-hard' | 'block';

export interface Puzzle {
  id: string;
  difficulty: PuzzleDifficulty;
  type: PuzzleType;
  board: Board;
  lastPickedTile: Tile;
  solution: Array<{ row: number; col: number }>;
  hint: string;
}

export type ClientPuzzle = Puzzle;