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
  rating: number;
  history: GameResult[];
}

const Profile: React.FC<{ onClose: () => void; socket: Socket | null; playerId: string }> = ({ onClose, socket, playerId }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (socket && playerId) {
      setLoading(true);
      socket.emit('get_profile', playerId, (data: Stats) => {
        setStats(data || { games: 0, wins: 0, draws: 0, rating: 1000, history: [] });
        setLoading(false);
      });
    } else {
      setStats({ games: 0, wins: 0, draws: 0, rating: 1000, history: [] });
      setLoading(false);
    }
  }, [socket, playerId]);

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const getResult = (g: GameResult, isHost: boolean) => {
    if (g.winner === 'draw') return { text: 'Ничья', emoji: '🤝', color: 'var(--secondary-text)' };
    const isWin = (g.winner === 'host' && isHost) || (g.winner === 'guest' && !isHost);
    return isWin
      ? { text: 'Победа', emoji: '🏆', color: 'var(--accent-2)' }
      : { text: 'Поражение', emoji: '💔', color: 'var(--timer-low)' };
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>📊 Профиль</h3>

      {loading ? (
        <p style={styles.loading}>Загрузка...</p>
      ) : stats ? (
        <>
          <div style={styles.ratingBadge}>
            <span style={styles.ratingLabel}>Рейтинг ELO</span>
            <span style={styles.ratingValue}>{stats.rating}</span>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.games}</div>
              <div style={styles.statLabel}>игр</div>
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
                  const r = getResult(game, isHost);
                  return (
                    <div key={idx} style={styles.historyItem}>
                      <div style={styles.historyLeft}>
                        <span style={styles.historyEmoji}>{r.emoji}</span>
                        <div style={styles.historyInfo}>
                          <span style={{ ...styles.historyResult, color: r.color }}>{r.text}</span>
                          <span style={styles.historyOpponent}>
                            vs {isHost ? game.players.guest.slice(0, 10) : game.players.host.slice(0, 10)}
                          </span>
                        </div>
                      </div>
                      <span style={styles.historyDate}>{formatDate(game.timestamp)}</span>
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
    padding: '28px',
    background: 'var(--modal-bg)',
    color: 'var(--text)',
    fontFamily: '"Inter", sans-serif',
    borderRadius: '24px',
    maxHeight: '80vh', overflowY: 'auto',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  },
  title: { fontSize: '22px', fontWeight: 600, margin: '0 0 20px', textAlign: 'center', letterSpacing: '0.5px' },
  loading: { textAlign: 'center', color: 'var(--secondary-text)', padding: '20px' },
  ratingBadge: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px',
    marginBottom: '20px',
    background: 'var(--card-bg)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
  },
  ratingLabel: { fontSize: '13px', color: 'var(--secondary-text)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' },
  ratingValue: {
    fontSize: '30px', fontWeight: 700,
    background: 'var(--btn-bg)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  statsGrid: { display: 'flex', gap: '12px', marginBottom: '20px' },
  statCard: {
    flex: 1, textAlign: 'center',
    padding: '14px',
    background: 'var(--card-bg)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
  },
  statValue: { fontSize: '26px', fontWeight: 700 },
  statLabel: { fontSize: '11px', color: 'var(--secondary-text)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px' },
  historySection: { marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' },
  historyTitle: { fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--secondary-text)', textTransform: 'uppercase', letterSpacing: '1px' },
  historyList: { maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' },
  historyItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px',
    borderRadius: '12px',
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    fontSize: '13px',
  },
  historyLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  historyEmoji: { fontSize: '18px' },
  historyInfo: { display: 'flex', flexDirection: 'column' },
  historyResult: { fontWeight: 600 },
  historyOpponent: { fontSize: '11px', color: 'var(--secondary-text)' },
  historyDate: { fontSize: '11px', color: 'var(--secondary-text)' },
  noHistory: { textAlign: 'center', color: 'var(--secondary-text)', padding: '20px', fontStyle: 'italic' },
  closeBtn: {
    display: 'block', margin: '20px auto 0',
    padding: '12px 32px', borderRadius: '12px', border: 'none',
    background: 'var(--btn-bg)', color: 'var(--btn-text)',
    fontWeight: 600, cursor: 'pointer', fontSize: '14px',
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
  },
};

export default Profile;