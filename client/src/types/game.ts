export type Plant = 'sakura' | 'iris' | 'pine' | 'maple';
export type Symbol = 'sun' | 'bird' | 'rain' | 'tanzaku';

export interface Tile {
  plant: Plant;
  symbol: Symbol;
}

export type Cell = Tile | null | 'red' | 'black';
export type Board = Cell[][];

export type GameStatus = 'waiting' | 'playing' | 'finished';
export type Winner = 'red' | 'black' | 'draw' | null;

export interface GameState {
  board: Board;
  currentPlayer: 'red' | 'black';
  status: GameStatus;
  winner: Winner;
  lastPickedTile: Tile | null;
  myColor: 'red' | 'black' | null;
  myScore: number;
  opponentScore: number;
  maxWins: number;
  roundFinished: boolean;
  seriesWinner: 'host' | 'guest' | null;
  isHost: boolean;
  turnStartedAt: number;
  turnDuration: number;
  lastMove: { row: number; col: number } | null;
  opponentConnected: boolean;
  nickRed: string;
  nickBlack: string;
  myNick: string;
  messages: { sender: string; text: string; timestamp: number }[];
  hostSkin: string;
  guestSkin: string;
  isPrivate?: boolean;
  puzzlesSolved?: number;
  isSpectator?: boolean;

}

export type ValidMoves = boolean[][];

export type PuzzleDifficulty = 1 | 2;

export interface Puzzle {
  id: string;
  difficulty: PuzzleDifficulty;
  board: Board;
  lastPickedTile: Tile;
  solution: Array<{ row: number; col: number }>;
  hint: string;
}

// ============================================================
// REPLAYS
// ============================================================

export interface ReplayMove {
  row: number;
  col: number;
  player: 'red' | 'black';
  tile: Tile;
  timestamp: number;
}

export interface ReplayMeta {
  gameId: string;
  board: Board;
  lastPickedTile: Tile | null;
  players: { red: string; black: string };
  roomId: string;
  maxWins: number;
  startedAt: number;
}

export interface Replay {
  meta: ReplayMeta;
  moves: ReplayMove[];
}