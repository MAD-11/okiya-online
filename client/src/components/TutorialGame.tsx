import React, { useState, useEffect, useCallback } from 'react';
import Board from './Board';
import LastPickedTile from './LastPickedTile';
import { initBoard, isValidMove, checkWin } from '../game/gameLogic';
import { Tile, Board as BoardType } from '../types/game';
import { playMoveSound, playWinSound } from '../utils/sound';

interface TutorialStep {
  id: number;
  title: string;
  description: string;
  setupBoard: () => BoardType;
  setupLastPickedTile: () => Tile | null;
  setupCurrentPlayer: () => 'red' | 'black';
  expectedMove?: { row: number; col: number };
  hint: string;
  onCorrectMove?: (row: number, col: number, board: BoardType) => void;
}

const TutorialGame: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [board, setBoard] = useState<BoardType>(() => initBoard());
  const [lastPickedTile, setLastPickedTile] = useState<Tile | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<'red' | 'black'>('red');
  const [message, setMessage] = useState('');
  const [highlightMoves, setHighlightMoves] = useState<boolean[][]>([]);
  const [showHint, setShowHint] = useState(false);
  const [completed, setCompleted] = useState(false);

  const steps: TutorialStep[] = [
    {
      id: 1,
      title: '🎲 Первый ход',
      description: 'Игрок с красными камнями ходит первым. В первый ход можно взять любую фишку с края поля (крайние строки или столбцы), кроме центральных 4 клеток.',
      setupBoard: () => initBoard(),
      setupLastPickedTile: () => null,
      setupCurrentPlayer: () => 'red',
      hint: 'Кликни на любую фишку в верхнем или нижнем ряду, либо в левом или правом столбце (кроме центра 2×2).',
    },
    {
      id: 2,
      title: '🌿 Совпадение символов',
      description: 'Теперь ход чёрных. Нужно взять фишку, у которой растение или явление совпадает с предыдущей взятой фишкой. Предыдущая фишка: 🌸☀️ (сакура+солнце). Подсвечены допустимые ходы.',
      setupBoard: () => {
        const b = initBoard();
        return b;
      },
      setupLastPickedTile: () => ({ plant: 'sakura', symbol: 'sun' }),
      setupCurrentPlayer: () => 'black',
      hint: 'Нажми на любую фишку, где есть сакура (🌸) или солнце (☀️).',
    },
    {
      id: 3,
      title: '🏆 Выигрышная комбинация',
      description: 'Поставь свой камень так, чтобы собрать 4 в ряд по горизонтали. Здесь уже есть 3 красных камня в верхней строке, осталось взять фишку в правом верхнем углу и выиграть.',
      setupBoard: () => {
        const b = initBoard();
        b[0][0] = 'red';
        b[0][1] = 'red';
        b[0][2] = 'red';
        b[0][3] = { plant: 'sakura', symbol: 'sun' };
        return b;
      },
      setupLastPickedTile: () => ({ plant: 'sakura', symbol: 'sun' }),
      setupCurrentPlayer: () => 'red',
      expectedMove: { row: 0, col: 3 },
      hint: 'Кликни на фишку в правом верхнем углу (0,3), чтобы поставить красный камень и выиграть.',
    },
    {
      id: 4,
      title: '🛡️ Блокировка соперника',
      description: 'Соперник (чёрные) имеет 3 камня в ряд по вертикали. Поставь свой камень так, чтобы заблокировать его победу.',
      setupBoard: () => {
        const b = initBoard();
        b[0][1] = 'black';
        b[1][1] = 'black';
        b[2][1] = 'black';
        b[3][1] = { plant: 'pine', symbol: 'bird' };
        return b;
      },
      setupLastPickedTile: () => ({ plant: 'pine', symbol: 'bird' }),
      setupCurrentPlayer: () => 'red',
      expectedMove: { row: 3, col: 1 },
      hint: 'Кликни на фишку внизу (3,1), чтобы поставить красный камень и не дать чёрным выстроить ряд.',
    },
    {
      id: 5,
      title: '🎉 Ничья',
      description: 'Все клетки заполнены, но победителя нет — ничья. Сделай последний ход, который не приводит к победе.',
      setupBoard: () => {
        const b = initBoard();
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            if (i === 3 && j === 3) {
              b[i][j] = { plant: 'iris', symbol: 'rain' };
            } else {
              b[i][j] = (i + j) % 2 === 0 ? 'red' : 'black';
            }
          }
        }
        return b;
      },
      setupLastPickedTile: () => ({ plant: 'iris', symbol: 'rain' }),
      setupCurrentPlayer: () => 'red',
      expectedMove: { row: 3, col: 3 },
      hint: 'Кликни на последнюю фишку в правом нижнем углу (3,3). После этого хода поле заполнится, и победителя не будет — ничья.',
    },
  ];

  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (!currentStep) return;
    setBoard(currentStep.setupBoard());
    setLastPickedTile(currentStep.setupLastPickedTile());
    setCurrentPlayer(currentStep.setupCurrentPlayer());
    setMessage('');
    setShowHint(false);
  }, [stepIndex]);

  useEffect(() => {
    if (!currentStep) return;
    const moves: boolean[][] = Array(4).fill(null).map(() => Array(4).fill(false));
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = board[r][c];
        if (!cell || typeof cell === 'string') continue;
        if (currentStep.expectedMove) {
          if (r === currentStep.expectedMove.row && c === currentStep.expectedMove.col) {
            moves[r][c] = true;
          }
          continue;
        }
        if (!lastPickedTile) {
          if ((r === 0 || r === 3 || c === 0 || c === 3) && !(r === 1 && c === 1) && !(r === 1 && c === 2) && !(r === 2 && c === 1) && !(r === 2 && c === 2)) {
            moves[r][c] = true;
          }
        } else {
          const tile = cell as Tile;
          if (tile.plant === lastPickedTile.plant || tile.symbol === lastPickedTile.symbol) {
            moves[r][c] = true;
          }
        }
      }
    }
    setHighlightMoves(moves);
  }, [board, lastPickedTile, currentStep]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!currentStep) return;
    if (!highlightMoves[row]?.[col]) {
      setMessage('❌ Неправильный ход. Попробуй ещё раз.');
      return;
    }

    const cell = board[row][col];
    if (!cell || typeof cell === 'string') return;
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    playMoveSound();

    if (lastPickedTile === null) {
      setLastPickedTile(cell as Tile);
    } else {
      setLastPickedTile(cell as Tile);
    }

    if (currentStep.onCorrectMove) {
      currentStep.onCorrectMove(row, col, newBoard);
    }

    let stepComplete = false;
    if (currentStep.expectedMove) {
      stepComplete = (row === currentStep.expectedMove.row && col === currentStep.expectedMove.col);
    } else {
      stepComplete = true;
    }

    if (stepComplete) {
      setMessage('');
      if (stepIndex + 1 < steps.length) {
        setStepIndex(stepIndex + 1);
      } else {
        setCompleted(true);
        setMessage('🎉 Поздравляем! Вы прошли обучение! Теперь вы готовы играть с друзьями.');
      }
    } else {
      setMessage('✅ Правильно! Продолжайте.');
    }
  }, [board, currentPlayer, currentStep, highlightMoves, lastPickedTile, stepIndex, steps.length]);

  const resetTutorial = () => {
    setStepIndex(0);
    setCompleted(false);
  };

  if (!currentStep) return null;
  if (completed) {
    return (
      <div style={styles.container}>
        <div style={styles.completed}>
          <h2>🎉 Обучение завершено!</h2>
          <button onClick={onClose} style={styles.exitBtn}>Выйти в меню</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🎓 Обучение: {currentStep.title}</h2>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>
      <div style={styles.content}>
        <div style={styles.description}>
          <p>{currentStep.description}</p>
          <button onClick={() => setShowHint(!showHint)} style={styles.hintBtn}>💡 Подсказка</button>
          {showHint && <p style={styles.hintText}>{currentStep.hint}</p>}
          {message && <p style={styles.message}>{message}</p>}
        </div>
        <div style={styles.boardArea}>
          <Board
            board={board}
            validMoves={highlightMoves}
            onClick={handleCellClick}
            currentPlayer={currentPlayer}
            myColor={currentPlayer}
            lastMove={null}
            hostSkin="sakura"
            guestSkin="sakura"
            shake={false}
          />
          <LastPickedTile tile={lastPickedTile} />
        </div>
        <div style={styles.progress}>
          <span>Шаг {stepIndex + 1} из {steps.length}</span>
          <progress value={stepIndex + 1} max={steps.length} style={styles.progressBar} />
        </div>
        <div style={styles.buttons}>
          <button onClick={resetTutorial} style={styles.resetBtn}>Начать заново</button>
          <button onClick={onClose} style={styles.exitBtn}>Выйти в меню</button>
        </div>
      </div>
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
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  description: {
    maxWidth: '600px',
    textAlign: 'center',
    marginBottom: '24px',
    color: 'var(--text)',
    fontSize: '16px',
  },
  hintBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '6px 12px',
    marginTop: '8px',
    cursor: 'pointer',
    color: 'var(--text)',
  },
  hintText: {
    backgroundColor: 'var(--card-bg)',
    padding: '12px',
    borderRadius: '12px',
    marginTop: '12px',
    fontStyle: 'italic',
  },
  message: {
    marginTop: '12px',
    fontWeight: 'bold',
    color: '#27ae60',
  },
  boardArea: {
    marginBottom: '24px',
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    color: 'var(--text)',
  },
  progressBar: {
    width: '200px',
    height: '8px',
    borderRadius: '4px',
  },
  buttons: {
    display: 'flex',
    gap: '16px',
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
  completed: {
    textAlign: 'center',
    padding: '40px',
  },
};

export default TutorialGame;