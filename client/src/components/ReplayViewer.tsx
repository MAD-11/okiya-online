import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import Board from './Board';
import LastPickedTile from './LastPickedTile';
import { Replay, Board as BoardType, Tile } from '../types/game';
import ConfirmDialog from './ConfirmDialog';

interface ReplayViewerProps {
  gameId: string;
  socket: Socket | null;
  onClose: () => void;
}

const REPLAY_INTERVAL_MS = 1100;
const EMPTY_MOVES = Array(4).fill(null).map(() => Array(4).fill(false));

const ReplayViewer: React.FC<ReplayViewerProps> = ({ gameId, socket, onClose }) => {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  // ============ ЗАГРУЗКА ============
  useEffect(() => {
    if (!socket) return;
    setLoading(true);
    setError(null);
    setReplay(null);
    setStep(0);
    setPlaying(false);

    socket.emit('replay:get', gameId, (res: any) => {
      setLoading(false);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (!res?.meta) {
        setError('Реплей не найден');
        return;
      }
      setReplay({ meta: res.meta, moves: res.moves || [] });
    });
  }, [socket, gameId]);

  // ============ АВТОВОСПРОИЗВЕДЕНИЕ ============
  useEffect(() => {
    if (!playing || !replay) return;
    if (step >= replay.moves.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep(s => s + 1), REPLAY_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [playing, step, replay]);

  // ============ ВЫЧИСЛЕНИЕ ТЕКУЩЕГО СОСТОЯНИЯ ============
  const currentBoard: BoardType | null = useMemo(() => {
    if (!replay) return null;
    const b = replay.meta.board.map(row => [...row]);
    for (let i = 0; i < step; i++) {
      const m = replay.moves[i];
      b[m.row][m.col] = m.player;
    }
    return b;
  }, [replay, step]);

  const currentLastPickedTile: Tile | null = useMemo(() => {
    if (!replay) return null;
    if (step === 0) return replay.meta.lastPickedTile;
    return replay.moves[step - 1].tile;
  }, [replay, step]);

  const currentLastMove = useMemo(() => {
    if (!replay || step === 0) return null;
    const m = replay.moves[step - 1];
    return { row: m.row, col: m.col };
  }, [replay, step]);

  const currentPlayer: 'red' | 'black' = useMemo(() => {
    if (!replay || step === 0) return 'red';
    return replay.moves[step - 1].player === 'red' ? 'black' : 'red';
  }, [replay, step]);

  const totalMoves = replay?.moves.length ?? 0;
  const lastMove = step > 0 && replay ? replay.moves[step - 1] : null;

  // ============ УПРАВЛЕНИЕ ============
  const goTo = useCallback((target: number) => {
    if (!replay) return;
    const clamped = Math.max(0, Math.min(target, replay.moves.length));
    setStep(clamped);
    setPlaying(false);
  }, [replay]);

  const stepBack = () => goTo(step - 1);
  const stepForward = () => goTo(step + 1);
  const toStart = () => goTo(0);
  const toEnd = () => replay && goTo(replay.moves.length);

  const togglePlay = () => {
    if (!replay || replay.moves.length === 0) return;
    if (step >= replay.moves.length) {
      setStep(0);
      setPlaying(true);
      return;
    }
    setPlaying(p => !p);
  };

  const handleExit = () => {
    if (playing) {
      setConfirmExitOpen(true);
    } else {
      onClose();
    }
  };

  const confirmExit = () => {
    setConfirmExitOpen(false);
    onClose();
  };

  // ============ КЛАВИАТУРА ============
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepBack(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepForward(); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'Home') { e.preventDefault(); toStart(); }
      else if (e.key === 'End') { e.preventDefault(); toEnd(); }
      else if (e.key === 'Escape') { e.preventDefault(); handleExit(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ============ RENDER ============
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>📺 Реплей партии</h2>
        <button onClick={handleExit} style={styles.closeBtn} title="Закрыть (Esc)">✕</button>
      </header>

      <div style={styles.content}>
        {loading && (
          <>
            <div className="spinner" />
            <p style={styles.loadingText}>Загрузка реплея...</p>
          </>
        )}

        {error && (
          <div style={styles.errorBox}>
            <p style={styles.errorText}>⚠️ {error}</p>
            <button onClick={onClose} style={styles.primaryBtn}>Закрыть</button>
          </div>
        )}

        {!loading && !error && replay && currentBoard && (
          <>
            <div style={styles.metaInfo}>
              <span style={styles.playerNick}>
                <span style={styles.dotRed} />
                {replay.meta.players.red}
              </span>
              <span style={styles.vs}>vs</span>
              <span style={styles.playerNick}>
                <span style={styles.dotBlack} />
                {replay.meta.players.black}
              </span>
            </div>

            <div style={styles.subMeta}>
              Комната <strong>{replay.meta.roomId}</strong>
              {replay.meta.maxWins > 1 && <> · до {replay.meta.maxWins} побед</>}
              <> · {totalMoves} {totalMoves === 1 ? 'ход' : totalMoves < 5 ? 'хода' : 'ходов'}</>
            </div>

            <div style={styles.boardWrapper}>
              <Board
                board={currentBoard}
                validMoves={EMPTY_MOVES}
                onClick={() => {}}
                currentPlayer={currentPlayer}
                myColor={null}
                lastMove={currentLastMove}
                hostSkin="sakura"
                guestSkin="sakura"
                shake={false}
              />
              <LastPickedTile tile={currentLastPickedTile} />
            </div>

            {lastMove && (
              <div style={styles.moveInfo}>
                Ход {step}/{totalMoves}:
                <span style={{ color: lastMove.player === 'red' ? '#e74c3c' : '#bdc3c7', fontWeight: 600, marginLeft: 6 }}>
                  {lastMove.player === 'red' ? '🔴' : '⚫'} → клетка ({lastMove.row + 1}, {lastMove.col + 1})
                </span>
              </div>
            )}

            {!lastMove && (
              <div style={styles.moveInfo}>
                Начальная позиция — ход ещё не сделан
              </div>
            )}

            <div style={styles.controls}>
              <button onClick={toStart} style={styles.ctrlBtn} title="В начало (Home)" disabled={step === 0}>
                ⏮
              </button>
              <button onClick={stepBack} style={styles.ctrlBtn} title="Назад (←)" disabled={step === 0}>
                ◀
              </button>
              <button
                onClick={togglePlay}
                style={{ ...styles.ctrlBtn, ...styles.playBtn }}
                title={playing ? 'Пауза (Space)' : 'Воспроизвести (Space)'}
                disabled={totalMoves === 0}
              >
                {playing ? '⏸' : '▶'}
              </button>
              <button onClick={stepForward} style={styles.ctrlBtn} title="Вперёд (→)" disabled={step >= totalMoves}>
                ▶
              </button>
              <button onClick={toEnd} style={styles.ctrlBtn} title="В конец (End)" disabled={step >= totalMoves}>
                ⏭
              </button>
            </div>

            <div style={styles.progress}>
              <div style={styles.progressBar}>
                <div style={{
                  ...styles.progressFill,
                  width: totalMoves > 0 ? `${(step / totalMoves) * 100}%` : '0%',
                }} />
              </div>
              <span style={styles.progressText}>{step} / {totalMoves}</span>
            </div>

            <div style={styles.bottomRow}>
              <button onClick={onClose} style={styles.secondaryBtn}>Закрыть</button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmExitOpen}
        title="Выйти из просмотра?"
        message="Воспроизведение остановится. Продолжить?"
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
    background: 'var(--bg)',
    backgroundImage: 'var(--bg-decor-1), var(--bg-decor-2)',
    backgroundAttachment: 'fixed',
    backgroundSize: 'cover',
    zIndex: 3000,
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
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
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
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    gap: '14px',
  },
  loadingText: {
    color: 'var(--secondary-text)',
    fontStyle: 'italic',
    fontSize: '14px',
  },
  errorBox: {
    padding: '24px 28px',
    background: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: '16px',
    textAlign: 'center',
  },
  errorText: {
    color: 'var(--timer-low)',
    marginBottom: '16px',
    fontSize: '14px',
  },
  metaInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  playerNick: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  dotRed: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#e74c3c',
    display: 'inline-block',
  },
  dotBlack: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#2c3e50',
    display: 'inline-block',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  vs: {
    fontSize: '12px',
    color: 'var(--secondary-text)',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  subMeta: {
    fontSize: '12px',
    color: 'var(--secondary-text)',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  boardWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '8px',
  },
  moveInfo: {
    fontSize: '14px',
    color: 'var(--secondary-text)',
    textAlign: 'center',
    minHeight: '20px',
    letterSpacing: '0.3px',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
  },
  ctrlBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 600,
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: '56px',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    border: 'none',
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '8px',
    marginBottom: '8px',
  },
  progressBar: {
    width: '260px',
    height: '6px',
    borderRadius: '3px',
    background: 'var(--border)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--btn-bg)',
    borderRadius: '3px',
    transition: 'width 0.25s ease',
  },
  progressText: {
    fontSize: '12px',
    color: 'var(--secondary-text)',
    fontVariantNumeric: 'tabular-nums',
    minWidth: '50px',
    textAlign: 'right',
  },
  bottomRow: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    marginTop: '12px',
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

export default ReplayViewer;