import React, { useState, useEffect, useCallback } from 'react';
import Board from './Board';
import LastPickedTile from './LastPickedTile';
import { initBoard, isValidMove, checkWin } from '../game/gameLogic';
import { Tile, Board as BoardType } from '../types/game';
import { playMoveSound, playWinSound } from '../utils/sound';

console.log('TutorialGame component rendering');

interface TutorialStep {
  id: number;
  title: string;
  description: string;
  setupBoard: () => BoardType; // функция, возвращающая начальное состояние доски для этого шага
  setupLastPickedTile: () => Tile | null; // какая фишка была взята последней (null для первого хода)
  setupCurrentPlayer: () => 'red' | 'black'; // кто ходит (в обучении всегда красный)
  isValidMove?: (row: number, col: number, board: BoardType, lastTile: Tile | null) => boolean; // кастомная проверка правильности хода
  onCorrectMove?: (row: number, col: number, board: BoardType) => void; // действие после правильного хода
  expectedMove?: { row: number; col: number }; // ожидаемый ход (для автоматического сравнения)
  hint: string; // текст подсказки
}

const TutorialGame: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [board, setBoard] = useState<BoardType>(initBoard());
  const [lastPickedTile, setLastPickedTile] = useState<Tile | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<'red' | 'black'>('red');
  const [message, setMessage] = useState('');
  const [highlightMoves, setHighlightMoves] = useState<boolean[][]>([]);
  const [showHint, setShowHint] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Определение шагов обучения
  const steps: TutorialStep[] = [
    {
      id: 1,
      title: '🎲 Первый ход',
      description: 'Игрок с красными камнями ходит первым. В первый ход можно взять любую фишку с края поля (крайние строки или столбцы), кроме центральных 4 клеток.',
      setupBoard: () => initBoard(),
      setupLastPickedTile: () => null,
      setupCurrentPlayer: () => 'red',
      expectedMove: undefined, // любой корректный первый ход
      hint: 'Кликни на любую фишку в верхнем или нижнем ряду, либо в левом или правом столбце. Нельзя брать фишки из центра 2×2.',
      onCorrectMove: (row, col, board) => {
        // После первого хода запоминаем взятую фишку для следующего шага
        setLastPickedTile(board[row][col] as Tile);
        setCurrentPlayer('black');
      },
    },
    {
      id: 2,
      title: '🌿 Совпадение символов',
      description: 'Теперь ход чёрных. Нужно взять фишку, у которой растение или явление совпадает с предыдущей взятой фишкой. Подсвеченные клетки — допустимые ходы.',
      setupBoard: () => {
        // Создаём конкретную ситуацию: предыдущая фишка - сакура+солнце, выставляем на поле подходящие фишки
        const b = initBoard();
        // Пример: делаем так, чтобы предыдущая фишка была 🌸☀️ (сакура+солнце)
        // Устанавливаем lastPickedTile вручную, а доска остаётся случайной, но мы подсветим ходы через isValidMove
        return b;
      },
      setupLastPickedTile: () => {
        // Имитируем, что предыдущая фишка - сакура+солнце
        return { plant: 'sakura', symbol: 'sun' };
      },
      setupCurrentPlayer: () => 'black',
      hint: 'Нажми на фишку, у которой есть сакура (🌸) или солнце (☀️). Подсветка покажет возможные ходы.',
      // Мы будем динамически вычислять доступные ходы через isValidMove
    },
    {
      id: 3,
      title: '🏆 Выигрышная комбинация',
      description: 'Поставь свой камень так, чтобы собрать 4 в ряд по горизонтали. Здесь уже есть 3 красных камня в одной линии, остался один ход для победы.',
      setupBoard: () => {
        const b = initBoard();
        // Ручная настройка: горизонталь в верхней строке
        for (let c = 0; c < 3; c++) b[0][c] = 'red';
        b[0][3] = null; // последняя клетка свободна
        return b;
      },
      setupLastPickedTile: () => null,
      setupCurrentPlayer: () => 'red',
      expectedMove: { row: 0, col: 3 },
      hint: 'Кликни на пустую клетку в первом ряду (0,3), чтобы завершить горизонталь и выиграть.',
      onCorrectMove: () => {
        playWinSound();
        setMessage('Поздравляю! Ты собрал ряд из 4 камней и выиграл!');
      },
    },
    {
      id: 4,
      title: '🛡️ Блокировка соперника',
      description: 'Соперник (чёрные) имеет 3 камня в ряд. Поставь свой камень так, чтобы заблокировать его победу.',
      setupBoard: () => {
        const b = initBoard();
        // Создаём угрозу чёрных: три в ряд по вертикали
        b[0][1] = 'black';
        b[1][1] = 'black';
        b[2][1] = 'black';
        b[3][1] = null; // свободная клетка, куда соперник может выиграть
        return b;
      },
      setupLastPickedTile: () => null,
      setupCurrentPlayer: () => 'red',
      expectedMove: { row: 3, col: 1 },
      hint: 'Поставь свой камень внизу (3,1), чтобы не дать чёрным выстроить вертикаль.',
    },
    {
      id: 5,
      title: '🎉 Ничья',
      description: 'Бывают ситуации, когда все клетки заполнены, но никто не выиграл — объявляется ничья. Здесь доска почти заполнена, сделай последний ход, который не приводит к победе.',
      setupBoard: () => {
        const b = initBoard();
        // Заполняем все клетки, кроме одной, камнями красных и чёрных без выигрышных комбинаций
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            if (i === 3 && j === 3) b[i][j] = null;
            else if ((i + j) % 2 === 0) b[i][j] = 'red';
            else b[i][j] = 'black';
          }
        }
        return b;
      },
      setupLastPickedTile: () => null,
      setupCurrentPlayer: () => 'red',
      expectedMove: { row: 3, col: 3 },
      hint: 'Поставь последний камень на пустую клетку (3,3). После этого не останется ходов и победителя — ничья.',
      onCorrectMove: () => {
        setMessage('Верно! Игра закончилась ничьей, так как поле заполнено, а победителя нет.');
      },
    },
  ];

  const currentStep = steps[stepIndex];

  // Подсветка допустимых ходов для текущего шага
  useEffect(() => {
    if (!currentStep) return;
    const moves: boolean[][] = Array(4).fill(null).map(() => Array(4).fill(false));
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = board[r][c];
        if (!cell || typeof cell === 'string') continue;
        // Если ожидается конкретный ход, подсвечиваем только его
        if (currentStep.expectedMove) {
          if (r === currentStep.expectedMove.row && c === currentStep.expectedMove.col) {
            moves[r][c] = true;
          }
          continue;
        }
        // Иначе используем общую логику
        if (!lastPickedTile) {
          // Первый ход: можно брать только с края, не из центра
          if ((r === 0 || r === 3 || c === 0 || c === 3) && !(r === 1 || r === 2) && !(c === 1 || c === 2)) {
            moves[r][c] = true;
          }
        } else {
          // Проверка совпадения символов
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
    // Проверяем, разрешён ли ход
    if (!highlightMoves[row]?.[col]) {
      setMessage('❌ Неправильный ход. Попробуй ещё раз.');
      return;
    }

    // Выполняем ход
    const cell = board[row][col];
    if (!cell || typeof cell === 'string') return;
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    playMoveSound();

    // Обновляем последнюю взятую фишку (если это не первый ход)
    if (lastPickedTile === null) {
      setLastPickedTile(cell as Tile);
    } else {
      setLastPickedTile(cell as Tile);
    }

    // Вызов колбэка правильного хода
    if (currentStep.onCorrectMove) {
      currentStep.onCorrectMove(row, col, newBoard);
    }

    // Проверка на завершение шага
    let stepComplete = false;
    if (currentStep.expectedMove) {
      stepComplete = (row === currentStep.expectedMove.row && col === currentStep.expectedMove.col);
    } else {
      // Для первого хода или хода без ожидаемой координаты – просто факт хода достаточен
      stepComplete = true;
    }

    if (stepComplete) {
      setMessage('');
      if (stepIndex + 1 < steps.length) {
        // Переход к следующему шагу
        setStepIndex(stepIndex + 1);
        // Сброс состояния для нового шага
        const nextStep = steps[stepIndex + 1];
        setBoard(nextStep.setupBoard());
        setLastPickedTile(nextStep.setupLastPickedTile());
        setCurrentPlayer(nextStep.setupCurrentPlayer());
        setShowHint(false);
      } else {
        setCompleted(true);
        setMessage('🎉 Поздравляем! Вы прошли обучение! Теперь вы готовы играть с друзьями.');
      }
    } else {
      setMessage('✅ Правильно! Продолжайте.');
    }
  }, [board, currentPlayer, currentStep, highlightMoves, lastPickedTile, stepIndex, steps]);

  const resetTutorial = () => {
    setStepIndex(0);
    const firstStep = steps[0];
    setBoard(firstStep.setupBoard());
    setLastPickedTile(firstStep.setupLastPickedTile());
    setCurrentPlayer(firstStep.setupCurrentPlayer());
    setMessage('');
    setShowHint(false);
    setCompleted(false);
  };
  console.log('stepIndex', stepIndex, 'steps.length', steps.length);
  if (!currentStep) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🎓 Обучение: {currentStep.title}</h2>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>

      <div style={styles.content}>
        <div style={styles.description}>
          <p>{currentStep.description}</p>
          <button onClick={() => setShowHint(!showHint)} style={styles.hintBtn}>
            💡 Подсказка
          </button>
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
};

export default TutorialGame;