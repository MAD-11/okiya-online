import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { GameState, ValidMoves, Tile } from '../types/game';
import Board from './Board';
import Timer from './Timer';
import LastPickedTile from './LastPickedTile';
import { playMoveSound, playWinSound, playLoseSound, playDrawSound, initAudio, playJoinSound } from '../utils/sound';
import Chat from './Chat';
import Profile from './Profile';
import RoomList from './RoomList';
import Settings from './Settings';
import ConfirmDialog from './ConfirmDialog';
import { useTheme } from '../contexts/ThemeContext';
import RulesModal from './RulesModal';
import TutorialGame from './TutorialGame';

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
  const [isPrivate, setIsPrivate] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [shakeBoard, setShakeBoard] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const joinInputRef = useRef<HTMLInputElement>(null);
  const [showRules, setShowRules] = useState(false);
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const [nick, setNick] = useState(() => getSavedNick() || '');
  const { skin: localSkin } = useTheme();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showTutorial, setShowTutorial] = useState(false);
  // Добавьте useEffect для отслеживания
  useEffect(() => {
    console.log('showTutorial changed:', showTutorial);
  }, [showTutorial]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (showJoinModal && joinInputRef.current) {
      joinInputRef.current.focus();
    }
  }, [showJoinModal]);

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
    setConfirmExitOpen(true);
  };

  const handleConfirmExit = () => {
    setConfirmExitOpen(false);
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
  };

  const copyRoomCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setMessage('Код комнаты скопирован!');
      setTimeout(() => setMessage(''), 2000);
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
    socket?.emit('create_room', { maxWins, playerId, nick: n, skin: localSkin, isPrivate }, (res: any) => {
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
    const id = code || joinCode;
    if (!id) return;
    const n = ensureNick();
    if (!socket) {
      setMessage('Нет соединения с сервером');
      return;
    }
    socket.emit('join_room', { roomId: id, playerId, nick: n, skin: localSkin }, (res: any) => {
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

      // Тряска доски
      setShakeBoard(true);
      setTimeout(() => setShakeBoard(false), 500);

      let text = '';
      if (data.yourResult === 'win') text = '🎉 Вы выиграли!';
      else if (data.yourResult === 'lose') text = 'Поражение. Победил соперник';
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
      playJoinSound();
      if (roomId && socket) {
        socket.emit('clear_chat', roomId);
      }
      setVsAnimation(data);
      setTimeout(() => setVsAnimation(null), 2500);
    });

    socket.on('chat_cleared', () => {
      setGameState(prev => prev ? { ...prev, messages: [] } : null);
    });

    socket.on('opponent_typing', (isTyping: boolean) => {
      setOpponentTyping(isTyping);
    });

    return () => {
      socket.off('game_state');
      socket.off('game_over');
      socket.off('opponent_joined');
      socket.off('chat_cleared');
      socket.off('opponent_typing');
    };
  }, [socket, gameState?.isHost, gameState?.status, gameState?.maxWins, roomId]);

  if (!connected) {
    return (
      <div style={styles.centered}>
        <div className="spinner"></div>
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
          <div style={styles.privateToggle}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                style={styles.hiddenCheckbox}
              />
              <span style={{
                ...styles.customCheckbox,
                backgroundColor: isPrivate ? '#f1c40f' : 'var(--btn-bg)',
                color: isPrivate ? '#000' : 'var(--btn-text)',
                border: isPrivate ? '1px solid #f1c40f' : 'none',
              }}>
                {isPrivate ? '🔒' : '🔓'}
              </span>
              <span style={styles.privateText}>Приватная комната (только по коду)</span>
            </label>
          </div>
          <div style={styles.separator} />
          <button onClick={() => setShowJoinModal(true)} style={styles.secondaryBtn}>
            Войти по коду
          </button>
          <button onClick={() => setShowRoomList(true)} style={{ ...styles.secondaryBtn, marginTop: '12px' }}>
            Открытые комнаты
          </button>
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <button onClick={() => setShowProfile(true)} style={styles.textBtn} title="Просмотр статистики">👤 Профиль</button>
            <button onClick={() => setShowSettings(true)} style={styles.textBtn} title="Настройки игры">⚙️ Настройки</button>
            <button onClick={() => setShowRules(true)} style={styles.textBtn} title="Правила игры">📖 Правила</button>
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
                onJoin={(roomId) => { joinRoom(roomId); setShowRoomList(false); }}
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
        {showJoinModal && (
          <div style={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
            <div style={styles.joinModal} onClick={e => e.stopPropagation()}>
              <h3 style={styles.joinModalTitle}>Введите код комнаты</h3>
              <input
                ref={joinInputRef}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && joinRoom(joinCode)}
                style={styles.joinModalInput}
                placeholder="Например: A1B2"
                maxLength={4}
              />
              <div style={styles.joinModalButtons}>
                <button onClick={() => setShowJoinModal(false)} style={styles.joinModalBtnCancel}>
                  Отмена
                </button>
                <button onClick={() => { joinRoom(joinCode); setShowJoinModal(false); setJoinCode(''); }} style={styles.joinModalBtnConfirm}>
                  Войти
                </button>
              </div>
            </div>
          </div>
        )}
        {showRules && (
          <RulesModal
            onClose={() => setShowRules(false)}
            onStartTutorial={() => {
              console.log('onStartTutorial called');
              setShowRules(false);
              setShowTutorial(true);
            }}
          />
        )}
        <ConfirmDialog
          open={confirmExitOpen}
          title="Выйти из игры?"
          message="Текущая игра будет потеряна. Вы уверены?"
          onConfirm={handleConfirmExit}
          onCancel={() => setConfirmExitOpen(false)}
        />
      </div>
    );
  }

  const isSpectator = !gameState.myColor;
  const canRestart = gameState.roundFinished && !waitingRestart;

  // Мобильная версия
  if (isMobile) {
    return (
      <div style={styles.mobileGameContainer}>
        {reconnecting && <div style={styles.reconnectBanner}>Переподключение...</div>}
        {vsAnimation && (
          <div style={styles.vsOverlayMobile}>
            <div style={styles.vsContentMobile}>
              <span style={{ fontSize: '20px', wordBreak: 'break-word' }}>{vsAnimation.nick1}</span>
              <span style={{ fontSize: '24px', color: '#c9a96e' }}>VS</span>
              <span style={{ fontSize: '20px', wordBreak: 'break-word' }}>{vsAnimation.nick2}</span>
            </div>
          </div>
        )}
        <header style={styles.gameHeader}>
          <h2 style={styles.titleSmall}>Окийя</h2>
          {roomId && (
            <span style={styles.roomCode}>
              Комната <strong>{roomId}</strong>
              {gameState?.isPrivate && <span style={styles.lockIcon}>🔒</span>}
              <button onClick={copyRoomCode} style={styles.copyBtn} title="Скопировать код">📋</button>
            </span>
          )}
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

        <div style={styles.mobileGameLayout}>
          {!isSpectator && (
            <details style={styles.mobileChatCollapsed}>
              <summary style={styles.mobileChatSummary}>💬 Чат</summary>
              <div style={styles.mobileChatContent}>
                <Chat
                  messages={gameState.messages ?? []}
                  onSend={handleChatSend}
                  myNick={gameState.myNick}
                  socket={socket}
                  roomId={roomId}
                  opponentTyping={opponentTyping}
                />
              </div>
            </details>
          )}

          <div style={styles.mobileBoardArea}>
            <div style={styles.mobileBoardScale}>
              <Board
                board={gameState.board}
                validMoves={validMoves}
                onClick={handleCellClick}
                currentPlayer={gameState.currentPlayer}
                myColor={gameState.myColor}
                lastMove={gameState.lastMove}
                hostSkin={gameState.hostSkin || 'sakura'}
                guestSkin={gameState.guestSkin || 'sakura'}
                shake={shakeBoard}
              />
            </div>
            <LastPickedTile tile={gameState.lastPickedTile} />
          </div>

          {gameState.status === 'playing' && !isSpectator && (
            <div style={{ textAlign: 'center' }}>
              <p style={styles.turnIndicator}>
                {gameState.currentPlayer === gameState.myColor ? '☀️ Ваш ход' : '🌙 Ход противника'}
              </p>
              <Timer turnStartedAt={gameState.turnStartedAt} turnDuration={gameState.turnDuration} />
            </div>
          )}

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

          <div style={styles.mobileButtonRow}>
            <button onClick={backToMenu} style={styles.actionBtn}>
              Меню
            </button>
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

        {showSettings && (
          <div style={styles.modalOverlay} onClick={() => setShowSettings(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <Settings onClose={() => setShowSettings(false)} />
            </div>
          </div>
        )}
        <ConfirmDialog
          open={confirmExitOpen}
          title="Выйти из игры?"
          message="Текущая игра будет потеряна. Вы уверены?"
          onConfirm={handleConfirmExit}
          onCancel={() => setConfirmExitOpen(false)}
        />
      </div>
    );
  }

  // ДЕСКТОПНАЯ ВЕРСИЯ (ПОЛНОСТЬЮ РАБОЧАЯ)
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
        {roomId && (
          <span style={styles.roomCode}>
            Комната <strong>{roomId}</strong>
            {gameState?.isPrivate && <span style={styles.lockIcon}>🔒</span>}
            <button onClick={copyRoomCode} style={styles.copyBtn} title="Скопировать код">📋</button>
          </span>
        )}
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

      <div style={styles.gameLayoutDesktop}>
        {!isSpectator && (
          <div style={styles.chatColumn}>
            <Chat
              messages={gameState.messages ?? []}
              onSend={handleChatSend}
              myNick={gameState.myNick}
              socket={socket}
              roomId={roomId}
              opponentTyping={opponentTyping}
            />
          </div>
        )}

        <div style={styles.centerColumnDesktop}>
          <div style={styles.boardArea}>
            <Board
              board={gameState.board}
              validMoves={validMoves}
              onClick={handleCellClick}
              currentPlayer={gameState.currentPlayer}
              myColor={gameState.myColor}
              lastMove={gameState.lastMove}
              hostSkin={gameState.hostSkin || 'sakura'}
              guestSkin={gameState.guestSkin || 'sakura'}
              shake={shakeBoard}
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
            <button onClick={backToMenu} style={styles.actionBtn} title="Выйти в главное меню">
              Выйти в меню
            </button>
            {gameState.status === 'playing' && !isSpectator && (
              <button onClick={handleForfeit} style={{ ...styles.actionBtn, backgroundColor: '#b5651d' }} title="Сдаться">
                Сдаться
              </button>
            )}
            <button onClick={() => setShowSettings(true)} style={{ ...styles.actionBtn, backgroundColor: 'var(--game-btn-bg)' }} title="Настройки">
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
      {showTutorial && (
        <TutorialGame onClose={() => setShowTutorial(false)} />
      )}
      <ConfirmDialog
        open={confirmExitOpen}
        title="Выйти из игры?"
        message="Текущая игра будет потеряна. Вы уверены?"
        onConfirm={handleConfirmExit}
        onCancel={() => setConfirmExitOpen(false)}
      />
    </div>
  );
};

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
    border: 'none',
    borderRadius: '40px',
    backgroundColor: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    width: '100%',
    boxSizing: 'border-box',
    marginTop: '12px',
    transition: 'background-color 0.2s',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  privateToggle: {
    margin: '16px 0 8px',
    textAlign: 'center',
  },
  checkboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    fontFamily: '"Inter", sans-serif',
    fontSize: '14px',
    color: 'var(--text)',
  },
  hiddenCheckbox: {
    display: 'none',
  },
  customCheckbox: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    transition: 'all 0.2s',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },
  privateText: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text)',
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
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  copyBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px',
    color: 'var(--secondary-text)',
    transition: 'transform 0.1s',
  },
  lockIcon: {
    marginLeft: '4px',
    fontSize: '14px',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: '20px',
    padding: '2px 8px',
    color: '#f1c40f',
    fontWeight: 'bold',
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
  gameLayoutDesktop: {
    display: 'grid',
    gridTemplateColumns: '400px auto 400px', // чат | доска | пустая (симметрия)
    alignItems: 'start',
    gap: '20px',
    flex: 1,
    padding: '0 20px 20px',
    overflow: 'hidden',
    width: '100%',
  },
  chatColumn: {
    width: '100%',        // заполняет первую колонку
    height: '70vh',
    marginLeft: '100px',
  },
  centerColumnDesktop: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    gridColumn: '2 / 3',  // явно во второй колонке
    justifySelf: 'center', // центрирование доски внутри своей колонки
  },
  centerColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    justifySelf: 'center', // центрирование доски внутри средней колонки
    gridColumn: '2 / 3',   // явно указываем, что это вторая колонка
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
  boardArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '0 auto',
  },
  modal: {
    background: 'var(--modal-bg)',
    borderRadius: '24px',
    maxWidth: '440px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    overflow: 'hidden',
    padding: '24px',
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
  mobileGameContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  mobileGameLayout: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '12px',
    flex: 1,
    padding: '0 12px 12px',
    overflow: 'auto',
  },
  mobileBoardArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    overflowX: 'auto',
    justifyContent: 'center',
  },
  mobileBoardScale: {
    transform: 'scale(0.85)',
    transformOrigin: 'center center',
  },
  mobileButtonRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: '8px',
    width: '100%',
  },
  mobileChatCollapsed: {
    width: '100%',
    marginBottom: '8px',
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
    gap: '20px',
    fontSize: '32px',
    fontWeight: 700,
    color: '#fff',
    fontFamily: '"Cormorant Garamond", serif',
    textAlign: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: '20px',
  },
  vsText: {
    color: '#c9a96e',
    fontSize: '32px',
  },
  vsOverlayMobile: {
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
    padding: '20px',
  },
  vsContentMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: '#fff',
    fontFamily: '"Cormorant Garamond", serif',
    maxWidth: '90vw',
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

  // В объект styles добавить:
  joinModal: {
    background: 'var(--modal-bg)',
    borderRadius: '24px',
    maxWidth: '360px',
    width: '90%',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  joinModalTitle: {
    margin: '0 0 16px',
    fontSize: '20px',
    fontWeight: 500,
    color: 'var(--text)',
    textAlign: 'center',
  },
  joinModalInput: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--card-bg)',
    color: 'var(--text)',
    marginBottom: '20px',
    boxSizing: 'border-box',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: '2px',
  },
  joinModalButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  joinModalBtnCancel: {
    padding: '10px 20px',
    borderRadius: '30px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '14px',
  },
  joinModalBtnConfirm: {
    padding: '10px 20px',
    borderRadius: '30px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

export default Game;