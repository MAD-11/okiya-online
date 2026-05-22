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