import { Board, Tile } from '../game/types';
import { checkWin } from '../game/Board';
import { evaluatePosition, isValidForColor, WIN_SCORE } from '../game/evaluate';
import { ReplayMeta, ReplayMove } from '../replay';

export type Verdict = 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveAnalysis {
  moveIndex: number;
  player: 'red' | 'black';
  actual: { row: number; col: number };
  best: { row: number; col: number };
  bestScore: number;
  actualScore: number;
  delta: number;
  verdict: Verdict;
  isBest: boolean;
  actualWasWinning: boolean;   // actual ход выигрывал игру?
  bestWasWinning: boolean;     // best ход выигрывал?
}

export interface PlayerStats {
  accuracy: number;            // 0..100
  brilliant: number;
  good: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
  moves: number;
}

export interface GameAnalysis {
  gameId: string;
  depth: number;
  moves: MoveAnalysis[];
  stats: { red: PlayerStats; black: PlayerStats };
  analyzedAt: number;
}

// ============================================================
// Классификация по дельте
// ============================================================
const THRESHOLD_GOOD = 30;
const THRESHOLD_INACCURACY = 100;
const THRESHOLD_MISTAKE = 300;

function classifyVerdict(delta: number, bestScore: number, actualScore: number): Verdict {
  const bestWins = bestScore >= WIN_SCORE;
  const actualWins = actualScore >= WIN_SCORE;

  if (bestWins && actualWins) {
    // Оба хода выигрывают — значит, есть несколько выигрышных, actual тоже выигрывает
    return delta === 0 ? 'brilliant' : 'good';
  }
  if (delta <= THRESHOLD_GOOD) return 'good';
  if (delta <= THRESHOLD_INACCURACY) return 'inaccuracy';
  if (delta <= THRESHOLD_MISTAKE) return 'mistake';
  return 'blunder';
}

// ============================================================
// Все legal ходы из позиции
// ============================================================
function getLegalMoves(
  board: Board,
  lastTile: Tile | null
): Array<{ row: number; col: number; tile: Tile }> {
  const moves: Array<{ row: number; col: number; tile: Tile }> = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!isValidForColor(board, r, c, lastTile)) continue;
      moves.push({ row: r, col: c, tile: board[r][c] as Tile });
    }
  }
  return moves;
}

// ============================================================
// Оценка одного хода (depth=1 — без симуляции ответа соперника)
// ============================================================
function scoreMove(
  board: Board,
  candidate: { row: number; col: number; tile: Tile },
  playerColor: 'red' | 'black'
): number {
  const sim = board.map(row => [...row]);
  sim[candidate.row][candidate.col] = playerColor;

  if (checkWin(sim, playerColor)) return WIN_SCORE;

  const oppColor = playerColor === 'red' ? 'black' : 'red';
  return evaluatePosition(sim, playerColor, oppColor, candidate.tile);
}

// ============================================================
// Главная функция: анализ всей партии
// ============================================================
export function analyzeGame(meta: ReplayMeta, moves: ReplayMove[]): GameAnalysis {
  let board: Board = meta.board.map(row => [...row]);
  let lastTile: Tile | null = meta.lastPickedTile;

  const result: MoveAnalysis[] = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const playerColor = move.player;

    const legal = getLegalMoves(board, lastTile);
    if (legal.length === 0) {
      // Не должно случаться в завершённой партии, но на всякий случай
      break;
    }

    const scored = legal.map(m => ({ ...m, score: scoreMove(board, m, playerColor) }));

    // Лучший ход
    let best = scored[0];
    for (const s of scored) {
      if (s.score > best.score) best = s;
    }

    // Фактический ход
    const actual = scored.find(
      s => s.row === move.row && s.col === move.col
    );
    const actualScore = actual?.score ?? -Infinity;

    const delta = Math.max(0, best.score - actualScore);
    const verdict = classifyVerdict(delta, best.score, actualScore);
    const isBest = best.row === move.row && best.col === move.col;

    result.push({
      moveIndex: i,
      player: playerColor,
      actual: { row: move.row, col: move.col },
      best: { row: best.row, col: best.col },
      bestScore: best.score,
      actualScore,
      delta,
      verdict: isBest ? 'brilliant' : verdict,
      isBest,
      actualWasWinning: actualScore >= WIN_SCORE,
      bestWasWinning: best.score >= WIN_SCORE,
    });

    // Применяем actual ход к доске
    board[move.row][move.col] = playerColor;
    lastTile = move.tile;
  }

  // Статистика по игрокам
  const buildStats = (playerColor: 'red' | 'black'): PlayerStats => {
    const playerMoves = result.filter(m => m.player === playerColor);
    const stats: PlayerStats = {
      accuracy: 0,
      brilliant: 0,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      moves: playerMoves.length,
    };
    for (const m of playerMoves) {
      stats[m.verdict]++;
    }
    if (playerMoves.length > 0) {
      // accuracy = (brilliant + good + 0.5*inaccuracy) / total * 100
      const effectiveScore =
        stats.brilliant * 1.0 +
        stats.good * 1.0 +
        stats.inaccuracy * 0.5;
      stats.accuracy = Math.round((effectiveScore / playerMoves.length) * 100);
    }
    return stats;
  };

  return {
    gameId: meta.gameId,
    depth: 1,
    moves: result,
    stats: {
      red: buildStats('red'),
      black: buildStats('black'),
    },
    analyzedAt: Date.now(),
  };
}