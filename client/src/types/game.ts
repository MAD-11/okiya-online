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
  guestSkin: string; // FIX: добавлено поле для скина гостя
}

export type ValidMoves = boolean[][];