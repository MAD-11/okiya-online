import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Stats {
  games: number;
  wins: number;
  draws: number;
}

const Profile: React.FC<{ onClose: () => void; socket: Socket | null; playerId: string }> = ({ onClose, socket, playerId }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    console.log('[Profile] socket:', !!socket, 'playerId:', playerId);
    if (!socket || !playerId) {
      setStats({ games: 0, wins: 0, draws: 0 });
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    const handler = (data: Stats) => {
      console.log('[Profile] received stats:', data);
      clearTimeout(timeoutId);
      setStats(data || { games: 0, wins: 0, draws: 0 });
    };

    console.log('[Profile] emitting get_profile');
    socket.emit('get_profile', playerId, handler);

    timeoutId = setTimeout(() => {
      console.log('[Profile] timeout');
      setError(true);
      setStats({ games: 0, wins: 0, draws: 0 });
    }, 3000);

    return () => clearTimeout(timeoutId);
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
      ) : error ? (
        <p style={{ color: 'red' }}>Не удалось загрузить профиль. Попробуйте позже.</p>
      ) : (
        <p>Загрузка...</p>
      )}
      <button onClick={onClose} style={{ display: 'block', margin: '0 auto', background: '#d4a373', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Закрыть</button>
    </div>
  );
};

export default Profile;