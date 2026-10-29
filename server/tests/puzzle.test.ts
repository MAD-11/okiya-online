import {
  generateWinIn1,
  generateWinIn1WithDecoys,
  generateBlockPuzzle,
} from '../src/puzzle/generator';
import { checkWin } from '../src/game/Board';
import { Cell, Tile } from '../src/game/types';

const isTile = (c: Cell): c is Tile => !!c && typeof c !== 'string';

describe('generateWinIn1 (easy)', () => {
  test('produces valid puzzle (100 runs)', () => {
    for (let i = 0; i < 100; i++) {
      const p = generateWinIn1();
      expect(p.difficulty).toBe(1);
      expect(p.type).toBe('win');
      expect(p.solution).toHaveLength(1);
      expect(p.board).toHaveLength(4);
    }
  });

  test('has exactly 3 red stones', () => {
    const p = generateWinIn1();
    const reds = p.board.flat().filter(c => c === 'red').length;
    expect(reds).toBe(3);
  });

  test('solution move wins', () => {
    for (let i = 0; i < 30; i++) {
      const p = generateWinIn1();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const sim = p.board.map(row => [...row]);
      sim[r][c] = 'red';
      expect(checkWin(sim, 'red')).toBe(true);
    }
  });

  test('answer tile matches lastPickedTile', () => {
    for (let i = 0; i < 30; i++) {
      const p = generateWinIn1();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const tile = p.board[r][c] as Tile;
      const ok = tile.plant === p.lastPickedTile.plant || tile.symbol === p.lastPickedTile.symbol;
      expect(ok).toBe(true);
    }
  });
});

describe('generateWinIn1WithDecoys (medium)', () => {
  test('produces valid puzzle (50 runs)', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateWinIn1WithDecoys();
      expect(p.difficulty).toBe(2);
      expect(p.type).toBe('win-hard');
      expect(p.solution).toHaveLength(1);
      expect(p.board).toHaveLength(4);
    }
  });

  test('solution move wins', () => {
    for (let i = 0; i < 30; i++) {
      const p = generateWinIn1WithDecoys();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const sim = p.board.map(row => [...row]);
      sim[r][c] = 'red';
      expect(checkWin(sim, 'red')).toBe(true);
    }
  });

  test('solution tile matches lastPickedTile', () => {
    for (let i = 0; i < 30; i++) {
      const p = generateWinIn1WithDecoys();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const tile = p.board[r][c] as Tile;
      const ok = tile.plant === p.lastPickedTile.plant || tile.symbol === p.lastPickedTile.symbol;
      expect(ok).toBe(true);
    }
  });
});

describe('generateBlockPuzzle (hard)', () => {
  test('produces valid puzzle (30 runs)', () => {
    for (let i = 0; i < 30; i++) {
      const p = generateBlockPuzzle();
      expect(p.difficulty).toBe(3);
      expect(p.type).toBe('block');
      expect(p.solution).toHaveLength(1);
      expect(p.board).toHaveLength(4);
    }
  });

  test('has exactly 3 black stones in a line', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateBlockPuzzle();
      const blacks = p.board.flat().filter(c => c === 'black').length;
      expect(blacks).toBe(3);
    }
  });

  test('solution blocks black from completing the line', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateBlockPuzzle();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const sim = p.board.map(row => [...row]);
      sim[r][c] = 'red';
      // После блока у чёрных нет 4 в ряд
      expect(checkWin(sim, 'black')).toBe(false);
    }
  });

  test('without block, black would win next move', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateBlockPuzzle();
      const [br, bc] = [p.solution[0].row, p.solution[0].col];

      // Симулируем "плохой ход" игрока: не берём G, а берём другую фишку
      // (в тесте просто проверим, что в гэпе — чёрный мог бы выиграть)
      const sim = p.board.map(row => [...row]);
      sim[br][bc] = 'black'; // если бы чёрные взяли — победа
      expect(checkWin(sim, 'black')).toBe(true);
    }
  });

  test('solution tile is legal (matches lastPickedTile)', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateBlockPuzzle();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const tile = p.board[r][c] as Tile;
      expect(isTile(tile)).toBe(true);
      const ok = tile.plant === p.lastPickedTile.plant || tile.symbol === p.lastPickedTile.symbol;
      expect(ok).toBe(true);
    }
  });
});