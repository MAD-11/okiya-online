import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { GameState, ValidMoves, Tile } from '../types/game';
import Board from './Board';
import Timer from './Timer';
import LastPickedTile from './LastPickedTile';
import { playMoveSound, playWinSound, playLoseSound, playDrawSound, initAudio } from '../utils/sound';
import Chat from './Chat';
import Profile from './Profile';
import RoomList from './RoomList';
import Settings from './Settings';
import { useTheme } from '../contexts/ThemeContext';

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
  const [showRoomList, setShowRoomList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [vsAnimation, setVsAnimation] = useState<{ nick1: string; nick2: string } | null>(null);

  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const [nick, setNick] = useState(() => getSavedNick() || '');
  const { skin: localSkin } = useTheme();

  // Мобильная адаптация
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      setReconnecting(false);
    }
  };

  // Мониторинг потери соединения
  useEffect(() => {
    if (!connected && roomId && !reconnecting) {
      setReconnecting(true);
      setMessage('Потеряно соединение с сервером. Переподключение...');
      const timeout = setTimeout(() => {
        if (!connected) {
          setMessage('Не удалось переподключиться. Обновите страницу.');
        }
        setReconnecting(false);
      }, 5000);
      return () => clearTimeout(timeout);
    } else if (connected && reconnecting) {
      setReconnecting(false);
      setMessage('');
      const savedRoomId = localStorage.getItem('okiya_roomId');
      const savedToken = localStorage.getItem('okiya_playerToken');
      if (savedRoomId && savedToken && socket) {
        socket.emit('reconnect_room', savedRoomId, savedToken, (res: any) => {
          if (res.error) {
            setMessage(res.error);
            clearSavedRoom();
            setGameState(null);
          } else {
            setRoomId(savedRoomId);
          }
        });
      }
    }
  }, [connected, roomId, reconnecting, socket]);

  // Автоматическое переподключение при загрузке
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
    socket?.emit('create_room', { maxWins, playerId, nick: n, skin: localSkin }, (res: any) => {
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

  const joinRoom = (code?: string) => {
  const id = code || prompt('Введите код комнаты')?.toUpperCase();
  if (!id) return;
  const n = ensureNick();
  // FIX: проверяем socket на null
  if (!socket) {
    setMessage('Нет соединения с сервером');
    return;
  }
  socket.emit('join_room', { roomId: id, playerId, nick: n, skin: localSkin }, (res: any) => {
    console.log('Sending skin:', localSkin);
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
    initAudio();
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

    // УДАЛЁН game_started, так как сервер его не отправляет

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

    socket.on('opponent_joined', (data: { nick1: string; nick2: string }) => {
      setVsAnimation(data);
      setTimeout(() => setVsAnimation(null), 2500);
    });

    return () => {
      socket.off('game_state');
      socket.off('game_over');
      socket.off('opponent_joined');
    };
  }, [socket, gameState?.isHost, gameState?.status, gameState?.maxWins]);

  // Добавляем анимацию VS в глобальный стиль, если её нет
  useEffect(() => {
    if (!document.querySelector('#vs-animation-style')) {
      const style = document.createElement('style');
      style.id = 'vs-animation-style';
      style.innerHTML = `
        @keyframes vsFadeIn {
          0% { opacity: 0; transform: scale(0.8); }
          10% { opacity: 1; transform: scale(1); }
          90% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.2); }
        }
      `;
      document.head.appendChild(style);
      return () => { document.head.removeChild(style); };
    }
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
          {nick && <p style={{ color: 'var(--secondary-text)', marginBottom: 24, fontSize: 14 }}>Вы: <strong>{nick}</strong></p>}
          <div style={styles.buttonGroup}>
            <button onClick={() => createRoom(1)} style={styles.primaryBtn}>Одна игра</button>
            <button onClick={() => createRoom(3)} style={styles.primaryBtn}>До 3 побед</button>
            <button onClick={() => createRoom(5)} style={styles.primaryBtn}>До 5 побед</button>
          </div>
          <div style={styles.separator} />
          <button onClick={() => joinRoom()} style={styles.secondaryBtn}>
            Войти по коду
          </button>
          <button onClick={() => setShowRoomList(true)} style={{ ...styles.secondaryBtn, marginTop: '12px' }}>
            Открытые комнаты
          </button>
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <button onClick={() => setShowProfile(true)} style={styles.textBtn}>👤 Профиль</button>
            <button onClick={() => setShowSettings(true)} style={styles.textBtn}>⚙️ Настройки</button>
          </div>
          {message && <p style={{ color: 'var(--timer-low)', marginTop: 16, fontSize: 14 }}>{message}</p>}
        </div>
        {showProfile && (
          <div style={styles.modalOverlay} onClick={() => setShowProfile(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <Profile onClose={() => setShowProfile(false)} socket={socket} playerId={playerId} />
            </div>
          </div>
        )}
        {showRoomList && (
          <div style={styles.modalOverlay} onClick={() => setShowRoomList(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <RoomList
                onJoin={(roomId) => joinRoom(roomId)}
                socket={socket}
                onClose={() => setShowRoomList(false)}
              />
            </div>
          </div>
        )}
        {showSettings && (
          <div style={styles.modalOverlay} onClick={() => setShowSettings(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <Settings onClose={() => setShowSettings(false)} />
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
      {reconnecting && <div style={styles.reconnectBanner}>Переподключение...</div>}
      {vsAnimation && (
        <div style={styles.vsOverlay}>
          <div style={styles.vsContent}>
            <span>{vsAnimation.nick1}</span>
            <span style={styles.vsText}>VS</span>
            <span>{vsAnimation.nick2}</span>
          </div>
        </div>
      )}
      <header style={styles.gameHeader}>
        <h2 style={styles.titleSmall}>Окийя</h2>
        {roomId && <span style={styles.roomCode}>Комната <strong>{roomId}</strong></span>}
      </header>
      <div style={styles.statusBar}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
          backgroundColor: gameState.opponentConnected ? 'var(--opponent-online)' : 'var(--opponent-offline)'
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
        <div style={{ marginBottom: 4, textAlign: 'center' }}>
          <p style={styles.turnIndicator}>
            {gameState.currentPlayer === gameState.myColor ? '☀️ Ваш ход' : '🌙 Ход противника'}
          </p>
          <Timer turnStartedAt={gameState.turnStartedAt} turnDuration={gameState.turnDuration} />
        </div>
      )}

      <div style={styles.gameLayout}>
        {!isSpectator && (
          <>
            {!isMobile ? (
              <div style={styles.chatColumn}>
                <Chat
                  messages={gameState.messages ?? []}
                  onSend={handleChatSend}
                  myNick={gameState.myNick}
                />
              </div>
            ) : (
              <details style={styles.mobileChatToggle}>
                <summary style={styles.mobileChatSummary}>💬 Чат</summary>
                <div style={styles.mobileChatContent}>
                  <Chat
                    messages={gameState.messages ?? []}
                    onSend={handleChatSend}
                    myNick={gameState.myNick}
                  />
                </div>
              </details>
            )}
          </>
        )}

        <div style={styles.centerColumn}>
          <div style={styles.boardArea}>
            <Board
              board={gameState.board}
              validMoves={validMoves}
              onClick={handleCellClick}
              currentPlayer={gameState.currentPlayer}
              myColor={gameState.myColor}
              lastMove={gameState.lastMove}
              skin={gameState.myColor === 'red' 
                ? (gameState.hostSkin || 'sakura') 
                : (gameState.guestSkin || 'sakura')}
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
              {waitingRestart && <p style={{ fontSize: 13, color: 'var(--secondary-text)' }}>Ожидание соперника…</p>}
            </div>
          )}
          <div style={styles.buttonRow}>
            <button onClick={backToMenu} style={styles.actionBtn}>
              Выйти в меню
            </button>
            {(gameState.status === 'finished' || gameState.seriesWinner) && (
              <button onClick={handleResetRoom} style={{ ...styles.actionBtn, backgroundColor: '#4a6741' }}>
                {waitingReset ? 'Ожидание…' : 'Новая игра'}
              </button>
            )}
            {gameState.status === 'playing' && !isSpectator && (
              <button onClick={handleForfeit} style={{ ...styles.actionBtn, backgroundColor: '#b5651d' }}>
                Сдаться
              </button>
            )}
            <button onClick={() => setShowSettings(true)} style={{ ...styles.actionBtn, backgroundColor: 'var(--game-btn-bg)' }}>
              Настройки
            </button>
          </div>
        </div>
      </div>
      {showSettings && (
        <div style={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <Settings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

// Стили с использованием CSS-переменных
const styles: Record<string, React.CSSProperties> = {
  lobbyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: '"Cormorant Garamond", "Times New Roman", serif',
    padding: '20px',
  },
  lobbyCard: {
    background: 'var(--card-bg)',
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
    color: 'var(--text)',
    fontWeight: 400,
    letterSpacing: '2px',
    fontFamily: '"Cormorant Garamond", "Times New Roman", serif',
  },
  subtitle: {
    fontSize: '16px',
    color: 'var(--secondary-text)',
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
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '40px',
    backgroundColor: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    transition: 'background-color 0.2s',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    minWidth: '100px',
  },
  secondaryBtn: {
  padding: '14px 32px',
  fontSize: '16px',
  fontWeight: 500,
  border: 'none',                      // убираем обводку
  borderRadius: '40px',
  backgroundColor: 'var(--btn-bg)',    // тот же фон, что у primaryBtn
  color: 'var(--btn-text)',            // тот же цвет текста
  cursor: 'pointer',
  fontFamily: '"Inter", "Segoe UI", sans-serif',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: '12px',
  transition: 'background-color 0.2s',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
},
  separator: {
    height: '1px',
    backgroundColor: 'var(--border)',
    margin: '20px 0',
    width: '60%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  textBtn: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: 'var(--secondary-text)',
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
    color: 'var(--text)',
    fontFamily: '"Inter", sans-serif',
  },
  gameContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  gameHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '20px',
    padding: '16px 20px 8px',
  },
  titleSmall: {
    fontSize: '32px',
    fontWeight: 400,
    margin: 0,
    fontFamily: '"Cormorant Garamond", serif',
    color: 'var(--text)',
  },
  roomCode: {
    fontSize: '14px',
    color: 'var(--secondary-text)',
    fontFamily: '"Inter", sans-serif',
  },
  statusBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '8px',
    fontSize: '13px',
    color: 'var(--text)',
  },
  score: {
    fontSize: '16px',
    fontWeight: 500,
    marginBottom: '4px',
    textAlign: 'center',
    color: 'var(--text)',
  },
  turnIndicator: {
    fontSize: '16px',
    margin: '0 0 4px',
    fontWeight: 500,
    color: 'var(--turn-indicator)',
  },
  gameLayout: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '24px',
    flex: 1,
    padding: '0 20px 20px',
    overflow: 'hidden',
  },
  chatColumn: {
    width: '280px',
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
    background: 'var(--card-bg)',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    textAlign: 'center',
    color: 'var(--text)',
  },
  message: {
    fontWeight: 500,
    color: 'var(--text)',
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
    fontWeight: 600,
    border: 'none',
    borderRadius: '30px',
    backgroundColor: 'var(--game-btn-bg)',
    color: 'var(--game-btn-text)',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'background-color 0.2s',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--overlay)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--modal-bg)',
    borderRadius: '24px',
    maxWidth: '440px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  mobileChatToggle: {
    width: '100%',
    marginBottom: '12px',
    background: 'var(--card-bg)',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  mobileChatSummary: {
    padding: '10px 16px',
    cursor: 'pointer',
    fontWeight: 500,
    color: 'var(--text)',
    userSelect: 'none',
    listStyle: 'none',
  },
  mobileChatContent: {
    padding: '12px',
    borderTop: '1px solid var(--border)',
    height: '300px',
    overflow: 'auto',
  },
  vsOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    animation: 'vsFadeIn 2.5s ease-out forwards',
  },
  vsContent: {
    display: 'flex',
    gap: '30px',
    fontSize: '48px',
    fontWeight: 700,
    color: '#fff',
    fontFamily: '"Cormorant Garamond", serif',
  },
  vsText: {
    color: '#c9a96e',
  },
  reconnectBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'var(--timer-low)',
    color: '#fff',
    textAlign: 'center',
    padding: '8px',
    zIndex: 2000,
    fontWeight: 'bold',
  },
};

export default Game;