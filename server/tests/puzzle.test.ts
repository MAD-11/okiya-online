import { generateWinIn1, generateWinIn2Safe } from '../src/puzzle/generator';
import { Tile, Cell } from '../src/game/types';

const isTile = (c: Cell): c is Tile =>
  !!c && typeof c !== 'string';

describe('generateWinIn1', () => {
  test('produces valid puzzle (100 random runs)', () => {
    for (let i = 0; i < 100; i++) {
      const p = generateWinIn1();
      expect(p.difficulty).toBe(1);
      expect(p.solution).toHaveLength(1);
      expect(p.board).toHaveLength(4);
      expect(p.board[0]).toHaveLength(4);
      expect(p.hint.length).toBeGreaterThan(0);
    }
  });

  test('has exactly 3 red stones and 1 empty answer cell in a winning line', () => {
    const p = generateWinIn1();
    const reds = p.board.flat().filter(c => c === 'red').length;
    expect(reds).toBe(3);

    const [r, c] = [p.solution[0].row, p.solution[0].col];
    expect(isTile(p.board[r][c])).toBe(true);
  });

  test('lastPickedTile matches answer tile (plant OR symbol)', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateWinIn1();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const answerTile = p.board[r][c] as Tile;
      const last = p.lastPickedTile;
      const ok = answerTile.plant === last.plant || answerTile.symbol === last.symbol;
      expect(ok).toBe(true);
    }
  });

  test('solution move indeed creates a win', () => {
    for (let i = 0; i < 30; i++) {
      const p = generateWinIn1();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const simulated = p.board.map(row => [...row]);
      simulated[r][c] = 'red';
      // Проверяем через checkWin из Board.ts
      const { checkWin } = require('../src/game/Board');
      expect(checkWin(simulated, 'red')).toBe(true);
    }
  });
});

describe('generateWinIn2Safe', () => {
  test('produces valid puzzle (50 random runs)', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateWinIn2Safe();
      expect([1, 2]).toContain(p.difficulty);
      expect(p.solution.length).toBeGreaterThanOrEqual(1);
      expect(p.board).toHaveLength(4);
    }
  });

  test('has exactly 2 red stones and 2 answer cells in a winning line', () => {
    // Может сработать fallback на win-in-1, поэтому проверяем только если difficulty===2
    for (let i = 0; i < 30; i++) {
      const p = generateWinIn2Safe();
      if (p.difficulty !== 2) continue;

      const reds = p.board.flat().filter(c => c === 'red').length;
      expect(reds).toBe(2);

      for (const move of p.solution) {
        expect(isTile(p.board[move.row][move.col])).toBe(true);
      }
    }
  });

  test('first solution cell matches lastPickedTile', () => {
    for (let i = 0; i < 30; i++) {
      const p = generateWinIn2Safe();
      if (p.difficulty !== 2) continue;

      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const tile1 = p.board[r][c] as Tile;
      const last = p.lastPickedTile;
      expect(tile1.plant === last.plant || tile1.symbol === last.symbol).toBe(true);
    }
  });

  test('second solution cell does NOT match lastPickedTile (unique order)', () => {
    for (let i = 0; i < 30; i++) {
      const p = generateWinIn2Safe();
      if (p.difficulty !== 2) continue;

      const [r, c] = [p.solution[1].row, p.solution[1].col];
      const tile2 = p.board[r][c] as Tile;
      const last = p.lastPickedTile;
      const matches2 = tile2.plant === last.plant || tile2.symbol === last.symbol;
      expect(matches2).toBe(false);
    }
  });

  test('applying both solution moves wins', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateWinIn2Safe();
      if (p.difficulty !== 2) continue;

      const simulated = p.board.map(row => [...row]);
      for (const move of p.solution) {
        simulated[move.row][move.col] = 'red';
      }
      const { checkWin } = require('../src/game/Board');
      expect(checkWin(simulated, 'red')).toBe(true);
    }
  });
});