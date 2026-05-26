import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { GameState, ValidMoves, Tile } from '../types/game';
import Board from './Board';
import Timer from './Timer';
import LastPickedTile from './LastPickedTile';
import { playMoveSound, playWinSound, playLoseSound, playDrawSound } from '../utils/sound';
import { useTheme } from '../contexts/ThemeContext';
import RoomList from './RoomList';
import Chat from './Chat';
import Profile from './Profile';
import Settings from './Settings';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

const Game: React.FC = () => {
  const { socket, connected } = useSocket(SERVER_URL);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [personalGameOver, setPersonalGameOver] = useState<string | null>(null);
  const [waitingRestart, setWaitingRestart] = useState(false);
  const [waitingReset, setWaitingReset] = useState(false);

  // Модальные окна
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { darkMode, skin } = useTheme();

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

  // Автоподключение
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
    const nick = prompt('Введите ваш никнейм') || 'Игрок';
    socket?.emit('create_room', { maxWins, nick }, (res: any) => {
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
    const nick = prompt('Введите ваш никнейм') || 'Игрок';
    socket?.emit('join_room', { roomId: id, nick }, (res: any) => {
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

  // Слушатели событий
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

  // Анимации
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
      .dark { background-color: #1e1e1e !important; color: #e0e0e0; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!connected) {
    return (
      <div style={styles.centered}>
        <div className="spinner" />
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

          <div style={styles.buttonGroup}>
            <button onClick={() => createRoom(1)} style={styles.primaryBtn}>Одна игра</button>
            <button onClick={() => createRoom(3)} style={styles.primaryBtn}>Серия до 3</button>
            <button onClick={() => createRoom(5)} style={styles.primaryBtn}>Серия до 5</button>
          </div>

          <div style={styles.orDivider}>
            <span style={styles.orText}>или</span>
          </div>

          <button onClick={() => joinRoom()} style={styles.secondaryBtn}>
            Присоединиться по коду
          </button>

          <RoomList onJoin={(roomId) => joinRoom(roomId)} socket={socket} />

          <div style={styles.bottomButtons}>
            <button onClick={() => setShowProfile(true)} style={styles.iconBtn}>👤 Профиль</button>
            <button onClick={() => setShowSettings(true)} style={styles.iconBtn}>⚙️ Настройки</button>
          </div>

          {message && <p style={styles.error}>{message}</p>}
        </div>

        {showProfile && (
          <div style={styles.modalOverlay} onClick={() => setShowProfile(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <Profile onClose={() => setShowProfile(false)} socket={socket} />
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

  // ========== ИГРОВОЕ ПОЛЕ ==========
  const isSpectator = !gameState.myColor;
  const canRestart = gameState.roundFinished && !waitingRestart;

  return (
    <div style={styles.gameContainer}>
      <h2 style={styles.titleSmall}>Окийя</h2>
      {roomId && <p style={styles.roomCode}>Код комнаты: <strong>{roomId}</strong></p>}
      <div style={styles.statusBar}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
          backgroundColor: gameState.opponentConnected ? '#2ecc71' : '#e74c3c'
        }} />
        <span style={{ fontSize: 14, marginLeft: 6 }}>
          {gameState.opponentConnected ? 'Соперник в сети' : 'Соперник не в сети'}
        </span>
        <span style={{ marginLeft: 12, fontSize: 14 }}>
          Вы: {gameState.myNick} | Соперник: {gameState.myColor === 'red' ? gameState.nickBlack : gameState.nickRed}
        </span>
      </div>

      {gameState.maxWins > 1 && (
        <p style={styles.score}>
          Вы: {gameState.myScore} — Соперник: {gameState.opponentScore}
        </p>
      )}
      {gameState.status === 'playing' && !isSpectator && (
        <>
          <p style={styles.turnIndicator}>
            {gameState.currentPlayer === gameState.myColor ? '☀️ Ваш ход' : '🌙 Ход противника'}
          </p>
          <Timer turnStartedAt={gameState.turnStartedAt} turnDuration={gameState.turnDuration} />
        </>
      )}

      <div style={styles.gameLayout}>
        <div style={styles.boardArea}>
          <Board
            board={gameState.board}
            validMoves={validMoves}
            onClick={handleCellClick}
            currentPlayer={gameState.currentPlayer}
            myColor={gameState.myColor}
            lastMove={gameState.lastMove}
            skin={skin}
          />
          <LastPickedTile tile={gameState.lastPickedTile} />
        </div>

        <div style={styles.sidePanel}>
          {personalGameOver && (
            <div style={styles.gameOverBlock}>
              <p style={styles.message}>{personalGameOver}</p>
              {canRestart && (
                <button onClick={handleRestartRound} style={styles.actionBtn}>
                  Ещё одна игра
                </button>
              )}
              {waitingRestart && <p>Ожидание соперника...</p>}
            </div>
          )}

          <button onClick={backToMenu} style={{ ...styles.actionBtn, background: '#e74c3c' }}>
            Выйти в главное меню
          </button>
          {(gameState.status === 'finished' || gameState.seriesWinner) && (
            <button onClick={handleResetRoom} style={{ ...styles.actionBtn, background: '#2ecc71' }}>
              {waitingReset ? 'Ожидание соперника...' : 'Новая игра в этой же комнате'}
            </button>
          )}
          {gameState.status === 'playing' && !isSpectator && (
            <button onClick={handleForfeit} style={{ ...styles.actionBtn, background: '#e67e22' }}>
              Сдаться
            </button>
          )}

          <Chat messages={gameState.messages ?? []} onSend={handleChatSend} />
        </div>
      </div>
    </div>
  );
};

// ==================== СТИЛИ ====================
const styles: Record<string, React.CSSProperties> = {
  // Лобби
  lobbyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5efe0 0%, #e8d9c5 100%)',
    fontFamily: '"Segoe UI", "Noto Serif JP", serif',
    padding: '20px',
  },
  lobbyCard: {
    background: 'white',
    borderRadius: '20px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    padding: '40px 30px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
    position: 'relative',
  },
  title: {
    fontSize: '48px',
    margin: '0 0 10px',
    color: '#4a3f35',
    fontWeight: 700,
  },
  subtitle: {
    fontSize: '18px',
    color: '#7f6e5d',
    marginBottom: '30px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  primaryBtn: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#d4a373',
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(212, 163, 115, 0.4)',
    transition: '0.2s',
    minWidth: '100px',
  },
  secondaryBtn: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    border: '2px solid #d4a373',
    borderRadius: '12px',
    backgroundColor: 'transparent',
    color: '#4a3f35',
    cursor: 'pointer',
    marginBottom: '20px',
    width: '100%',
    boxSizing: 'border-box',
    transition: '0.2s',
  },
  orDivider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
  },
  orText: {
    margin: '0 auto',
    color: '#b0a090',
    fontSize: '14px',
    textTransform: 'uppercase',
  },
  bottomButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginTop: '20px',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    color: '#4a3f35',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '5px',
  },
  error: {
    color: '#e74c3c',
    marginTop: '15px',
    fontWeight: 500,
  },
  // Игровой контейнер
  gameContainer: {
    textAlign: 'center',
    fontFamily: '"Segoe UI", "Noto Serif JP", serif',
    background: 'var(--bg-gradient, linear-gradient(135deg, #f5efe0 0%, #e8d9c5 100%))',
    minHeight: '100vh',
    margin: 0,
    padding: '20px',
  },
  titleSmall: {
    fontSize: '32px',
    color: '#4a3f35',
    margin: '0 0 10px',
  },
  roomCode: {
    fontSize: '16px',
    color: '#5d4e37',
    margin: '0 0 10px',
  },
  statusBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '14px',
    color: '#4a3f35',
  },
  score: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#4a3f35',
    margin: '10px 0',
  },
  turnIndicator: {
    fontSize: '20px',
    margin: '5px 0',
    color: '#b8860b',
    fontWeight: 'bold',
  },
  gameLayout: {
    display: 'flex',
    justifyContent: 'center',
    gap: '30px',
    flexWrap: 'wrap',
    marginTop: '20px',
  },
  boardArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: '220px',
    maxWidth: '260px',
  },
  gameOverBlock: {
    background: 'rgba(255,255,240,0.9)',
    borderRadius: '12px',
    padding: '15px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  message: {
    fontWeight: 'bold',
    color: '#2c3e50',
    fontSize: '18px',
    margin: '0 0 10px',
  },
  actionBtn: {
    padding: '10px 20px',
    fontSize: '16px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#d4a373',
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: '0.2s',
    width: '100%',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'white',
    borderRadius: '16px',
    padding: '20px',
    maxWidth: '400px',
    width: '90%',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '20px',
    color: '#4a3f35',
  },
};

export default Game;