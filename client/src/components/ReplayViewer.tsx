import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
const WIDE_THRESHOLD = 800;

const ReplayViewer: React.FC<ReplayViewerProps> = ({ gameId, socket, onClose }) => {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [isWide, setIsWide] = useState(
    typeof window !== 'undefined' && window.innerWidth >= WIDE_THRESHOLD
  );

  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= WIDE_THRESHOLD);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!socket) return;
    setLoading(true);
    setError(null);
    setReplay(null);
    setStep(0);
    setPlaying(false);

    socket.emit('replay:get', gameId, (res: any) => {
      setLoading(false);
      if (res?.error) { setError(res.error); return; }
      if (!res?.meta) { setError('Реплей не найден'); return; }
      setReplay({ meta: res.meta, moves: res.moves || [] });
    });
  }, [socket, gameId]);

  useEffect(() => {
    if (!playing || !replay) return;
    if (step >= replay.moves.length) { setPlaying(false); return; }
    const timer = setTimeout(() => setStep(s => s + 1), REPLAY_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [playing, step, replay]);

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

  const goTo = useCallback((target: number) => {
    if (!replay) return;
    setStep(Math.max(0, Math.min(target, replay.moves.length)));
    setPlaying(false);
  }, [replay]);

  const stepBack = () => goTo(step - 1);
  const stepForward = () => goTo(step + 1);
  const toStart = () => goTo(0);
  const toEnd = () => replay && goTo(replay.moves.length);

  const togglePlay = () => {
    if (!replay || replay.moves.length === 0) return;
    if (step >= replay.moves.length) { setStep(0); setPlaying(true); return; }
    setPlaying(p => !p);
  };

  const handleExit = () => { if (playing) setConfirmExitOpen(true); else onClose(); };
  const confirmExit = () => { setConfirmExitOpen(false); onClose(); };

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

  const progressPct = totalMoves > 0 ? (step / totalMoves) * 100 : 0;

  const Controls = (
    <div style={styles.controls}>
      <button onClick={toStart} style={styles.ctrlBtn} disabled={step === 0} title="В начало (Home)">⏮</button>
      <button onClick={stepBack} style={styles.ctrlBtn} disabled={step === 0} title="Назад (←)">◀</button>
      <button
        onClick={togglePlay}
        style={{ ...styles.ctrlBtn, ...styles.playBtn }}
        disabled={totalMoves === 0}
        title={playing ? 'Пауза (Space)' : 'Воспроизвести (Space)'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <button onClick={stepForward} style={styles.ctrlBtn} disabled={step >= totalMoves} title="Вперёд (→)">▶</button>
      <button onClick={toEnd} style={styles.ctrlBtn} disabled={step >= totalMoves} title="В конец (End)">⏭</button>
    </div>
  );

  const ProgressBar = (
    <div style={styles.progress}>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${progressPct}%` }} />
      </div>
      <span style={styles.progressText}>{step} / {totalMoves}</span>
    </div>
  );

  const MoveInfo = (
    <div style={styles.moveInfo}>
      {lastMove
        ? `Ход ${step}/${totalMoves}: ${lastMove.player === 'red' ? '🔴' : '⚫'} → (${lastMove.row + 1}, ${lastMove.col + 1})`
        : 'Начальная позиция'}
    </div>
  );

  const content = (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>📺 Реплей</h2>
        <span style={styles.headerMeta}>
          {replay && `${replay.meta.roomId} · ${totalMoves} ${totalMoves === 1 ? 'ход' : totalMoves < 5 ? 'хода' : 'ходов'}`}
        </span>
        <button onClick={handleExit} style={styles.closeBtn} title="Закрыть (Esc)">✕</button>
      </header>

      {loading && (
        <div style={styles.centered}>
          <div className="spinner" />
          <p style={styles.loadingText}>Загрузка реплея...</p>
        </div>
      )}

      {error && (
        <div style={styles.centered}>
          <div style={styles.errorBox}>
            <p style={styles.errorText}>⚠️ {error}</p>
            <button onClick={onClose} style={styles.primaryBtn}>Закрыть</button>
          </div>
        </div>
      )}

      {!loading && !error && replay && currentBoard && (
        isWide ? (
          <div style={styles.wideLayout}>
            <div style={styles.boardColumn}>
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

            <div style={styles.infoColumn}>
              <div style={styles.playersBox}>
                <div style={styles.playerRow}>
                  <span style={styles.dotRed} />
                  <span style={styles.nickText}>{replay.meta.players.red}</span>
                </div>
                <div style={styles.vsRow}>vs</div>
                <div style={styles.playerRow}>
                  <span style={styles.dotBlack} />
                  <span style={styles.nickText}>{replay.meta.players.black}</span>
                </div>
                <div style={styles.subMetaSmall}>
                  Комната <strong>{replay.meta.roomId}</strong>
                  {replay.meta.maxWins > 1 && ` · до ${replay.meta.maxWins} побед`}
                </div>
              </div>

              {MoveInfo}
              {ProgressBar}
              {Controls}

              <div style={styles.hintLine}>
                ← → · Space · Home/End · Esc
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.mobileLayout}>
            <div style={styles.boardColumn}>
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

            {Controls}
            {ProgressBar}
            {MoveInfo}

            <div style={styles.playersBox}>
              <div style={styles.playerRow}>
                <span style={styles.dotRed} />
                <span style={styles.nickText}>{replay.meta.players.red}</span>
              </div>
              <div style={styles.vsRow}>vs</div>
              <div style={styles.playerRow}>
                <span style={styles.dotBlack} />
                <span style={styles.nickText}>{replay.meta.players.black}</span>
              </div>
            </div>
          </div>
        )
      )}

      <ConfirmDialog
        open={confirmExitOpen}
        title="Выйти из просмотра?"
        message="Воспроизведение остановится. Продолжить?"
        onConfirm={confirmExit}
        onCancel={() => setConfirmExitOpen(false)}
      />
    </div>
  );

  // ⭐ ГЛАВНОЕ: рендерим в document.body, минуя родителя с backdrop-filter
  return createPortal(content, document.body);
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--bg)',
    backgroundImage: 'var(--bg-decor-1), var(--bg-decor-2)',
    backgroundAttachment: 'fixed',
    backgroundSize: 'cover',
    zIndex: 9999,
    color: 'var(--text)',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    background: 'var(--card-bg)',
    borderBottom: '1px solid var(--border)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    letterSpacing: '0.3px',
    flexShrink: 0,
  },
  headerMeta: {
    flex: 1,
    fontSize: '12px',
    color: 'var(--secondary-text)',
    letterSpacing: '0.3px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: 'var(--secondary-text)',
    padding: '4px 8px',
    borderRadius: '8px',
    flexShrink: 0,
  },
  centered: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '20px',
  },
  loadingText: {
    color: 'var(--secondary-text)',
    fontStyle: 'italic',
    fontSize: '13px',
  },
  errorBox: {
    padding: '20px 24px',
    background: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: '14px',
    textAlign: 'center',
  },
  errorText: {
    color: 'var(--timer-low)',
    marginBottom: '14px',
    fontSize: '13px',
  },
  primaryBtn: {
    padding: '10px 22px',
    borderRadius: '10px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
  },

  // ===== ДЕСКТОП: доска слева, управление справа =====
  wideLayout: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '32px',
    padding: '16px 24px',
    overflow: 'auto',
  },
  boardColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexShrink: 0,
  },
  infoColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '300px',
    flexShrink: 0,
  },
  playersBox: {
    background: 'var(--card-bg)',
    padding: '12px 16px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 600,
  },
  nickText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  },
  dotRed: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#e74c3c',
    display: 'inline-block',
    flexShrink: 0,
  },
  dotBlack: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#2c3e50',
    display: 'inline-block',
    border: '1px solid rgba(255,255,255,0.2)',
    flexShrink: 0,
  },
  vsRow: {
    fontSize: '10px',
    color: 'var(--secondary-text)',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    paddingLeft: '18px',
  },
  subMetaSmall: {
    fontSize: '11px',
    color: 'var(--secondary-text)',
    marginTop: '4px',
    letterSpacing: '0.3px',
  },
  moveInfo: {
    fontSize: '13px',
    color: 'var(--secondary-text)',
    textAlign: 'center',
    minHeight: '18px',
    letterSpacing: '0.3px',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'center',
  },
  ctrlBtn: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
    gap: '10px',
    justifyContent: 'center',
  },
  progressBar: {
    flex: 1,
    maxWidth: '240px',
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
    fontSize: '11px',
    color: 'var(--secondary-text)',
    fontVariantNumeric: 'tabular-nums',
    minWidth: '44px',
    textAlign: 'right',
  },
  hintLine: {
    fontSize: '10px',
    color: 'var(--secondary-text)',
    opacity: 0.5,
    textAlign: 'center',
    letterSpacing: '0.3px',
  },

  // ===== МОБИЛЬНЫЙ =====
  mobileLayout: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px 16px',
    overflowY: 'auto',
  },
};

export default ReplayViewer;