import { generateWinIn1, generateBlockPuzzle } from '../src/puzzle/generator';
import { checkWin } from '../src/game/Board';
import { Cell, Tile } from '../src/game/types';

const isTile = (c: Cell): c is Tile => !!c && typeof c !== 'string';

describe('generateWinIn1', () => {
  test('produces valid puzzle (100 runs)', () => {
    for (let i = 0; i < 100; i++) {
      const p = generateWinIn1();
      expect(p.difficulty).toBe(1);
      expect(p.type).toBe('win');
      expect(p.solution).toHaveLength(1);
      expect(p.board).toHaveLength(4);
    }
  });

  test('has exactly 3 red and 3 black stones (balanced counts)', () => {
    for (let i = 0; i < 100; i++) {
      const p = generateWinIn1();
      const reds = p.board.flat().filter(c => c === 'red').length;
      const blacks = p.board.flat().filter(c => c === 'black').length;
      expect(reds).toBe(3);
      expect(blacks).toBe(3);
    }
  });

  test('solution move wins', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateWinIn1();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const sim = p.board.map(row => [...row]);
      sim[r][c] = 'red';
      expect(checkWin(sim, 'red')).toBe(true);
    }
  });

  test('answer tile matches lastPickedTile (legal move)', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateWinIn1();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const tile = p.board[r][c] as Tile;
      expect(isTile(tile)).toBe(true);
      const ok = tile.plant === p.lastPickedTile.plant || tile.symbol === p.lastPickedTile.symbol;
      expect(ok).toBe(true);
    }
  });

  test('answer tile is different from lastPickedTile', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateWinIn1();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const tile = p.board[r][c] as Tile;
      const same = tile.plant === p.lastPickedTile.plant && tile.symbol === p.lastPickedTile.symbol;
      expect(same).toBe(false);
    }
  });

  test('lastPickedTile is not present on the board (was picked)', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateWinIn1();
      const cells = p.board.flat().filter(isTile);
      const same = cells.some(
        t => t.plant === p.lastPickedTile.plant && t.symbol === p.lastPickedTile.symbol
      );
      expect(same).toBe(false);
    }
  });
});

describe('generateBlockPuzzle', () => {
  test('produces valid puzzle (100 runs)', () => {
    for (let i = 0; i < 100; i++) {
      const p = generateBlockPuzzle();
      expect(p.difficulty).toBe(2);
      expect(p.type).toBe('block');
      expect(p.solution).toHaveLength(1);
      expect(p.board).toHaveLength(4);
    }
  });

  test('has exactly 3 black and 3 red stones (balanced counts)', () => {
    for (let i = 0; i < 100; i++) {
      const p = generateBlockPuzzle();
      const reds = p.board.flat().filter(c => c === 'red').length;
      const blacks = p.board.flat().filter(c => c === 'black').length;
      expect(reds).toBe(3);
      expect(blacks).toBe(3);
    }
  });

  test('without block, black would win next move', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateBlockPuzzle();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const sim = p.board.map(row => [...row]);
      sim[r][c] = 'black';
      expect(checkWin(sim, 'black')).toBe(true);
    }
  });

  test('after block, black cannot win', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateBlockPuzzle();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const sim = p.board.map(row => [...row]);
      sim[r][c] = 'red';
      expect(checkWin(sim, 'black')).toBe(false);
    }
  });

  test('gap tile matches lastPickedTile (legal move)', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateBlockPuzzle();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const tile = p.board[r][c] as Tile;
      expect(isTile(tile)).toBe(true);
      const ok = tile.plant === p.lastPickedTile.plant || tile.symbol === p.lastPickedTile.symbol;
      expect(ok).toBe(true);
    }
  });

  test('gap tile is different from lastPickedTile', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateBlockPuzzle();
      const [r, c] = [p.solution[0].row, p.solution[0].col];
      const tile = p.board[r][c] as Tile;
      const same = tile.plant === p.lastPickedTile.plant && tile.symbol === p.lastPickedTile.symbol;
      expect(same).toBe(false);
    }
  });

  test('lastPickedTile is not present on the board', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateBlockPuzzle();
      const cells = p.board.flat().filter(isTile);
      const same = cells.some(
        t => t.plant === p.lastPickedTile.plant && t.symbol === p.lastPickedTile.symbol
      );
      expect(same).toBe(false);
    }
  });
});