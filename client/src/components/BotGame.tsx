import React, { useState, useEffect, useCallback, useRef } from 'react';
import Board from './Board';
import Timer from './Timer';
import LastPickedTile from './LastPickedTile';
import { initBoard, checkWin, isValidMove } from '../game/gameLogic';
import { Tile, Board as BoardType, GameStatus } from '../types/game';
import { playMoveSound, playWinSound, playLoseSound, playDrawSound } from '../utils/sound';
import { useTheme } from '../contexts/ThemeContext';
import ConfirmDialog from './ConfirmDialog';

interface BotGameProps {
  onClose: () => void;
  difficulty: 'easy' | 'medium' | 'hard';
}

const WIN_SCORE = 100000;
const BLOCK_WIN_SCORE = 90000;
const CREATE_THREE_SCORE = 1000;
const BLOCK_THREE_SCORE = 800;
const CREATE_TWO_SCORE = 40;
const BLOCK_TWO_SCORE = 30;
const CENTER_BONUS = 8;
const FLEXIBILITY_BONUS = 2;

const difficultyLabel: Record<'easy' | 'medium' | 'hard', string> = {
  easy: '🟢 Лёгкий',
  medium: '🟡 Средний',
  hard: '🔴 Сложный',
};

const countLines = (board: BoardType, color: 'red' | 'black', count: number): number => {
  let result = 0;
  for (let i = 0; i < 4; i++) {
    const row = board[i];
    if (row.filter(c => c === color).length === count &&
        row.filter(c => c !== color && typeof c !== 'string').length === 0) result++;
  }
  for (let j = 0; j < 4; j++) {
    let cc = 0, oo = 0;
    for (let i = 0; i < 4; i++) {
      if (board[i][j] === color) cc++;
      else if (board[i][j] !== null && typeof board[i][j] !== 'string') oo++;
    }
    if (cc === count && oo === 0) result++;
  }
  const d1 = [board[0][0], board[1][1], board[2][2], board[3][3]];
  if (d1.filter(c => c === color).length === count &&
      d1.filter(c => c !== color && typeof c !== 'string').length === 0) result++;
  const d2 = [board[0][3], board[1][2], board[2][1], board[3][0]];
  if (d2.filter(c => c === color).length === count &&
      d2.filter(c => c !== color && typeof c !== 'string').length === 0) result++;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cells = [board[r][c], board[r][c + 1], board[r + 1][c], board[r + 1][c + 1]];
      if (cells.filter(c2 => c2 === color).length === count &&
          cells.filter(c2 => c2 !== color && typeof c2 !== 'string').length === 0) result++;
    }
  }
  return result;
};

const canWinNextMove = (board: BoardType, color: 'red' | 'black', last: Tile | null): boolean => {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (!isValidMove(board, r, c, last)) continue;
    const nb = board.map(row => [...row]);
    nb[r][c] = color;
    if (checkWin(nb, color)) return true;
  }
  return false;
};

const getValidMoves = (board: BoardType, last: Tile | null) => {
  const moves: { row: number; col: number; tile: Tile }[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (!isValidMove(board, r, c, last)) continue;
    moves.push({ row: r, col: c, tile: board[r][c] as Tile });
  }
  return moves;
};

const evaluatePosition = (board: BoardType, bot: 'red' | 'black', player: 'red' | 'black', last: Tile | null): number => {
  let score = 0;
  if (checkWin(board, bot)) return WIN_SCORE;
  if (canWinNextMove(board, player, last)) score -= BLOCK_WIN_SCORE;
  score += countLines(board, bot, 3) * CREATE_THREE_SCORE;
  score += countLines(board, bot, 2) * CREATE_TWO_SCORE;
  score -= countLines(board, player, 3) * BLOCK_THREE_SCORE;
  score -= countLines(board, player, 2) * BLOCK_TWO_SCORE;
  for (const [r, c] of [[1, 1], [1, 2], [2, 1], [2, 2]]) {
    if (board[r][c] === bot) score += CENTER_BONUS;
    else if (board[r][c] === player) score -= CENTER_BONUS / 2;
  }
  score += getValidMoves(board, last).length * FLEXIBILITY_BONUS;
  return score;
};

const minimax = (board: BoardType, depth: number, isBot: boolean, bot: 'red' | 'black', player: 'red' | 'black', last: Tile | null): number => {
  if (depth === 0) return evaluatePosition(board, bot, player, last);
  const moves = getValidMoves(board, last);
  if (moves.length === 0) return isBot ? -WIN_SCORE : WIN_SCORE;
  if (isBot) {
    let best = -Infinity;
    for (const m of moves) {
      const nb = board.map(row => [...row]);
      nb[m.row][m.col] = bot;
      best = Math.max(best, minimax(nb, depth - 1, false, bot, player, m.tile));
    }
    return best;
  } else {
    let worst = Infinity;
    for (const m of moves) {
      const nb = board.map(row => [...row]);
      nb[m.row][m.col] = player;
      worst = Math.min(worst, minimax(nb, depth - 1, true, bot, player, m.tile));
    }
    return worst;
  }
};

