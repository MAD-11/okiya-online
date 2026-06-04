import React, { useState, useEffect, useCallback } from 'react';
import Board from './Board';
import Timer from './Timer';
import LastPickedTile from './LastPickedTile';
import { initBoard, isValidMove, checkWin } from '../game/gameLogic';
import { Tile, Board as BoardType, GameStatus } from '../types/game';
import { playMoveSound, playWinSound, playLoseSound, playDrawSound, initAudio } from '../utils/sound';
import ConfirmDialog from './ConfirmDialog';

interface BotGameProps {
  onClose: () => void;
}

// Проверка, может ли игрок выиграть следующим ходом (или уже есть 3 в ряд)
const getThreatLevel = (board: BoardType, color: 'red' | 'black', lastTile: Tile | null): number => {
  let threat = 0;
  // Проверка всех возможных ходов для указанного цвета
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
      // Симулируем ход
      const newBoard = board.map(row => [...row]);
      newBoard[r][c] = color;
      if (checkWin(newBoard, color)) {
        threat = Math.max(threat, 1000);
      } else {
        // Подсчёт линий из 3
        const line3 = countLinesOfThree(newBoard, color);
        threat = Math.max(threat, line3 * 200);
      }
    }
  }
  return threat;
};

// Подсчёт количества линий (горизонталь, вертикаль, диагональ, квадрат), где есть 3 камня цвета color
const countLinesOfThree = (board: BoardType, color: 'red' | 'black'): number => {
  let count = 0;
  // Горизонтали
  for (let i = 0; i < 4; i++) {
    const row = board[i];
    const redCount = row.filter(cell => cell === color).length;
    if (redCount === 3 && row.some(cell => cell !== color && typeof cell !== 'string')) count++;
  }
  // Вертикали
  for (let j = 0; j < 4; j++) {
    let cnt = 0;
    for (let i = 0; i < 4; i++) if (board[i][j] === color) cnt++;
    if (cnt === 3) {
      for (let i = 0; i < 4; i++) if (board[i][j] !== color && typeof board[i][j] !== 'string') count++;
    }
  }
  // Диагонали
  const diag1 = [board[0][0], board[1][1], board[2][2], board[3][3]];
  if (diag1.filter(cell => cell === color).length === 3 && diag1.some(cell => cell !== color && typeof cell !== 'string')) count++;
  const diag2 = [board[0][3], board[1][2], board[2][1], board[3][0]];
  if (diag2.filter(cell => cell === color).length === 3 && diag2.some(cell => cell !== color && typeof cell !== 'string')) count++;
  // Квадраты 2x2 (не оцениваем для 3, но можно пропустить)
  return count;
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

  // Получить список всех допустимых ходов для заданного цвета и текущей доски
  const getValidMoves = useCallback((boardState: BoardType, lastTile: Tile | null, color: 'red' | 'black') => {
    const moves: { row: number; col: number; tile: Tile }[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = boardState[r][c];
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
  }, []);

  // Оценка хода для бота (чем выше, тем лучше)
  const evaluateMove = useCallback((
    boardState: BoardType,
    row: number,
    col: number,
    tile: Tile,
    botColorArg: 'red' | 'black',
    playerColorArg: 'red' | 'black',
    currentLastTile: Tile | null
  ): number => {
    // Симулируем ход бота
    const simulatedBoard = boardState.map(r => [...r]);
    simulatedBoard[row][col] = botColorArg;
    const newLastTile = tile;

    let score = 0;

    // 1. Победа бота
    if (checkWin(simulatedBoard, botColorArg)) {
      score += 10000;
    }

    // 2. Блокировка победы игрока (если игрок следующим ходом может выиграть)
    const playerThreat = getThreatLevel(simulatedBoard, playerColorArg, newLastTile);
    if (playerThreat >= 1000) {
      score += 800;
    }

    // 3. Создание своей угрозы (линии из 3)
    const botLines3 = countLinesOfThree(simulatedBoard, botColorArg);
    score += botLines3 * 300;

    // 4. Блокировка угроз игрока (линии из 2 – не очень точно, но добавим)
    // Для простоты не будем перебирать все возможные ходы игрока, оставим базовую эвристику

    // 5. Бонус за центральные клетки (больше возможностей)
    if ((row === 1 || row === 2) && (col === 1 || col === 2)) {
      score += 15;
    }

    // 6. Бонус за клетки, которые дают больше вариантов следующего хода (оценка разнообразия)
    // Проверим, сколько допустимых ходов останется у бота после этого хода
    const nextMoves = getValidMoves(simulatedBoard, newLastTile, botColorArg);
    score += nextMoves.length * 2;

    // 7. Случайный фактор (±20), чтобы бот не был полностью детерминированным
    score += (Math.random() * 40 - 20);

    return score;
  }, [getValidMoves]);

  // Ход бота (умный выбор)
  const makeBotMove = useCallback(() => {
    if (status !== 'playing' || currentPlayer !== botColor || gameOver) return;
    setWaitingBot(true);
    setTimeout(() => {
      const validMoves = getValidMoves(board, lastPickedTile, botColor);
      if (validMoves.length === 0) {
        // Нет ходов – бот проигрывает
        setWinner(playerColor);
        setStatus('finished');
        setGameOver(true);
        setMessage('🎉 Вы победили (бот заблокирован)!');
        playWinSound();
        setWaitingBot(false);
        return;
      }
      // Оцениваем каждый ход
      let bestMove = validMoves[0];
      let bestScore = -Infinity;
      for (const move of validMoves) {
        const score = evaluateMove(board, move.row, move.col, move.tile, botColor, playerColor, lastPickedTile);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
      const { row, col, tile } = bestMove;
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = botColor;
      setBoard(newBoard);
      playMoveSound();

      // Проверка победы бота
      if (checkWin(newBoard, botColor)) {
        setWinner(botColor);
        setStatus('finished');
        setGameOver(true);
        setMessage('🤖 Бот победил!');
        playLoseSound();
        setWaitingBot(false);
        return;
      }

      // Проверка ничьи/блокировки
      // Сначала проверим, остались ли ходы у игрока
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
    }, 350);
  }, [board, currentPlayer, lastPickedTile, status, gameOver, botColor, playerColor, getValidMoves, evaluateMove]);

  // Ход игрока
  const handlePlayerMove = useCallback((row: number, col: number) => {
    if (status !== 'playing' || currentPlayer !== playerColor || gameOver) return;
    const cell = board[row][col];
    if (!cell || typeof cell === 'string') return;
    // Проверка допустимости
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

    // Проверка, остались ли ходы у бота
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
  }, [board, currentPlayer, lastPickedTile, status, gameOver, playerColor, botColor, getValidMoves]);

  // Запуск хода бота после смены игрока
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

  // Вычисление допустимых ходов для подсветки игрока
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