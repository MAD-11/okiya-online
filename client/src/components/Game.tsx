import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { GameState, ValidMoves, Tile } from '../types/game';
import Board from './Board';
import Timer from './Timer';
import LastPickedTile from './LastPickedTile';
import { playMoveSound, playWinSound, playLoseSound, playDrawSound } from '../utils/sound';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

const Game: React.FC = () => {
  const { socket, connected } = useSocket(SERVER_URL);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [personalGameOver, setPersonalGameOver] = useState<string | null>(null);
  const [waitingRestart, setWaitingRestart] = useState(false);
  const [waitingReset, setWaitingReset] = useState(false);

  // Очистка сохранённой комнаты (выход в меню)
  const clearSavedRoom = () => {
    localStorage.removeItem('okiya_roomId');
    localStorage.removeItem('okiya_playerToken');
  };

  const backToMenu = () => {
    clearSavedRoom();
    setGameState(null);
    setRoomId(null);
    setMessage('');
    setPersonalGameOver(null);
    setWaitingRestart(false);
    setWaitingReset(false);
  };

  // Попытка переподключения
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
          setRoomId(savedRoomId); // важно: восстановить отображение кода комнаты
          setMessage('');
        }
      });
    }
  }, [socket, connected]);

  const createRoom = (maxWins: number) => {
    socket?.emit('create_room', maxWins, (res: any) => {
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
    socket?.emit('join_room', id, (res: any) => {
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
      // Успешный сброс — состояние обновится через game_state
    });
  };

  // Слушатели сокета
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
        clearSavedRoom(); // серия завершена, токен больше не нужен
      } else if (gameState?.maxWins === 1) {
        // Одиночная игра завершена — тоже очищаем
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
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!connected) {
    return <div style={styles.centered}>Подключение к серверу...</div>;
  }

  if (!gameState) {
    return (
      <div style={styles.lobby}>
        <h1 style={styles.title}>Окийя</h1>
        <p style={styles.subtitle}>Выберите формат игры</p>
        <div style={{ marginTop: 30 }}>
          <button onClick={() => createRoom(1)} style={styles.button}>Одна игра</button>
          <button onClick={() => createRoom(3)} style={styles.button}>До 3 побед</button>
          <button onClick={() => createRoom(5)} style={styles.button}>До 5 побед</button>
        </div>
        <p style={{ marginTop: 30 }}>или</p>
        <button onClick={joinRoom} style={{ ...styles.button, background: '#b08b6c' }}>
          Присоединиться к комнате
        </button>
        {message && <p style={{ color: '#e74c3c', marginTop: 20 }}>{message}</p>}
      </div>
    );
  }

  const isSpectator = !gameState.myColor;
  const canRestart = gameState.roundFinished && !waitingRestart;

  return (
    <div style={styles.gameContainer}>
      <h2 style={styles.titleSmall}>Окийя</h2>
      {roomId && <p style={styles.roomCode}>Код комнаты: <strong>{roomId}</strong></p>}
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
      <Board
        board={gameState.board}
        validMoves={validMoves}
        onClick={handleCellClick}
        currentPlayer={gameState.currentPlayer}
        myColor={gameState.myColor}
        lastMove={gameState.lastMove}
      />
      <LastPickedTile tile={gameState.lastPickedTile} />
      {personalGameOver && (
        <div style={{ marginTop: 15 }}>
          <p style={styles.message}>{personalGameOver}</p>
          {canRestart && (
            <button onClick={handleRestartRound} style={styles.button}>
              Ещё одна игра
            </button>
          )}
          {waitingRestart && <p>Ожидание соперника...</p>}
        </div>
      )}

      {/* Кнопки управления комнатой */}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={backToMenu} style={{ ...styles.button, background: '#e74c3c' }}>
          Выйти в главное меню
        </button>
        <button onClick={handleResetRoom} style={{ ...styles.button, background: '#2ecc71' }}>
          {waitingReset ? 'Ожидание соперника...' : 'Новая игра в этой же комнате'}
        </button>
      </div>

      {!gameState.roundFinished && gameState.status === 'finished' && !gameState.seriesWinner && (
        <div style={{ marginTop: 20 }}>
          <p>Ожидание новой игры...</p>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  lobby: {
    textAlign: 'center',
    marginTop: 80,
    fontFamily: '"Segoe UI", "Noto Serif JP", serif',
  },
  centered: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 24,
  },
  title: {
    fontSize: 48,
    margin: 0,
    color: '#4a3f35',
    textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
  },
  subtitle: {
    fontSize: 18,
    color: '#7f6e5d',
    marginBottom: 20,
  },
  titleSmall: {
    fontSize: 32,
    color: '#4a3f35',
    margin: '10px 0 0',
  },
  roomCode: {
    fontSize: 16,
    color: '#5d4e37',
    margin: '5px 0',
  },
  score: {
    fontSize: 20,
    color: '#4a3f35',
    fontWeight: 'bold',
    margin: '10px 0',
  },
  turnIndicator: {
    fontSize: 20,
    margin: '10px 0 5px',
    color: '#b8860b',
    fontWeight: 'bold',
  },
  message: {
    fontWeight: 'bold',
    color: '#2c3e50',
    fontSize: 20,
    margin: '10px 0',
  },
  button: {
    margin: '4px',
    padding: '10px 24px',
    fontSize: 16,
    background: '#d4a373',
    border: 'none',
    borderRadius: '30px',
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: '0.2s',
    whiteSpace: 'nowrap',
  },
  gameContainer: {
    textAlign: 'center',
    fontFamily: '"Segoe UI", "Noto Serif JP", serif',
    background: 'linear-gradient(135deg, #f5efe0 0%, #e8d9c5 100%)',
    minHeight: '100vh',
    margin: 0,
    paddingTop: 10,
    paddingBottom: 20,
  },
};

export default Game;