const BotGame: React.FC<BotGameProps> = ({ onClose, difficulty }) => {
  const { skin } = useTheme();

  const [board, setBoard] = useState<BoardType>(() => initBoard());
  const [lastPickedTile, setLastPickedTile] = useState<Tile | null>(null);
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<'red' | 'black'>('red');
  const [status, setStatus] = useState<GameStatus>('playing');
  const [message, setMessage] = useState('');
  const [waitingBot, setWaitingBot] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [turnStartedAt, setTurnStartedAt] = useState(Date.now());

  const playerColor: 'red' | 'black' = 'red';
  const botColor: 'red' | 'black' = 'black';

  const boardRef = useRef(board);
  const lastPickedTileRef = useRef(lastPickedTile);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { lastPickedTileRef.current = lastPickedTile; }, [lastPickedTile]);

  useEffect(() => {
    if (currentPlayer !== botColor || status !== 'playing' || gameOver) return;
    setWaitingBot(true);
    const timer = setTimeout(() => {
      const cb = boardRef.current;
      const cl = lastPickedTileRef.current;
      const moves = getValidMoves(cb, cl);
      if (moves.length === 0) {
        setStatus('finished'); setGameOver(true);
        setMessage('🎉 Вы победили (бот заблокирован)!');
        playWinSound(); setWaitingBot(false); return;
      }
      let chosenMove: { row: number; col: number; tile: Tile };
      if (difficulty === 'easy') {
        chosenMove = moves[Math.floor(Math.random() * moves.length)];
      } else {
        const depth = difficulty === 'hard' ? 1 : 0;
        let bestMoves = [moves[0]];
        let bestScore = -Infinity;
        for (const m of moves) {
          const tb = cb.map(r => [...r]);
          tb[m.row][m.col] = botColor;
          const sc = depth === 0
            ? evaluatePosition(tb, botColor, playerColor, m.tile)
            : minimax(tb, depth, false, botColor, playerColor, m.tile);
          if (sc > bestScore) { bestScore = sc; bestMoves = [m]; }
          else if (Math.abs(sc - bestScore) < 0.1) bestMoves.push(m);
        }
        chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
      }
      const { row, col, tile } = chosenMove;
      const nb = cb.map(r => [...r]);
      nb[row][col] = botColor;
      setBoard(nb);
      setLastPickedTile(tile);
      setLastMove({ row, col });
      playMoveSound();
      if (checkWin(nb, botColor)) {
        setStatus('finished'); setGameOver(true);
        setMessage('🤖 Бот победил!');
        playLoseSound(); setWaitingBot(false); return;
      }
      const isFull = nb.every(r => r.every(c => typeof c === 'string'));
      if (isFull) {
        setStatus('finished'); setGameOver(true);
        setMessage('Ничья!'); playDrawSound(); setWaitingBot(false); return;
      }
      let hasPlayerMove = false;
      for (let r = 0; r < 4 && !hasPlayerMove; r++) for (let c = 0; c < 4 && !hasPlayerMove; c++) {
        if (isValidMove(nb, r, c, tile)) hasPlayerMove = true;
      }
      if (!hasPlayerMove) {
        setStatus('finished'); setGameOver(true);
        setMessage('🤖 Бот победил (вы заблокированы)!');
        playLoseSound(); setWaitingBot(false); return;
      }
      setCurrentPlayer(playerColor);
      setTurnStartedAt(Date.now());
      setWaitingBot(false);
    }, 400);
    return () => { clearTimeout(timer); setWaitingBot(false); };
  }, [currentPlayer, status, gameOver, botColor, playerColor, difficulty]);

  const handlePlayerMove = useCallback((row: number, col: number) => {
    if (status !== 'playing' || currentPlayer !== playerColor || gameOver) return;
    const cell = board[row][col];
    if (!cell || typeof cell === 'string') return;
    if (!isValidMove(board, row, col, lastPickedTile)) {
      setMessage('❌ Неправильный ход');
      setTimeout(() => setMessage(''), 1000);
      return;
    }
    const nb = board.map(r => [...r]);
    nb[row][col] = playerColor;
    setBoard(nb);
    setLastPickedTile(cell as Tile);
    setLastMove({ row, col });
    playMoveSound();
    if (checkWin(nb, playerColor)) {
      setStatus('finished'); setGameOver(true);
      setMessage('🎉 Вы победили!'); playWinSound(); return;
    }
    const isFull = nb.every(r => r.every(c => typeof c === 'string'));
    if (isFull) {
      setStatus('finished'); setGameOver(true);
      setMessage('Ничья!'); playDrawSound(); return;
    }
    setCurrentPlayer(botColor);
    setTurnStartedAt(Date.now());
  }, [board, currentPlayer, lastPickedTile, status, gameOver, playerColor, botColor]);

  const resetGame = () => {
    setBoard(initBoard());
    setLastPickedTile(null);
    setLastMove(null);
    setCurrentPlayer('red');
    setStatus('playing');
    setMessage('');
    setGameOver(false);
    setTurnStartedAt(Date.now());
    setWaitingBot(false);
  };

  const handleExit = () => setConfirmExitOpen(true);
  const confirmExit = () => { setConfirmExitOpen(false); onClose(); };

  const validMovesForDisplay = (() => {
    if (currentPlayer !== playerColor || status !== 'playing' || gameOver) {
      return Array(4).fill(null).map(() => Array(4).fill(false));
    }
    const moves = getValidMoves(board, lastPickedTile);
    const display = Array(4).fill(null).map(() => Array(4).fill(false));
    moves.forEach(m => { display[m.row][m.col] = true; });
    return display;
  })();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>🤖 Игра с ботом — {difficultyLabel[difficulty]}</h2>
        <button onClick={handleExit} style={styles.closeBtn}>✕</button>
      </header>
      <div style={styles.statusBar}>
        <span style={{ fontSize: 14 }}>Вы — 🔴 красные, Бот — ⚫ чёрные</span>
      </div>
      <div style={styles.gameArea}>
        <div style={styles.boardWrapper}>
          <Board
            board={board}
            validMoves={validMovesForDisplay}
            onClick={handlePlayerMove}
            currentPlayer={currentPlayer}
            myColor={playerColor}
            lastMove={lastMove}
            hostSkin={skin}
            guestSkin={skin}
            shake={false}
          />
          <LastPickedTile tile={lastPickedTile} />
        </div>
        <div style={styles.infoPanel}>
          {status === 'playing' && (
            <div style={styles.turnInfo}>
              <p>{currentPlayer === playerColor ? '☀️ Ваш ход' : '🌙 Ход бота...'}</p>
              {currentPlayer === playerColor && <Timer turnStartedAt={turnStartedAt} turnDuration={30000} />}
              {waitingBot && <p style={{ fontSize: 13 }}>Бот думает...</p>}
            </div>
          )}
          {gameOver && (
            <div style={styles.gameOverPanel}>
              <p style={styles.message}>{message}</p>
              <button onClick={resetGame} style={styles.playAgainBtn}>Сыграть ещё</button>
            </div>
          )}
          <div style={styles.buttons}>
            <button onClick={resetGame} style={styles.resetBtn}>Начать заново</button>
            <button onClick={handleExit} style={styles.exitBtn}>Выйти в меню</button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmExitOpen}
        title="Выйти из игры с ботом?"
        message="Текущая игра будет потеряна. Вы уверены?"
        onConfirm={confirmExit}
        onCancel={() => setConfirmExitOpen(false)}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    zIndex: 2000,
    color: 'var(--text)',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    backgroundColor: 'var(--bg)',
    backgroundImage: 'var(--bg-decor-1), var(--bg-decor-2)',
    backgroundAttachment: 'fixed',
    backgroundSize: 'cover',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    background: 'var(--card-bg)',
    borderBottom: '1px solid var(--border)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: '0.5px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: 'var(--secondary-text)',
    padding: '4px 8px',
    borderRadius: '8px',
    transition: 'all 0.2s',
  },
  statusBar: {
    textAlign: 'center',
    padding: '10px 16px',
    background: 'var(--card-bg)',
    borderBottom: '1px solid var(--border)',
    fontSize: '12px',
    color: 'var(--secondary-text)',
    letterSpacing: '1px',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  gameArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    gap: '24px',
  },
  boardWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  infoPanel: {
    textAlign: 'center',
    minWidth: '260px',
  },
  turnInfo: {
    marginBottom: '16px',
    color: 'var(--text)',
    fontSize: '14px',
    letterSpacing: '1px',
  },
  gameOverPanel: {
    marginBottom: '16px',
    padding: '16px 20px',
    background: 'var(--card-bg)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  message: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '14px',
    color: 'var(--text)',
  },
  playAgainBtn: {
    padding: '12px 28px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
    transition: 'all 0.2s',
  },
  buttons: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  resetBtn: {
    padding: '11px 22px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  exitBtn: {
    padding: '11px 22px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 4px 16px rgba(232,165,192,0.3)',
    transition: 'all 0.2s',
  },
};

export default BotGame;