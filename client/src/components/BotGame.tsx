import React, { useState, useEffect, useCallback } from 'react';
import Board from './Board';
import Timer from './Timer';
import LastPickedTile from './LastPickedTile';
import { initBoard, checkWin } from '../game/gameLogic';
import { Tile, Board as BoardType, GameStatus } from '../types/game';
import { playMoveSound, playWinSound, playLoseSound, playDrawSound, initAudio } from '../utils/sound';
import ConfirmDialog from './ConfirmDialog';

interface BotGameProps {
  onClose: () => void;
}

// Константы весов эвристики
const WIN_SCORE = 100000;
const BLOCK_WIN_SCORE = 90000;
const CREATE_THREE_SCORE = 1000;
const BLOCK_THREE_SCORE = 800;
const CREATE_TWO_SCORE = 40;
const BLOCK_TWO_SCORE = 30;
const CENTER_BONUS = 8;
const FLEXIBILITY_BONUS = 2;
const RANDOM_FACTOR = 15;

// Подсчёт количества линий (горизонталь, вертикаль, диагональ, квадрат), где есть ровно count камней цвета color и нет камней противника
// Возвращает количество таких линий
const countLines = (board: BoardType, color: 'red' | 'black', count: number): number => {
  let result = 0;
  // Горизонтали
  for (let i = 0; i < 4; i++) {
    const row = board[i];
    const colorCount = row.filter(cell => cell === color).length;
    const opponentCount = row.filter(cell => cell !== color && typeof cell !== 'string').length;
    if (colorCount === count && opponentCount === 0) result++;
  }
  // Вертикали
  for (let j = 0; j < 4; j++) {
    let colorCnt = 0, oppCnt = 0;
    for (let i = 0; i < 4; i++) {
      if (board[i][j] === color) colorCnt++;
      else if (board[i][j] !== null && typeof board[i][j] !== 'string') oppCnt++;
    }
    if (colorCnt === count && oppCnt === 0) result++;
  }
  // Главная диагональ
  const diag1 = [board[0][0], board[1][1], board[2][2], board[3][3]];
  let d1color = 0, d1opp = 0;
  diag1.forEach(cell => {
    if (cell === color) d1color++;
    else if (cell !== null && typeof cell !== 'string') d1opp++;
  });
  if (d1color === count && d1opp === 0) result++;
  // Побочная диагональ
  const diag2 = [board[0][3], board[1][2], board[2][1], board[3][0]];
  let d2color = 0, d2opp = 0;
  diag2.forEach(cell => {
    if (cell === color) d2color++;
    else if (cell !== null && typeof cell !== 'string') d2opp++;
  });
  if (d2color === count && d2opp === 0) result++;
  // Квадраты 2x2 (для count = 2, 3? Для победы в квадрате нужно 4 камня, но для оценки промежуточных – учитываем количество камней в квадрате)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cells = [board[r][c], board[r][c+1], board[r+1][c], board[r+1][c+1]];
      let colorCnt = 0, oppCnt = 0;
      cells.forEach(cell => {
        if (cell === color) colorCnt++;
        else if (cell !== null && typeof cell !== 'string') oppCnt++;
      });
      if (colorCnt === count && oppCnt === 0) result++;
    }
  }
  return result;
};

// Проверка, может ли игрок выиграть следующим ходом (наличие линии из 3 или квадрата 3/4)
const canWinNextMove = (board: BoardType, color: 'red' | 'black', lastTile: Tile | null): boolean => {
  // Перебираем все возможные ходы для цвета
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const cell = board[r][c];
      if (!cell || typeof cell === 'string') continue;
      let canMove = false;
      if (!lastTile) {
        if ((r === 0 || r === 3 || c === 0 || c === 3) && !(r === 1 && c === 1) && !(r === 1 && c === 2) && !(r === 2 && c === 1) && !(r === 2 && c === 2)) {
          canMove = true;
        }
      } else {
        const tile = cell as Tile;
        if (tile.plant === lastTile.plant || tile.symbol === lastTile.symbol) {
          canMove = true;
        }
      }
      if (!canMove) continue;
      const newBoard = board.map(row => [...row]);
      newBoard[r][c] = color;
      if (checkWin(newBoard, color)) return true;
    }
  }
  return false;
};

// Генерация всех допустимых ходов для заданного цвета
const getValidMoves = (board: BoardType, lastTile: Tile | null, color: 'red' | 'black'): { row: number; col: number; tile: Tile }[] => {
  const moves: { row: number; col: number; tile: Tile }[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const cell = board[r][c];
      if (!cell || typeof cell === 'string') continue;
      let isValid = false;
      if (!lastTile) {
        if ((r === 0 || r === 3 || c === 0 || c === 3) && !(r === 1 && c === 1) && !(r === 1 && c === 2) && !(r === 2 && c === 1) && !(r === 2 && c === 2)) {
          isValid = true;
        }
      } else {
        const tile = cell as Tile;
        if (tile.plant === lastTile.plant || tile.symbol === lastTile.symbol) {
          isValid = true;
        }
      }
      if (isValid) {
        moves.push({ row: r, col: c, tile: cell as Tile });
      }
    }
  }
  return moves;
};

