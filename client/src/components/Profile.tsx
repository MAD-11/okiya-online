import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface GameResult {
  roomId: string;
  winner: 'host' | 'guest' | 'draw';
  players: { host: string; guest: string };
  timestamp: number;
  maxWins: number;
}

interface Stats {
  games: number;
  wins: number;
  draws: number;
  history: GameResult[];
}

const Profile: React.FC<{ onClose: () => void; socket: Socket | null; playerId: string }> = ({ onClose, socket, playerId }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (socket && playerId) {
      setLoading(true);
      socket.emit('get_profile', playerId, (data: Stats) => {
        setStats(data || { games: 0, wins: 0, draws: 0, history: [] });
        setLoading(false);
      });
    } else {
      setStats({ games: 0, wins: 0, draws: 0, history: [] });
      setLoading(false);
    }
  }, [socket, playerId]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getResultText = (game: GameResult, isHost: boolean) => {
    if (game.winner === 'draw') return { text: 'Ничья', emoji: '🤝', color: 'var(--secondary-text)' };
    const isWin = (game.winner === 'host' && isHost) || (game.winner === 'guest' && !isHost);
    return isWin 
      ? { text: 'Победа', emoji: '🏆', color: '#27ae60' }
      : { text: 'Поражение', emoji: '💔', color: '#c0392b' };
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>📊 Профиль</h3>
      
      {loading ? (
        <p style={{ color: 'var(--secondary-text)', textAlign: 'center' }}>Загрузка...</p>
      ) : stats ? (
        <>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.games}</div>
              <div style={styles.statLabel}>всего игр</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.wins}</div>
              <div style={styles.statLabel}>побед</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.draws}</div>
              <div style={styles.statLabel}>ничьих</div>
            </div>
          </div>

          {stats.history && stats.history.length > 0 ? (
            <div style={styles.historySection}>
              <h4 style={styles.historyTitle}>📜 Последние игры</h4>
              <div style={styles.historyList}>
                {stats.history.slice(0, 15).map((game, idx) => {
                  const isHost = game.players.host === playerId;
                  const result = getResultText(game, isHost);
                  return (
                    <div key={idx} style={styles.historyItem}>
                      <div style={styles.historyLeft}>
                        <span style={styles.historyEmoji}>{result.emoji}</span>
                        <div style={styles.historyInfo}>
                          <span style={{ ...styles.historyResult, color: result.color }}>{result.text}</span>
                          <span style={styles.historyOpponent}>
                            vs {isHost ? game.players.guest.slice(0, 10) : game.players.host.slice(0, 10)}
                          </span>
                        </div>
                      </div>
                      <div style={styles.historyRight}>
                        <span style={styles.historyScore}>
                          {game.winner !== 'draw' ? `${game.maxWins === 1 ? '1' : `до ${Math.ceil(game.maxWins / 2)}`} победа` : ''}
                        </span>
                        <span style={styles.historyDate}>{formatDate(game.timestamp)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p style={styles.noHistory}>Нет сыгранных игр</p>
          )}
        </>
      ) : null}

      <button onClick={onClose} style={styles.closeBtn}>Закрыть</button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    background: 'var(--modal-bg)',
    color: 'var(--text)',
    fontFamily: '"Inter", sans-serif',
    borderRadius: '24px',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  title: {
    fontSize: '24px',
    fontWeight: 500,
    margin: '0 0 20px',
    color: 'var(--text)',
    fontFamily: '"Cormorant Garamond", serif',
    textAlign: 'center',
  },
  statsGrid: {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '24px',
    gap: '16px',
  },
  statCard: {
    textAlign: 'center',
    flex: 1,
    background: 'var(--card-bg)',
    borderRadius: '16px',
    padding: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--secondary-text)',
    marginTop: '4px',
  },
  historySection: {
    marginTop: '20px',
    borderTop: '1px solid var(--border)',
    paddingTop: '16px',
  },
  historyTitle: {
    fontSize: '16px',
    fontWeight: 500,
    marginBottom: '12px',
    color: 'var(--text)',
  },
  historyList: {
    maxHeight: '300px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    fontSize: '13px',
  },
  historyLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  historyEmoji: {
    fontSize: '20px',
  },
  historyInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  historyResult: {
    fontWeight: 600,
  },
  historyOpponent: {
    fontSize: '11px',
    color: 'var(--secondary-text)',
  },
  historyRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '2px',
  },
  historyScore: {
    fontSize: '11px',
    color: 'var(--secondary-text)',
  },
  historyDate: {
    fontSize: '10px',
    color: 'var(--secondary-text)',
  },
  noHistory: {
    textAlign: 'center',
    color: 'var(--secondary-text)',
    padding: '20px',
    fontStyle: 'italic',
  },
  closeBtn: {
    display: 'block',
    margin: '24px auto 0',
    background: 'var(--btn-bg)',
    border: 'none',
    borderRadius: '30px',
    padding: '10px 32px',
    color: 'var(--btn-text)',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s',
  },
};

export default Profile;