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

  useEffect(() => {
    if (socket && playerId) {
      socket.emit('get_profile', playerId, (data: Stats) => setStats(data || { games: 0, wins: 0, draws: 0, history: [] }));
    } else {
      setStats({ games: 0, wins: 0, draws: 0, history: [] });
    }
  }, [socket, playerId]);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Профиль</h3>
      {stats ? (
        <>
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
          {/* FIX: отображение истории */}
          {stats.history && stats.history.length > 0 && (
            <div style={styles.historySection}>
              <h4 style={styles.historyTitle}>Последние игры</h4>
              <div style={styles.historyList}>
                {stats.history.slice(0, 10).map((game, idx) => (
                  <div key={idx} style={styles.historyItem}>
                    <span>
                      {new Date(game.timestamp).toLocaleDateString()} – 
                      {game.winner === 'draw' ? ' Ничья' : 
                        game.winner === 'host' ? ' Победа' : ' Поражение'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p style={{ color: 'var(--secondary-text)' }}>Загрузка...</p>
      )}
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
  },
  title: {
    fontSize: '20px',
    fontWeight: 400,
    margin: '0 0 20px',
    color: 'var(--text)',
    fontFamily: '"Cormorant Garamond", serif',
  },
  statsGrid: {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '24px',
  },
  statCard: {
    textAlign: 'center',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--secondary-text)',
  },
  historySection: {
    marginTop: '16px',
    borderTop: '1px solid var(--border)',
    paddingTop: '16px',
  },
  historyTitle: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '8px',
    color: 'var(--text)',
  },
  historyList: {
    maxHeight: '200px',
    overflowY: 'auto',
  },
  historyItem: {
    fontSize: '12px',
    padding: '6px 0',
    borderBottom: '1px solid var(--border)',
    color: 'var(--secondary-text)',
  },
  closeBtn: {
    display: 'block',
    margin: '24px auto 0',
    background: 'var(--btn-bg)',
    border: 'none',
    borderRadius: '20px',
    padding: '10px 24px',
    color: 'var(--btn-text)',
    fontWeight: 500,
    cursor: 'pointer',
  },
};

export default Profile;