// Оценка позиции (чем выше, тем лучше для бота)
const evaluatePosition = (
  board: BoardType,
  botColor: 'red' | 'black',
  playerColor: 'red' | 'black',
  lastTile: Tile | null
): number => {
  let score = 0;
  // 1. Победа бота
  if (checkWin(board, botColor)) return WIN_SCORE;
  // 2. Возможность победы игрока (если игрок может выиграть следующим ходом, то это очень плохо для бота)
  if (canWinNextMove(board, playerColor, lastTile)) {
    // Бот должен предотвратить это, оценим штраф
    score -= BLOCK_WIN_SCORE;
  }
  // 3. Свои линии из 2 и 3
  const bot3 = countLines(board, botColor, 3);
  const bot2 = countLines(board, botColor, 2);
  score += bot3 * CREATE_THREE_SCORE;
  score += bot2 * CREATE_TWO_SCORE;
  // 4. Линии игрока (чем больше, тем хуже для бота)
  const player3 = countLines(board, playerColor, 3);
  const player2 = countLines(board, playerColor, 2);
  score -= player3 * BLOCK_THREE_SCORE;
  score -= player2 * BLOCK_TWO_SCORE;
  // 5. Бонус за центральные клетки (если на них стоят камни бота)
  const centerCells = [[1,1],[1,2],[2,1],[2,2]];
  for (const [r,c] of centerCells) {
    if (board[r][c] === botColor) score += CENTER_BONUS;
    else if (board[r][c] === playerColor) score -= CENTER_BONUS/2;
  }
  // 6. Гибкость (количество возможных ходов после текущей позиции – влияет на тактическое разнообразие)
  const nextMovesBot = getValidMoves(board, lastTile, botColor).length;
  score += nextMovesBot * FLEXIBILITY_BONUS;
  return score;
};

// Минимакс на глубину 2 (бот -> игрок)
const minimax = (
  board: BoardType,
  depth: number,
  isBotTurn: boolean,
  botColor: 'red' | 'black',
  playerColor: 'red' | 'black',
  lastTile: Tile | null
): number => {
  if (depth === 0) {
    return evaluatePosition(board, botColor, playerColor, lastTile);
  }
  const currentColor = isBotTurn ? botColor : playerColor;
  const moves = getValidMoves(board, lastTile, currentColor);
  if (moves.length === 0) {
    // Нет ходов – текущий игрок проигрывает (противник побеждает)
    if (isBotTurn) return -WIN_SCORE; // бот не может ходить – плохо
    else return WIN_SCORE; // игрок не может ходить – хорошо для бота
  }
  if (isBotTurn) {
    let best = -Infinity;
    for (const move of moves) {
      const newBoard = board.map(row => [...row]);
      newBoard[move.row][move.col] = botColor;
      const value = minimax(newBoard, depth - 1, false, botColor, playerColor, move.tile);
      best = Math.max(best, value);
    }
    return best;
  } else {
    let worst = Infinity;
    for (const move of moves) {
      const newBoard = board.map(row => [...row]);
      newBoard[move.row][move.col] = playerColor;
      const value = minimax(newBoard, depth - 1, true, botColor, playerColor, move.tile);
      worst = Math.min(worst, value);
    }
    return worst;
  }
};

