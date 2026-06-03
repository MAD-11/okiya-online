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

  // Проверка окончания игры
  const checkGameOver = useCallback((newBoard: BoardType, currentWinner: 'red' | 'black' | 'draw' | null, lastTile: Tile | null, nextPlayer: 'red' | 'black') => {
    if (currentWinner) {
      setStatus('finished');
      setGameOver(true);
      if (currentWinner === 'draw') {
        setMessage('Ничья!');
        playDrawSound();
      } else if (currentWinner === playerColor) {
        setMessage('🎉 Вы победили!');
        playWinSound();
      } else {
        setMessage('🤖 Бот победил!');
        playLoseSound();
      }
      return true;
    }
    // Проверка на отсутствие ходов (блокировка)
    let hasAnyMove = false;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = newBoard[r][c];
        if (cell && typeof cell !== 'string') {
          if (!lastTile) {
            if ((r === 0 || r === 3 || c === 0 || c === 3) && !(r === 1 && c === 1) && !(r === 1 && c === 2) && !(r === 2 && c === 1) && !(r === 2 && c === 2)) {
              hasAnyMove = true;
            }
          } else {
            const tile = cell as Tile;
            if (tile.plant === lastTile.plant || tile.symbol === lastTile.symbol) {
              hasAnyMove = true;
            }
          }
        }
      }
    }
    if (!hasAnyMove) {
      // Нет ходов – побеждает противоположный игрок? По правилам, если нет ходов, текущий игрок не может ходить → проигрывает
      const loser = nextPlayer;
      const winnerColor = loser === 'red' ? 'black' : 'red';
      setWinner(winnerColor);
      setStatus('finished');
      setGameOver(true);
      if (winnerColor === playerColor) {
        setMessage('🎉 Вы победили (противник заблокирован)!');
        playWinSound();
      } else {
        setMessage('🤖 Бот победил (вы заблокированы)!');
        playLoseSound();
      }
      return true;
    }
    return false;
  }, [playerColor]);

  // Ход игрока
  const handlePlayerMove = useCallback((row: number, col: number) => {
    if (status !== 'playing' || currentPlayer !== playerColor || gameOver) return;
    const cell = board[row][col];
    if (!cell || typeof cell === 'string') return;
    // Проверка допустимости хода
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

    // Делаем ход
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = playerColor;
    const pickedTile = cell as Tile;
    setBoard(newBoard);
    playMoveSound();

    // Проверка победы
    const win = checkWin(newBoard, playerColor);
    if (win) {
      setWinner(playerColor);
      setStatus('finished');
      setGameOver(true);
      setMessage('🎉 Вы победили!');
      playWinSound();
      return;
    }

    // Проверка ничьи/блокировки после хода
    const nextPlayer = botColor;
    const isOver = checkGameOver(newBoard, null, pickedTile, nextPlayer);
    if (isOver) return;

    // Передаём ход боту
    setLastPickedTile(pickedTile);
    setCurrentPlayer(botColor);
    setTurnStartedAt(Date.now());
  }, [board, currentPlayer, lastPickedTile, status, gameOver, playerColor, botColor, checkGameOver]);

  // Ход бота (случайный допустимый ход)
  const makeBotMove = useCallback(() => {
    if (status !== 'playing' || currentPlayer !== botColor || gameOver) return;
    setWaitingBot(true);
    setTimeout(() => {
      // Собираем все допустимые ходы
      const validMoves: { row: number; col: number }[] = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const cell = board[r][c];
          if (!cell || typeof cell === 'string') continue;
          let isValid = false;
          if (!lastPickedTile) {
            if ((r === 0 || r === 3 || c === 0 || c === 3) && !(r === 1 && c === 1) && !(r === 1 && c === 2) && !(r === 2 && c === 1) && !(r === 2 && c === 2)) {
              isValid = true;
            }
          } else {
            const tile = cell as Tile;
            if (tile.plant === lastPickedTile.plant || tile.symbol === lastPickedTile.symbol) {
              isValid = true;
            }
          }
          if (isValid) {
            validMoves.push({ row: r, col: c });
          }
        }
      }
      if (validMoves.length === 0) {
        // Нет ходов у бота – бот проигрывает?
        const winnerColor = playerColor;
        setWinner(winnerColor);
        setStatus('finished');
        setGameOver(true);
        setMessage('🎉 Вы победили (бот заблокирован)!');
        playWinSound();
        setWaitingBot(false);
        return;
      }
      // Случайный ход
      const randomIndex = Math.floor(Math.random() * validMoves.length);
      const { row, col } = validMoves[randomIndex];
      const cell = board[row][col];
      if (!cell || typeof cell === 'string') return;
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = botColor;
      const pickedTile = cell as Tile;
      setBoard(newBoard);
      playMoveSound();

      const win = checkWin(newBoard, botColor);
      if (win) {
        setWinner(botColor);
        setStatus('finished');
        setGameOver(true);
        setMessage('🤖 Бот победил!');
        playLoseSound();
        setWaitingBot(false);
        return;
      }

      const isOver = checkGameOver(newBoard, null, pickedTile, playerColor);
      if (isOver) {
        setWaitingBot(false);
        return;
      }

      setLastPickedTile(pickedTile);
      setCurrentPlayer(playerColor);
      setTurnStartedAt(Date.now());
      setWaitingBot(false);
    }, 300); // задержка для имитации "мышления"
  }, [board, currentPlayer, lastPickedTile, status, gameOver, botColor, playerColor, checkGameOver]);

  // Запуск хода бота, когда наступает его очередь
  useEffect(() => {
    if (status === 'playing' && currentPlayer === botColor && !gameOver && !waitingBot) {
      makeBotMove();
    }
  }, [currentPlayer, status, gameOver, waitingBot, botColor, makeBotMove]);

  // Сброс игры
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

  const handleExit = () => {
    setConfirmExitOpen(true);
  };

  const confirmExit = () => {
    setConfirmExitOpen(false);
    onClose();
  };

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
            validMoves={currentPlayer === playerColor && status === 'playing' ? (() => {
              const moves: boolean[][] = Array(4).fill(null).map(() => Array(4).fill(false));
              for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                  const cell = board[r][c];
                  if (!cell || typeof cell === 'string') continue;
                  let isValid = false;
                  if (!lastPickedTile) {
                    if ((r === 0 || r === 3 || c === 0 || c === 3) && !(r === 1 && c === 1) && !(r === 1 && c === 2) && !(r === 2 && c === 1) && !(r === 2 && c === 2)) {
                      isValid = true;
                    }
                  } else {
                    const tile = cell as Tile;
                    if (tile.plant === lastPickedTile.plant || tile.symbol === lastPickedTile.symbol) {
                      isValid = true;
                    }
                  }
                  moves[r][c] = isValid;
                }
              }
              return moves;
            })() : Array(4).fill(null).map(() => Array(4).fill(false))}
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