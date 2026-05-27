import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Stats {
  games: number;
  wins: number;
  draws: number;
}

const Profile: React.FC<{ onClose: () => void; socket: Socket | null; playerId: string }> = ({ onClose, socket, playerId }) => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (socket && playerId) {
      socket.emit('get_profile', playerId, (data: Stats) => setStats(data || { games: 0, wins: 0, draws: 0 }));
    } else {
      setStats({ games: 0, wins: 0, draws: 0 });
    }
  }, [socket, playerId]);

  return (
    <div style={{ fontFamily: '"Inter", sans-serif' }}>
      <h3 style={{ fontSize: '20px', margin: '0 0 20px', color: '#3e362e', fontWeight: 400 }}>Профиль</h3>
      {stats ? (
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#3e362e' }}>{stats.games}</div>
            <div style={{ fontSize: '12px', color: '#8b7a6b' }}>игр</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#3e362e' }}>{stats.wins}</div>
            <div style={{ fontSize: '12px', color: '#8b7a6b' }}>побед</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#3e362e' }}>{stats.draws}</div>
            <div style={{ fontSize: '12px', color: '#8b7a6b' }}>ничьих</div>
          </div>
        </div>
      ) : (
        <p style={{ color: '#8b7a6b' }}>Загрузка...</p>
      )}
      <button onClick={onClose} style={{
        display: 'block',
        margin: '0 auto',
        background: '#3e362e',
        border: 'none',
        borderRadius: '20px',
        padding: '10px 24px',
        color: '#fff',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: '"Inter", sans-serif',
      }}>Закрыть</button>
    </div>
  );
};

export default Profile;