const BotGame: React.FC<BotGameProps> = ({ onClose }) => {
  const [board, setBoard] = useState<BoardType>(() => initBoard());
  const [lastPickedTile, setLastPickedTile] = useState<Tile | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<'red' | 'black'>('red');
  const [status, setStatus] = useState<GameStatus>('playing');
  const [winner, setWinner] = useState<'red' | 'black' | 'draw' | null>(null);
  const [message, setMessage] = useState('');
  const [waitingBot, setWaitingBot] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [turnStartedAt, setTurnStartedAt] = useState(Date.now());

  const playerColor: 'red' | 'black' = 'red';
  const botColor: 'red' | 'black' = 'black';

  // Ход бота (минимакс)
  const makeBotMove = useCallback(() => {
    if (status !== 'playing' || currentPlayer !== botColor || gameOver) return;
    setWaitingBot(true);
    setTimeout(() => {
      const moves = getValidMoves(board, lastPickedTile, botColor);
      if (moves.length === 0) {
        setWinner(playerColor);
        setStatus('finished');
        setGameOver(true);
        setMessage('🎉 Вы победили (бот заблокирован)!');
        playWinSound();
        setWaitingBot(false);
        return;
      }
      let bestMoves: typeof moves = [];
      let bestScore = -Infinity;
      for (const move of moves) {
        const newBoard = board.map(row => [...row]);
        newBoard[move.row][move.col] = botColor;
        const score = minimax(newBoard, 1, false, botColor, playerColor, move.tile);
        if (score > bestScore) {
          bestScore = score;
          bestMoves = [move];
        } else if (Math.abs(score - bestScore) < 0.1) {
          bestMoves.push(move);
        }
      }
      // Добавляем случайность среди лучших ходов
      const randomIndex = Math.floor(Math.random() * bestMoves.length);
      const { row, col, tile } = bestMoves[randomIndex];
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = botColor;
      setBoard(newBoard);
      playMoveSound();

      if (checkWin(newBoard, botColor)) {
        setWinner(botColor);
        setStatus('finished');
        setGameOver(true);
        setMessage('🤖 Бот победил!');
        playLoseSound();
        setWaitingBot(false);
        return;
      }

      const playerMoves = getValidMoves(newBoard, tile, playerColor);
      if (playerMoves.length === 0) {
        setWinner(botColor);
        setStatus('finished');
        setGameOver(true);
        setMessage('🤖 Бот победил (вы заблокированы)!');
        playLoseSound();
        setWaitingBot(false);
        return;
      }

      setLastPickedTile(tile);
      setCurrentPlayer(playerColor);
      setTurnStartedAt(Date.now());
      setWaitingBot(false);
    }, 400);
  }, [board, currentPlayer, lastPickedTile, status, gameOver, botColor, playerColor]);

  // Ход игрока
  const handlePlayerMove = useCallback((row: number, col: number) => {
    if (status !== 'playing' || currentPlayer !== playerColor || gameOver) return;
    const cell = board[row][col];
    if (!cell || typeof cell === 'string') return;
    let isValid = false;
    if (!lastPickedTile) {
      if ((row === 0 || row === 3 || col === 0 || col === 3) && !(row === 1 && col === 1) && !(row === 1 && col === 2) && !(row === 2 && col === 1) && !(row === 2 && col === 2)) {
        isValid = true;
      }
    } else {
      const tile = cell as Tile;
      if (tile.plant === lastPickedTile.plant || tile.symbol === lastPickedTile.symbol) {
        isValid = true;
      }
    }
    if (!isValid) {
      setMessage('❌ Неправильный ход');
      setTimeout(() => setMessage(''), 1000);
      return;
    }

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = playerColor;
    const pickedTile = cell as Tile;
    setBoard(newBoard);
    playMoveSound();

    if (checkWin(newBoard, playerColor)) {
      setWinner(playerColor);
      setStatus('finished');
      setGameOver(true);
      setMessage('🎉 Вы победили!');
      playWinSound();
      return;
    }

    const botMoves = getValidMoves(newBoard, pickedTile, botColor);
    if (botMoves.length === 0) {
      setWinner(playerColor);
      setStatus('finished');
      setGameOver(true);
      setMessage('🎉 Вы победили (бот заблокирован)!');
      playWinSound();
      return;
    }

    setLastPickedTile(pickedTile);
    setCurrentPlayer(botColor);
    setTurnStartedAt(Date.now());
  }, [board, currentPlayer, lastPickedTile, status, gameOver, playerColor, botColor]);

  // Запуск хода бота
  useEffect(() => {
    if (status === 'playing' && currentPlayer === botColor && !gameOver && !waitingBot) {
      makeBotMove();
    }
  }, [currentPlayer, status, gameOver, waitingBot, botColor, makeBotMove]);

  const resetGame = () => {
    setBoard(initBoard());
    setLastPickedTile(null);
    setCurrentPlayer('red');
    setStatus('playing');
    setWinner(null);
    setMessage('');
    setGameOver(false);
    setTurnStartedAt(Date.now());
    setWaitingBot(false);
  };

  const handleExit = () => setConfirmExitOpen(true);
  const confirmExit = () => {
    setConfirmExitOpen(false);
    onClose();
  };

  // Подсветка допустимых ходов для игрока
  const validMovesForDisplay = (() => {
    if (currentPlayer !== playerColor || status !== 'playing' || gameOver) return Array(4).fill(null).map(() => Array(4).fill(false));
    const moves = getValidMoves(board, lastPickedTile, playerColor);
    const display = Array(4).fill(null).map(() => Array(4).fill(false));
    moves.forEach(m => { display[m.row][m.col] = true; });
    return display;
  })();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>🤖 Игра с ботом</h2>
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
            lastMove={null}
            hostSkin="sakura"
            guestSkin="sakura"
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--bg)',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: 'var(--card-bg)',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    color: 'var(--text)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: 'var(--secondary-text)',
  },
  statusBar: {
    textAlign: 'center',
    padding: '8px',
    backgroundColor: 'var(--card-bg)',
    borderBottom: '1px solid var(--border)',
  },
  gameArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    gap: '20px',
  },
  boardWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  infoPanel: {
    textAlign: 'center',
  },
  turnInfo: {
    marginBottom: '16px',
  },
  gameOverPanel: {
    marginBottom: '16px',
  },
  message: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: 'var(--text)',
  },
  playAgainBtn: {
    padding: '8px 20px',
    borderRadius: '30px',
    border: 'none',
    background: '#4a6741',
    color: 'white',
    cursor: 'pointer',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  resetBtn: {
    padding: '8px 20px',
    borderRadius: '30px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  exitBtn: {
    padding: '8px 20px',
    borderRadius: '30px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
  },
};

export default BotGame;