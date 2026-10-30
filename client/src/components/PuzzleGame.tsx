import React, { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import Board from './Board';
import LastPickedTile from './LastPickedTile';
import { isValidMove } from '../game/gameLogic';
import { checkWin } from '../game/gameLogic';
import { Puzzle, PuzzleDifficulty, Tile, Board as BoardType } from '../types/game';
import { playMoveSound, playWinSound, initAudio } from '../utils/sound';
import { useTheme } from '../contexts/ThemeContext';

interface PuzzleGameProps {
  difficulty: PuzzleDifficulty;
  playerId: string;
  socket: Socket | null;
  onChangeDifficulty: () => void;
  onClose: () => void;
}

const difficultyLabel: Record<PuzzleDifficulty, string> = {
  1: '🟢 Выиграй за 1 ход',
  2: '🔴 Заблокируй соперника',
};

// Может ли `color` выиграть следующим ходом?
function canWinNext(board: BoardType, color: 'red' | 'black', lastTile: Tile | null): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!isValidMove(board, r, c, lastTile)) continue;
      const sim = board.map(row => [...row]);
      sim[r][c] = color;
      if (checkWin(sim, color)) return true;
    }
  }
  return false;
}

const PuzzleGame: React.FC<PuzzleGameProps> = ({
  difficulty,
  playerId,
  socket,
  onChangeDifficulty,
  onClose,
}) => {
  const { skin } = useTheme();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [board, setBoard] = useState<BoardType | null>(null);
  const [lastPickedTile, setLastPickedTile] = useState<Tile | null>(null);
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSolved, setTotalSolved] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);

  const requestPuzzle = useCallback(() => {
    if (!socket) return;
    setLoading(true);
    setError(null);
    setSolved(false);
    setMessage('');
    setShowHint(false);

    socket.emit('puzzle:request', difficulty, (res: any) => {
      setLoading(false);
      if (res?.error) {
        setError(res.error);
        return;
      }
      const p: Puzzle = res.puzzle;
      setPuzzle(p);
      setBoard(p.board.map(row => [...row]));
      setLastPickedTile(p.lastPickedTile);
    });
  }, [socket, difficulty]);

  useEffect(() => {
    requestPuzzle();
  }, [requestPuzzle]);

  const handleCellClick = useCallback((row: number, col: number) => {
    initAudio();
    if (!puzzle || !board || solved) return;

    const cell = board[row][col];
    if (!cell || typeof cell === 'string') {
      setMessage('❌ Это клетка без фишки');
      return;
    }

    if (!isValidMove(board, row, col, lastPickedTile)) {
      setMessage('❌ Эта фишка не совпадает с предыдущей');
      return;
    }

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = 'red';
    const pickedTile = cell as Tile;

    // Проверка: решён ли пазл (универсально для win и block)
    let isSolved = false;
    if (puzzle.type === 'win') {
      isSolved = checkWin(newBoard, 'red');
    } else {
      // block: после хода чёрные не могут выиграть следующим ходом
      isSolved = !canWinNext(newBoard, 'black', pickedTile);
    }

    if (!isSolved) {
      setMessage(puzzle.type === 'block'
        ? '❌ Эта фишка не блокирует угрозу'
        : '❌ Этот ход не ведёт к победе');
      return;
    }

    setBoard(newBoard);
    setLastPickedTile(pickedTile);
    setSolved(true);
    playMoveSound();
    playWinSound();
    setMessage(puzzle.type === 'block'
      ? '🎉 Вы заблокировали соперника!'
      : '🎉 Пазл решён!');

    socket?.emit('puzzle:solved', puzzle.id, playerId, (res: any) => {
      if (res?.success) {
        setTotalSolved(res.puzzlesSolved);
      }
    });
  }, [puzzle, board, lastPickedTile, solved, socket, playerId]);

  const handleReset = () => {
    if (!puzzle) return;
    setBoard(puzzle.board.map(row => [...row]));
    setLastPickedTile(puzzle.lastPickedTile);
    setSolved(false);
    setMessage('');
    setShowHint(false);
  };

  const handleNextPuzzle = () => {
    requestPuzzle();
  };

  const validMovesForDisplay = Array(4).fill(null).map(() => Array(4).fill(false));

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>🎯 {difficultyLabel[difficulty]}</h2>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </header>

      <div style={styles.content}>
        {loading && <p style={styles.loading}>Генерация пазла...</p>}

        {error && (
          <div style={styles.errorBox}>
            <p style={styles.errorText}>⚠️ {error}</p>
            <button onClick={requestPuzzle} style={styles.primaryBtn}>Попробовать снова</button>
          </div>
        )}

        {!loading && !error && puzzle && board && (
          <>
            <div style={styles.boardWrapper}>
              <Board
                board={board}
                validMoves={validMovesForDisplay}
                onClick={handleCellClick}
                currentPlayer="red"
                myColor="red"
                lastMove={null}
                hostSkin={skin}
                guestSkin={skin}
                shake={false}
                clickableCells={board.map(row =>
                  row.map(cell => !!cell && typeof cell !== 'string')
                )}
              />
              <LastPickedTile tile={lastPickedTile} />
            </div>

            {message && (
              <p style={{
                ...styles.message,
                color: solved ? 'var(--accent-2)' : message.startsWith('❌') ? 'var(--timer-low)' : 'var(--accent)',
              }}>
                {message}
              </p>
            )}

            <div style={styles.hintRow}>
              <button onClick={() => setShowHint(!showHint)} style={styles.hintBtn}>
                💡 Подсказка
              </button>
            </div>
            {showHint && <p style={styles.hintText}>{puzzle.hint}</p>}

            {totalSolved !== null && solved && (
              <p style={styles.totalSolved}>Всего решено: {totalSolved}</p>
            )}

            <div style={styles.buttonRow}>
              {!solved && (
                <button onClick={handleReset} style={styles.secondaryBtn}>
                  🔄 Сброс
                </button>
              )}
              {solved && (
                <button onClick={handleNextPuzzle} style={styles.primaryBtn}>
                  ➡️ Следующий пазл
                </button>
              )}
              <button onClick={onChangeDifficulty} style={styles.secondaryBtn}>
                ← Сменить режим
              </button>
            </div>
          </>
        )}
      </div>
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
    background: 'var(--bg)',
    backgroundImage: 'var(--bg-decor-1), var(--bg-decor-2)',
    backgroundAttachment: 'fixed',
    backgroundSize: 'cover',
    zIndex: 2000,
    color: 'var(--text)',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
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
  title: { margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '0.5px' },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: 'var(--secondary-text)',
    padding: '4px 8px',
    borderRadius: '8px',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    gap: '16px',
  },
  loading: { fontSize: '16px', color: 'var(--secondary-text)', fontStyle: 'italic' },
  errorBox: {
    padding: '20px',
    background: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: '16px',
    textAlign: 'center',
  },
  errorText: { color: 'var(--timer-low)', marginBottom: '16px', fontSize: '14px' },
  boardWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  message: {
    fontSize: '14px',
    fontWeight: 500,
    textAlign: 'center',
    minHeight: '20px',
    letterSpacing: '0.3px',
  },
  hintRow: { display: 'flex', justifyContent: 'center', marginTop: '4px' },
  hintBtn: {
    padding: '8px 16px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  hintText: {
    maxWidth: '500px',
    padding: '14px 18px',
    background: 'rgba(232, 165, 192, 0.1)',
    border: '1px solid rgba(232, 165, 192, 0.3)',
    borderRadius: '12px',
    fontSize: '13px',
    lineHeight: 1.5,
    color: 'var(--text)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  totalSolved: {
    fontSize: '13px',
    color: 'var(--accent)',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  buttonRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: '8px',
  },
  primaryBtn: {
    padding: '11px 24px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
  },
  secondaryBtn: {
    padding: '11px 24px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
};

export default PuzzleGame;