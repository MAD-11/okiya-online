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
      socket.emit('get_profile', playerId, (data: Stats) => {
        setStats(data || { games: 0, wins: 0, draws: 0 });
      });
    } else {
      setStats({ games: 0, wins: 0, draws: 0 });
    }
  }, [socket, playerId]);

  return (
    <div>
      <h3 style={{ margin: '0 0 15px', color: '#4a3f35' }}>Ваш профиль</h3>
      {stats ? (
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 20 }}>
          <div style={{ textAlign: 'center' }}><strong>{stats.games}</strong><br />игр</div>
          <div style={{ textAlign: 'center' }}><strong>{stats.wins}</strong><br />побед</div>
          <div style={{ textAlign: 'center' }}><strong>{stats.draws}</strong><br />ничьих</div>
        </div>
      ) : (
        <p>Загрузка...</p>
      )}
      <button onClick={onClose} style={{ display: 'block', margin: '0 auto', background: '#d4a373', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Закрыть</button>
    </div>
  );
};

export default Profile;