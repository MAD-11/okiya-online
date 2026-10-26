import { saveReplayMeta, saveReplayMove, getReplay, ReplayMeta } from '../src/replay';
import { initBoard } from '../src/game/Board';

// В CI Redis доступен через services.redis (docker)
// Локально — docker run -p 6379:6379 -d redis

const testGameId = 'test-replay-' + Date.now();

describe('Replay module', () => {
  test('getReplay returns null meta for unknown gameId', async () => {
    const { meta, moves } = await getReplay('nonexistent-game-id');
    expect(meta).toBeNull();
    expect(moves).toEqual([]);
  });

  test('saveReplayMeta + getReplay returns saved meta', async () => {
    const meta: ReplayMeta = {
      gameId: testGameId,
      board: initBoard(),
      lastPickedTile: null,
      players: { red: 'player-red', black: 'player-black' },
      roomId: 'ABCD',
      maxWins: 1,
      startedAt: Date.now(),
    };
    await saveReplayMeta(meta);
    const { meta: loaded } = await getReplay(testGameId);
    expect(loaded).not.toBeNull();
    expect(loaded?.gameId).toBe(testGameId);
    expect(loaded?.players.red).toBe('player-red');
    expect(loaded?.board).toHaveLength(4);
  });

  test('saveReplayMove appends moves in order', async () => {
    await saveReplayMove(testGameId, {
      row: 0,
      col: 0,
      player: 'red',
      tile: { plant: 'sakura', symbol: 'sun' },
      timestamp: Date.now(),
    });
    await saveReplayMove(testGameId, {
      row: 1,
      col: 1,
      player: 'black',
      tile: { plant: 'iris', symbol: 'rain' },
      timestamp: Date.now(),
    });
    const { moves } = await getReplay(testGameId);
    expect(moves).toHaveLength(2);
    expect(moves[0].player).toBe('red');
    expect(moves[0].row).toBe(0);
    expect(moves[1].player).toBe('black');
    expect(moves[1].tile.plant).toBe('iris');
  });

  test('moves preserve chronological order', async () => {
    const { moves } = await getReplay(testGameId);
    expect(moves[0].row).toBe(0);
    expect(moves[1].row).toBe(1);
  });
});