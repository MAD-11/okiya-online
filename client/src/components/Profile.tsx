import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Stats {
  games: number;
  wins: number;
  draws: number;
}

const Profile: React.FC<{ onClose: () => void; socket: Socket | null }> = ({ onClose, socket }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const playerId = localStorage.getItem('okiya_playerToken') || '';

  useEffect(() => {
    if (socket && playerId) {
      socket.emit('get_profile', playerId, (data: Stats) => {
        setStats(data);
      });
    }
  }, [socket, playerId]);

  return (
    <div>
      <h3 style={{ margin: '0 0 15px', color: '#4a3f35' }}>Ваш профиль</h3>
      {stats ? (
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
      ) : (
        <p>Загрузка...</p>
      )}
      <button onClick={onClose} style={styles.closeBtn}>Закрыть</button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  statsGrid: {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '20px',
  },
  statCard: {
    background: '#f5efe0',
    borderRadius: '12px',
    padding: '15px',
    textAlign: 'center',
    minWidth: '80px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#4a3f35',
  },
  statLabel: {
    fontSize: '14px',
    color: '#7f6e5d',
  },
  closeBtn: {
    display: 'block',
    margin: '0 auto',
    background: '#d4a373',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default Profile;