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
import BotGame from './BotGame';
import PuzzleGame from './PuzzleGame';
import PuzzleList from './PuzzleList';
import { PuzzleDifficulty } from '../types/game';

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
  const { socket, connected, isOnline } = useSocket(SERVER_URL);
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
  const [showBotGame, setShowBotGame] = useState(false);
  const [showPuzzles, setShowPuzzles] = useState(false);
  const [puzzleDifficulty, setPuzzleDifficulty] = useState<PuzzleDifficulty | null>(null);
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  useEffect(() => {
    console.log('showTutorial changed:', showTutorial);
  }, [showTutorial]);

  useEffect(() => {
    if (gameState && gameState.status === 'playing' && gameState.myColor) {
      document.title = gameState.currentPlayer === gameState.myColor
        ? '☀️ Ваш ход — Окийя'
        : '🌙 Ход соперника — Окийя';
    } else {
      document.title = 'Окийя — онлайн';
    }
    return () => { document.title = 'Окийя — онлайн'; };
  }, [gameState?.currentPlayer, gameState?.myColor, gameState?.status]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl && roomFromUrl.length === 4) {
      setJoinCode(roomFromUrl.toUpperCase());
      setShowJoinModal(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
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
      const url = `${window.location.origin}?room=${roomId}`;
      navigator.clipboard.writeText(url);
      setMessage('Ссылка на комнату скопирована!');
      setTimeout(() => setMessage(''), 2000);
    }
  };

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

  let content = null;

  if (!isOnline) {
    content = (
      <div style={styles.centered}>
        <span style={{ fontSize: '64px', marginBottom: '20px' }}>🌙</span>
        <h2 style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '4px', marginBottom: '12px' }}>
          НЕТ СЕТИ
        </h2>
        <p style={{ color: 'var(--secondary-text)', fontSize: '14px', maxWidth: '340px', textAlign: 'center' }}>
          Проверьте подключение к интернету. Мы переподключимся автоматически.
        </p>
      </div>
    );
  } else if (!connected) {
    content = (
      <div style={styles.centered}>
        <div className="spinner"></div>
        <p>Подключение к серверу...</p>
      </div>
    );
  } else if (!gameState) {
    content = (
      <div style={styles.lobbyContainer}>
        <div style={styles.lobbyCard}>
          <h1 style={styles.title}>Окийя</h1>
          <p style={styles.subtitle}>изящная дуэльная игра</p>
          {nick && (
            <p style={styles.playerName}>
              Вы: <strong style={styles.playerNameStrong}>{nick}</strong>
            </p>
          )}
          <div style={styles.buttonGroup}>
            <button onClick={() => createRoom(1)} style={styles.primaryBtn}>Одна игра</button>
            <button onClick={() => createRoom(3)} style={styles.primaryBtn}>До 3 побед</button>
            <button onClick={() => createRoom(5)} style={styles.primaryBtn}>До 5 побед</button>
          </div>
          <div style={{ marginTop: '10px', marginBottom: '18px' }}>
            <button
              onClick={() => setShowPuzzles(true)}
              style={{ ...styles.secondaryBtn, marginTop: 0 }}
              title="Тренировка: реши позицию за N ходов"
            >
              🎯 Пазлы
            </button>
          </div>
          <div style={styles.difficultySelector}>
            <p style={styles.difficultyLabel}>🤖 Игра с ботом</p>
            <div style={styles.difficultyGrid}>
              <button
                onClick={() => { setBotDifficulty('easy'); setShowBotGame(true); }}
                className="difficulty-hover"
                style={{ ...styles.difficultyCard, borderColor: 'rgba(46, 204, 113, 0.5)' }}
                title="Случайные ходы, для новичков"
              >
                <span style={styles.difficultyEmoji}>🟢</span>
                <span style={styles.difficultyName}>Лёгкий</span>
              </button>
              <button
                onClick={() => { setBotDifficulty('medium'); setShowBotGame(true); }}
                className="difficulty-hover"
                style={{ ...styles.difficultyCard, borderColor: 'rgba(232, 165, 192, 0.5)' }}
                title="Эвристика, средний уровень"
              >
                <span style={styles.difficultyEmoji}>🟡</span>
                <span style={styles.difficultyName}>Средний</span>
              </button>
              <button
                onClick={() => { setBotDifficulty('hard'); setShowBotGame(true); }}
                className="difficulty-hover"
                style={{ ...styles.difficultyCard, borderColor: 'rgba(231, 76, 60, 0.5)' }}
                title="Минимакс, для опытных"
              >
                <span style={styles.difficultyEmoji}>🔴</span>
                <span style={styles.difficultyName}>Сложный</span>
              </button>
            </div>
          </div>
          <label style={{
            ...styles.privateCard,
            borderColor: isPrivate ? 'rgba(232,165,192,0.6)' : 'var(--border)',
            background: isPrivate ? 'rgba(232,165,192,0.08)' : 'rgba(255,255,255,0.03)',
          }}>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={styles.hiddenCheckbox}
            />
            <span style={styles.privateCardIcon}>{isPrivate ? '🔒' : '🔓'}</span>
            <div style={styles.privateCardText}>
              <span style={styles.privateCardTitle}>Приватная комната</span>
              <span style={styles.privateCardHint}>Только по коду — не видна в списке</span>
            </div>
            <span style={{
              ...styles.privateToggleDot,
              background: isPrivate ? 'var(--accent)' : 'transparent',
              borderColor: isPrivate ? 'var(--accent)' : 'var(--border)',
            }}>
              {isPrivate && <span style={styles.privateToggleDotInner} />}
            </span>
          </label>
          <div style={styles.separator} />
          <button onClick={() => setShowJoinModal(true)} style={styles.secondaryBtn}>Войти по коду</button>
          <button onClick={() => setShowRoomList(true)} style={{ ...styles.secondaryBtn, marginTop: '12px' }}>Открытые комнаты</button>
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <button onClick={() => setShowProfile(true)} className="link-btn" style={styles.textBtn} title="Просмотр статистики">👤 Профиль</button>
            <button onClick={() => setShowSettings(true)} className="link-btn" style={styles.textBtn} title="Настройки игры">⚙️ Настройки</button>
            <button onClick={() => setShowRules(true)} className="link-btn" style={styles.textBtn} title="Правила игры">📖 Правила</button>
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
                <button onClick={() => setShowJoinModal(false)} style={styles.joinModalBtnCancel}>Отмена</button>
                <button onClick={() => { joinRoom(joinCode); setShowJoinModal(false); setJoinCode(''); }} style={styles.joinModalBtnConfirm}>Войти</button>
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
  } else {
    const isSpectator = !gameState.myColor;
    const canRestart = gameState.roundFinished && !waitingRestart;

    if (isMobile) {
      content = (
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
              <div style={styles.roomBadge}>
                <strong style={styles.roomBadgeCode}>{roomId}</strong>
                {gameState?.isPrivate && <span style={styles.lockIcon}>🔒</span>}
                <button onClick={copyRoomCode} style={styles.copyBtn} title="Скопировать ссылку">📋</button>
              </div>
            )}
          </header>
          <div style={styles.statusBar}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
              backgroundColor: gameState.opponentConnected ? 'var(--opponent-online)' : 'var(--opponent-offline)'
            }} />
            <span style={{ marginLeft: 6, fontSize: 13 }}>{gameState.opponentConnected ? 'Соперник в сети' : 'Соперник не в сети'}</span>
            <span style={{ marginLeft: 16, fontSize: 13 }}>
              {gameState.myNick} vs {gameState.myColor === 'red' ? gameState.nickBlack : gameState.nickRed}
            </span>
          </div>
          {gameState.maxWins > 1 && <div style={styles.score}>Счёт: {gameState.myScore} — {gameState.opponentScore}</div>}
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
                <p style={styles.turnIndicator}>{gameState.currentPlayer === gameState.myColor ? '☀️ Ваш ход' : '🌙 Ход противника'}</p>
                <Timer turnStartedAt={gameState.turnStartedAt} turnDuration={gameState.turnDuration} />
              </div>
            )}
            {personalGameOver && (
              <div style={styles.gameOverBlock}>
                <p style={styles.message}>{personalGameOver}</p>
                {canRestart && <button onClick={handleRestartRound} style={styles.actionBtn}>Ещё одна игра</button>}
                {waitingRestart && <p style={{ fontSize: 13, color: 'var(--secondary-text)' }}>Ожидание соперника…</p>}
              </div>
            )}
            <div style={styles.mobileButtonRow}>
              <button onClick={backToMenu} style={styles.actionBtn}>Меню</button>
              {gameState.status === 'playing' && !isSpectator && (
                <button onClick={handleForfeit} style={{ ...styles.actionBtn, backgroundColor: '#b5651d' }}>Сдаться</button>
              )}
              <button onClick={() => setShowSettings(true)} style={{ ...styles.actionBtn, backgroundColor: 'var(--game-btn-bg)' }}>Настройки</button>
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
    } else {
      content = (
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
              <div style={styles.roomBadge}>
                <span style={styles.roomBadgeLabel}>Комната</span>
                <strong style={styles.roomBadgeCode}>{roomId}</strong>
                {gameState?.isPrivate && <span style={styles.lockIcon}>🔒</span>}
                <button onClick={copyRoomCode} style={styles.copyBtn} title="Скопировать ссылку">📋</button>
              </div>
            )}
          </header>
          <div style={styles.statusBar}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
              backgroundColor: gameState.opponentConnected ? 'var(--opponent-online)' : 'var(--opponent-offline)'
            }} />
            <span style={{ marginLeft: 6, fontSize: 13 }}>{gameState.opponentConnected ? 'Соперник в сети' : 'Соперник не в сети'}</span>
            <span style={{ marginLeft: 16, fontSize: 13 }}>
              {gameState.myNick} vs {gameState.myColor === 'red' ? gameState.nickBlack : gameState.nickRed}
            </span>
          </div>
          {gameState.maxWins > 1 && <div style={styles.score}>Счёт: {gameState.myScore} — {gameState.opponentScore}</div>}
          {gameState.status === 'playing' && !isSpectator && (
            <div style={{ marginBottom: 4, textAlign: 'center' }}>
              <p style={styles.turnIndicator}>{gameState.currentPlayer === gameState.myColor ? '☀️ Ваш ход' : '🌙 Ход противника'}</p>
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
                  {canRestart && <button onClick={handleRestartRound} style={styles.actionBtn}>Ещё одна игра</button>}
                  {waitingRestart && <p style={{ fontSize: 13, color: 'var(--secondary-text)' }}>Ожидание соперника…</p>}
                </div>
              )}
              <div style={styles.buttonRow}>
                <button onClick={backToMenu} style={styles.actionBtn} title="Выйти в главное меню">Выйти в меню</button>
                {gameState.status === 'playing' && !isSpectator && (
                  <button onClick={handleForfeit} style={{ ...styles.actionBtn, backgroundColor: '#b5651d' }} title="Сдаться">Сдаться</button>
                )}
                <button onClick={() => setShowSettings(true)} style={{ ...styles.actionBtn, backgroundColor: 'var(--game-btn-bg)' }} title="Настройки">Настройки</button>
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
  }

  return (
    <>
      {!isOnline && (
        <div style={styles.offlineBanner}>
          <span style={{ fontSize: '16px', marginRight: '8px' }}>📡</span>
          Нет подключения — игра приостановлена
        </div>
      )}
      {content}
      {showTutorial && <TutorialGame onClose={() => setShowTutorial(false)} />}
      {showBotGame && <BotGame difficulty={botDifficulty} onClose={() => setShowBotGame(false)} />}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  lobbyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: '"Inter", sans-serif',
  },
  lobbyCard: {
    background: 'var(--card-bg)',
    borderRadius: '28px',
    border: '1px solid var(--border)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    padding: '48px 40px',
    maxWidth: '460px',
    width: '100%',
    textAlign: 'center',
  },
  title: {
    fontSize: '56px',
    margin: '0 0 8px',
    fontWeight: 200,
    letterSpacing: '6px',
    background: 'linear-gradient(135deg, #e8a5c0, #7ee8c7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--secondary-text)',
    marginBottom: '36px',
    letterSpacing: '4px',
    textTransform: 'uppercase',
    fontWeight: 400,
  },
  playerName: {
    color: 'var(--secondary-text)',
    marginBottom: '28px',
    fontSize: '14px',
    letterSpacing: '0.5px',
  },
  playerNameStrong: {
    color: 'var(--text)',
    fontSize: '18px',
    fontWeight: 600,
    marginLeft: '4px',
    letterSpacing: '0.3px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  difficultySelector: {
    marginBottom: '18px',
  },
  difficultyLabel: {
    fontSize: '11px',
    color: 'var(--secondary-text)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    marginBottom: '10px',
    fontWeight: 600,
    textAlign: 'center',
  },
  difficultyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
  },
  difficultyCard: {
    padding: '16px 8px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    fontFamily: '"Inter", sans-serif',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  difficultyEmoji: {
    fontSize: '24px',
    lineHeight: 1,
  },
  difficultyName: {
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  primaryBtn: {
    padding: '16px 26px',
    fontSize: '15px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '14px',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    fontFamily: '"Inter", sans-serif',
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
    minWidth: '130px',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  secondaryBtn: {
    padding: '14px 28px',
    fontSize: '14px',
    fontWeight: 500,
    border: '1px solid var(--border)',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontFamily: '"Inter", sans-serif',
    width: '100%',
    boxSizing: 'border-box',
    marginTop: '10px',
    transition: 'all 0.2s',
  },
  privateCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    margin: '16px 0 10px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  privateCardIcon: {
    fontSize: '22px',
    lineHeight: 1,
  },
  privateCardText: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    flex: 1,
  },
  privateCardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  privateCardHint: {
    fontSize: '11px',
    color: 'var(--secondary-text)',
    letterSpacing: '0.3px',
  },
  privateToggleDot: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  privateToggleDotInner: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#fff',
    display: 'block',
  },
  hiddenCheckbox: { display: 'none' },
  separator: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, var(--border), transparent)',
    margin: '22px 0',
    width: '70%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  textBtn: {
    background: 'none',
    border: 'none',
    fontSize: '13px',
    color: 'var(--secondary-text)',
    cursor: 'pointer',
    fontFamily: '"Inter", sans-serif',
    transition: 'color 0.2s',
    padding: '6px 10px',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '16px',
    color: 'var(--text)',
    fontFamily: '"Inter", sans-serif',
  },
  gameContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    color: 'var(--text)',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  gameHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    marginBottom: '6px',
  },
  titleSmall: {
    fontSize: '28px',
    fontWeight: 200,
    margin: 0,
    letterSpacing: '4px',
    background: 'linear-gradient(135deg, #e8a5c0, #7ee8c7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  roomBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  roomBadgeLabel: {
    fontSize: '11px',
    color: 'var(--secondary-text)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  roomBadgeCode: {
    fontSize: '16px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: 'var(--accent)',
  },
  copyBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '0 4px',
    color: 'var(--secondary-text)',
    transition: 'transform 0.15s, color 0.15s',
  },
  lockIcon: {
    marginLeft: '4px',
    fontSize: '13px',
    backgroundColor: 'rgba(232,165,192,0.15)',
    borderRadius: '20px',
    padding: '2px 8px',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  statusBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '12px',
    color: 'var(--secondary-text)',
    gap: '4px',
  },
  score: {
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '4px',
    textAlign: 'center',
    color: 'var(--text)',
    letterSpacing: '1px',
  },
  turnIndicator: {
    fontSize: '14px',
    margin: '0 0 6px',
    fontWeight: 600,
    color: 'var(--turn-indicator)',
    textShadow: '0 0 12px rgba(232,165,192,0.5)',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  gameLayoutDesktop: {
    display: 'grid',
    gridTemplateColumns: 'minmax(340px, 1fr) minmax(auto, 560px) minmax(340px, 1fr)',
    alignItems: 'start',
    gap: '0',
    flex: 1,
    padding: '0 24px 24px',
    overflow: 'hidden',
    width: '100%',
  },
  chatColumn: {
    width: '100%',
    maxWidth: '360px',
    height: '70vh',
    justifySelf: 'end',
    marginRight: '24px',
  },
  centerColumnDesktop: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    gridColumn: '2 / 3',
    justifySelf: 'center',
  },
  centerColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    justifySelf: 'center',
    gridColumn: '2 / 3',
  },
  gameOverBlock: {
    background: 'var(--card-bg)',
    borderRadius: '16px',
    padding: '16px 20px',
    border: '1px solid var(--border)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    textAlign: 'center',
    color: 'var(--text)',
  },
  message: {
    fontWeight: 600,
    color: 'var(--text)',
    fontSize: '15px',
    margin: '0 0 12px',
  },
  buttonRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionBtn: {
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    //border: 'none',
    borderRadius: '12px',
    background: 'var(--game-btn-bg)',
    color: 'var(--game-btn-text)',
    cursor: 'pointer',
    border: '1px solid var(--border)',
    transition: 'all 0.2s',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px',
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
    maxWidth: '480px',
    width: '90%',
    border: '1px solid var(--border)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    padding: '24px',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  },
  mobileChatToggle: {
    width: '100%',
    marginBottom: '12px',
    background: 'var(--card-bg)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  mobileChatSummary: {
    padding: '12px 16px',
    cursor: 'pointer',
    fontWeight: 600,
    color: 'var(--text)',
    userSelect: 'none',
    listStyle: 'none',
    fontSize: '13px',
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
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
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
    color: 'var(--text)',
    textAlign: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: '20px',
  },
  vsText: {
    background: 'var(--btn-bg)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontSize: '32px',
  },
  vsOverlayMobile: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
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
    color: 'var(--text)',
    maxWidth: '90vw',
  },
  reconnectBanner: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    background: 'var(--timer-low)',
    color: '#fff',
    textAlign: 'center',
    padding: '10px',
    zIndex: 2000,
    fontWeight: 600,
    fontSize: '13px',
    letterSpacing: '1px',
  },
  joinModal: {
    background: 'var(--modal-bg)',
    borderRadius: '24px',
    maxWidth: '380px',
    width: '90%',
    padding: '28px',
    border: '1px solid var(--border)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  },
  joinModalTitle: {
    margin: '0 0 20px',
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text)',
    textAlign: 'center',
  },
  joinModalInput: {
    width: '100%',
    padding: '14px',
    fontSize: '20px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    marginBottom: '20px',
    boxSizing: 'border-box',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: '6px',
    fontWeight: 600,
    outline: 'none',
    fontFamily: '"Inter", sans-serif',
  },
  joinModalButtons: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
  },
  joinModalBtnCancel: {
    padding: '12px 24px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    flex: 1,
  },
  joinModalBtnConfirm: {
    padding: '12px 24px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
    flex: 1,
  },
  offlineBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    padding: '10px 16px',
    background: 'linear-gradient(90deg, rgba(231,76,60,0.9), rgba(232,165,192,0.9))',
    color: '#fff',
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '1px',
    zIndex: 5000,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
};

export default Game;