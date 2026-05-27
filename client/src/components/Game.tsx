import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { GameState, ValidMoves, Tile } from '../types/game';
import Board from './Board';
import Timer from './Timer';
import LastPickedTile from './LastPickedTile';
import { playMoveSound, playWinSound, playLoseSound, playDrawSound } from '../utils/sound';
import Chat from './Chat';
import Profile from './Profile';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

function getOrCreatePlayerId(): string {
  let id = localStorage.getItem('okiya_playerId');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    localStorage.setItem('okiya_playerId', id);
  }
  return id;
}

function getSavedNick(): string | null {
  return localStorage.getItem('okiya_nick');
}

const Game: React.FC = () => {
  const { socket, connected } = useSocket(SERVER_URL);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [personalGameOver, setPersonalGameOver] = useState<string | null>(null);
  const [waitingRestart, setWaitingRestart] = useState(false);
  const [waitingReset, setWaitingReset] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const [nick, setNick] = useState(() => getSavedNick() || '');

  const ensureNick = (): string => {
    if (nick) return nick;
    const newNick = prompt('Придумайте себе постоянный никнейм (не более 12 символов)') || 'Игрок';
    const trimmed = newNick.slice(0, 12);
    localStorage.setItem('okiya_nick', trimmed);
    setNick(trimmed);
    return trimmed;
  };

  const clearSavedRoom = () => {
    localStorage.removeItem('okiya_roomId');
    localStorage.removeItem('okiya_playerToken');
  };

  const backToMenu = () => {
    if (window.confirm('Вы уверены, что хотите выйти в главное меню? Текущая игра будет потеряна.')) {
      if (socket && roomId) {
        socket.emit('leave_room', roomId);
      }
      clearSavedRoom();
      setGameState(null);
      setRoomId(null);
      setMessage('');
      setPersonalGameOver(null);
      setWaitingRestart(false);
      setWaitingReset(false);
    }
  };

  useEffect(() => {
    if (!socket || !connected) return;
    const savedRoomId = localStorage.getItem('okiya_roomId');
    const savedToken = localStorage.getItem('okiya_playerToken');
    if (savedRoomId && savedToken) {
      socket.emit('reconnect_room', savedRoomId, savedToken, (res: any) => {
        if (res.error) {
          clearSavedRoom();
          setMessage(res.error);
        } else {
          setRoomId(savedRoomId);
          setMessage('');
        }
      });
    }
  }, [socket, connected]);

  const createRoom = (maxWins: number) => {
    const n = ensureNick();
    socket?.emit('create_room', { maxWins, playerId, nick: n }, (res: any) => {
      if (res.roomId) {
        localStorage.setItem('okiya_roomId', res.roomId);
        localStorage.setItem('okiya_playerToken', res.playerToken);
        setRoomId(res.roomId);
        setGameState(res.state);
        setMessage('');
        setPersonalGameOver(null);
        setWaitingRestart(false);
        setWaitingReset(false);
      }
    });
  };

  const joinRoom = () => {
    const id = prompt('Введите код комнаты')?.toUpperCase();
    if (!id) return;
    const n = ensureNick();
    socket?.emit('join_room', { roomId: id, playerId, nick: n }, (res: any) => {
      if (res.error) {
        setMessage(res.error);
      } else {
        localStorage.setItem('okiya_roomId', id);
        localStorage.setItem('okiya_playerToken', res.playerToken);
        setRoomId(id);
        setGameState(res.state);
        setMessage('');
        setPersonalGameOver(null);
        setWaitingRestart(false);
        setWaitingReset(false);
      }
    });
  };

  const validMoves: ValidMoves = useMemo(() => {
    if (!gameState || gameState.status !== 'playing' || gameState.myColor !== gameState.currentPlayer) {
      return Array(4).fill(null).map(() => Array(4).fill(false));
    }
    const { board, lastPickedTile } = gameState;
    const moves: boolean[][] = Array(4).fill(null).map(() => Array(4).fill(false));
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = board[r][c];
        if (!cell || typeof cell === 'string') continue;
        if (!lastPickedTile) {
          if (r === 0 || r === 3 || c === 0 || c === 3) moves[r][c] = true;
        } else {
          const tile = cell as Tile;
          if (tile.plant === lastPickedTile.plant || tile.symbol === lastPickedTile.symbol) {
            moves[r][c] = true;
          }
        }
      }
    }
    return moves;
  }, [gameState]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!socket || !roomId || !gameState || gameState.status !== 'playing') return;
    if (gameState.myColor !== gameState.currentPlayer) {
      setMessage('Сейчас не ваш ход');
      return;
    }
    socket.emit('move', roomId, row, col, (res: any) => {
      if (res.error) {
        setMessage(res.error);
      } else {
        playMoveSound();
      }
    });
  }, [socket, roomId, gameState]);

  const handleRestartRound = () => {
    if (!socket || !roomId) return;
    setWaitingRestart(true);
    socket.emit('restart_round', roomId, (res: any) => {
      if (res?.error) setWaitingRestart(false);
    });
  };

  const handleResetRoom = () => {
    if (!socket || !roomId) return;
    setWaitingReset(true);
    socket.emit('reset_room', roomId, (res: any) => {
      if (res?.error) {
        setWaitingReset(false);
        setMessage(res.error);
      }
    });
  };

  const handleForfeit = () => {
    if (!socket || !roomId || !gameState || gameState.status !== 'playing') return;
    if (window.confirm('Вы уверены, что хотите сдаться? Вам будет засчитано поражение.')) {
      socket.emit('forfeit', roomId, (res: any) => {
        if (res?.error) setMessage(res.error);
      });
    }
  };

  const handleChatSend = (text: string) => {
    if (socket && roomId) {
      socket.emit('chat_message', roomId, text);
    }
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('game_started', (state: GameState) => {
      setGameState(state);
      setPersonalGameOver(null);
      setWaitingRestart(false);
      setWaitingReset(false);
    });

    socket.on('game_state', (state: GameState) => {
      if (state.status === 'playing' && gameState?.status === 'finished') {
        setPersonalGameOver(null);
        setWaitingRestart(false);
        setWaitingReset(false);
        setMessage('');
      }
      setGameState(state);
    });

    socket.on('game_over', (data: { winner: string; yourResult: string; seriesWinner: string | null }) => {
      if (data.yourResult === 'win') playWinSound();
      else if (data.yourResult === 'lose') playLoseSound();
      else if (data.yourResult === 'draw') playDrawSound();

      let text = '';
      if (data.yourResult === 'win') text = '🎉 Вы выиграли!';
      else if (data.yourResult === 'lose') text = 'Поражение. Победил ' + (data.winner === 'red' ? '🌸 Красные' : '🐦 Чёрные');
      else if (data.yourResult === 'draw') text = 'Ничья';

      if (data.seriesWinner) {
        const iAmHost = gameState?.isHost;
        if ((data.seriesWinner === 'host' && iAmHost) || (data.seriesWinner === 'guest' && !iAmHost)) {
          text += ' 🏆 Вы выиграли серию!';
        } else {
          text += ' Серия проиграна.';
        }
        clearSavedRoom();
      } else if (gameState?.maxWins === 1) {
        clearSavedRoom();
      }
      setPersonalGameOver(text);
    });

    return () => {
      socket.off('game_started');
      socket.off('game_state');
      socket.off('game_over');
    };
  }, [socket, gameState?.isHost, gameState?.status, gameState?.maxWins]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes pulse {
        0% { box-shadow: 0 0 8px #f1c40f88; }
        50% { box-shadow: 0 0 18px #f1c40fcc; }
        100% { box-shadow: 0 0 8px #f1c40f88; }
      }
      @keyframes placeStone {
        from { transform: scale(0); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!connected) {
    return (
      <div style={styles.centered}>
        <p>Подключение к серверу...</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div style={styles.lobbyContainer}>
        <div style={styles.lobbyCard}>
          <h1 style={styles.title}>Окийя</h1>
          <p style={styles.subtitle}>изящная дуэльная игра</p>
          {nick && <p style={{ color: '#4a3f35', marginBottom: 24, fontSize: 14 }}>Вы: <strong>{nick}</strong></p>}
          <div style={styles.buttonGroup}>
            <button onClick={() => createRoom(1)} style={styles.primaryBtn}>Одна игра</button>
            <button onClick={() => createRoom(3)} style={styles.primaryBtn}>До 3 побед</button>
            <button onClick={() => createRoom(5)} style={styles.primaryBtn}>До 5 побед</button>
          </div>
          <div style={styles.separator} />
          <button onClick={joinRoom} style={styles.secondaryBtn}>
            Войти по коду
          </button>
          <div style={{ marginTop: 32 }}>
            <button onClick={() => setShowProfile(true)} style={styles.textBtn}>👤 Профиль</button>
          </div>
          {message && <p style={{ color: '#c0392b', marginTop: 16, fontSize: 14 }}>{message}</p>}
        </div>
        {showProfile && (
          <div style={styles.modalOverlay} onClick={() => setShowProfile(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <Profile onClose={() => setShowProfile(false)} socket={socket} playerId={playerId} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const isSpectator = !gameState.myColor;
  const canRestart = gameState.roundFinished && !waitingRestart;

  return (
    <div style={styles.gameContainer}>
      <header style={styles.gameHeader}>
        <h2 style={styles.titleSmall}>Окийя</h2>
        {roomId && <span style={styles.roomCode}>Комната <strong>{roomId}</strong></span>}
      </header>
      <div style={styles.statusBar}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
          backgroundColor: gameState.opponentConnected ? '#27ae60' : '#c0392b'
        }} />
        <span style={{ marginLeft: 6, fontSize: 13 }}>
          {gameState.opponentConnected ? 'Соперник в сети' : 'Соперник не в сети'}
        </span>
        <span style={{ marginLeft: 16, fontSize: 13 }}>
          {gameState.myNick} vs {gameState.myColor === 'red' ? gameState.nickBlack : gameState.nickRed}
        </span>
      </div>

      {gameState.maxWins > 1 && (
        <div style={styles.score}>
          Счёт: {gameState.myScore} — {gameState.opponentScore}
        </div>
      )}
      {gameState.status === 'playing' && !isSpectator && (
        <div style={{ marginBottom: 8 }}>
          <p style={styles.turnIndicator}>
            {gameState.currentPlayer === gameState.myColor ? '☀️ Ваш ход' : '🌙 Ход противника'}
          </p>
          <Timer turnStartedAt={gameState.turnStartedAt} turnDuration={gameState.turnDuration} />
        </div>
      )}

      {/* Основной блок: чат слева, доска и кнопки по центру */}
      <div style={styles.mainLayout}>
        <div style={styles.chatColumn}>
          {gameState.status === 'playing' && !isSpectator && (
            <Chat
              messages={gameState.messages ?? []}
              onSend={handleChatSend}
              myNick={gameState.myNick}
            />
          )}
        </div>
        <div style={styles.centerColumn}>
          <div style={styles.boardArea}>
            <Board
              board={gameState.board}
              validMoves={validMoves}
              onClick={handleCellClick}
              currentPlayer={gameState.currentPlayer}
              myColor={gameState.myColor}
              lastMove={gameState.lastMove}
            />
            <LastPickedTile tile={gameState.lastPickedTile} />
          </div>
          {personalGameOver && (
            <div style={styles.gameOverBlock}>
              <p style={styles.message}>{personalGameOver}</p>
              {canRestart && (
                <button onClick={handleRestartRound} style={styles.actionBtn}>
                  Ещё одна игра
                </button>
              )}
              {waitingRestart && <p style={{ fontSize: 13, color: '#7f6e5d' }}>Ожидание соперника…</p>}
            </div>
          )}
          <div style={styles.buttonRow}>
            <button onClick={backToMenu} style={{ ...styles.actionBtn, background: '#6b5b4f' }}>
              Выйти в меню
            </button>
            {(gameState.status === 'finished' || gameState.seriesWinner) && (
              <button onClick={handleResetRoom} style={{ ...styles.actionBtn, background: '#4a6741' }}>
                {waitingReset ? 'Ожидание…' : 'Новая игра'}
              </button>
            )}
            {gameState.status === 'playing' && !isSpectator && (
              <button onClick={handleForfeit} style={{ ...styles.actionBtn, background: '#b5651d' }}>
                Сдаться
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  lobbyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#f7f3eb',
    fontFamily: '"Cormorant Garamond", "Times New Roman", serif',
    padding: '20px',
  },
  lobbyCard: {
    background: '#ffffff',
    borderRadius: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
    padding: '48px 40px',
    maxWidth: '440px',
    width: '100%',
    textAlign: 'center',
  },
  title: {
    fontSize: '52px',
    margin: '0 0 8px',
    color: '#3e362e',
    fontWeight: 400,
    letterSpacing: '2px',
    fontFamily: '"Cormorant Garamond", "Times New Roman", serif',
  },
  subtitle: {
    fontSize: '16px',
    color: '#8b7a6b',
    marginBottom: '32px',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    fontWeight: 300,
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '24px',
  },
  primaryBtn: {
    padding: '12px 28px',
    fontSize: '15px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '40px',
    backgroundColor: '#3e362e',
    color: '#fff',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    letterSpacing: '0.5px',
  },
  separator: {
    height: '1px',
    backgroundColor: '#e0d6c8',
    margin: '20px 0',
    width: '60%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  secondaryBtn: {
    padding: '12px 28px',
    fontSize: '15px',
    fontWeight: 500,
    border: '1px solid #3e362e',
    borderRadius: '40px',
    backgroundColor: 'transparent',
    color: '#3e362e',
    cursor: 'pointer',
    transition: 'all 0.3s',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    letterSpacing: '0.5px',
  },
  textBtn: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: '#8b7a6b',
    cursor: 'pointer',
    fontFamily: '"Inter", sans-serif',
    textDecoration: 'underline',
    textUnderlineOffset: '4px',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#3e362e',
    fontFamily: '"Inter", sans-serif',
  },
  gameContainer: {
    textAlign: 'center',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    background: '#f7f3eb',
    minHeight: '100vh',
    margin: 0,
    padding: '24px 16px',
    color: '#3e362e',
  },
  gameHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '20px',
    marginBottom: '12px',
  },
  titleSmall: {
    fontSize: '36px',
    fontWeight: 400,
    margin: 0,
    fontFamily: '"Cormorant Garamond", serif',
    letterSpacing: '1px',
  },
  roomCode: {
    fontSize: '14px',
    color: '#8b7a6b',
    fontFamily: '"Inter", sans-serif',
  },
  statusBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '13px',
    color: '#5e503a',
  },
  score: {
    fontSize: '16px',
    fontWeight: 500,
    marginBottom: '8px',
    color: '#3e362e',
  },
  turnIndicator: {
    fontSize: '16px',
    marginBottom: '4px',
    fontWeight: 500,
    color: '#b8860b',
  },
  mainLayout: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '40px',
    marginTop: '16px',
    flexWrap: 'wrap',
  },
  chatColumn: {
    width: '300px',
    height: '70vh',
    flexShrink: 0,
  },
  centerColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  boardArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  gameOverBlock: {
    background: 'rgba(255,255,245,0.9)',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    textAlign: 'center',
  },
  message: {
    fontWeight: 500,
    color: '#3e362e',
    fontSize: '16px',
    margin: '0 0 12px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '40px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'opacity 0.3s',
    fontFamily: '"Inter", sans-serif',
    letterSpacing: '0.3px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: '24px',
    padding: '32px',
    maxWidth: '380px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
};

export default Game;