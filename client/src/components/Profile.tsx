import React, { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

interface Stats {
  games: number;
  wins: number;
  draws: number;
  history: any[];
}

const Profile: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { socket } = useSocket(import.meta.env.VITE_SERVER_URL);
  const [stats, setStats] = useState<Stats | null>(null);
  const playerId = localStorage.getItem('okiya_playerToken') || '';

  useEffect(() => {
    if (socket && playerId) {
      socket.emit('get_profile', playerId, (data: Stats) => setStats(data));
    }
  }, [socket, playerId]);

  return (
    <div style={{ padding: 20, background: 'var(--bg-color, white)', borderRadius: 8, maxWidth: 300, margin: 'auto' }}>
      <h3>Ваш профиль</h3>
      {stats ? (
        <div>
          <p>Игр: {stats.games}</p>
          <p>Побед: {stats.wins}</p>
          <p>Ничьих: {stats.draws}</p>
        </div>
      ) : <p>Загрузка...</p>}
      <button onClick={onClose} style={{ marginTop: 10 }}>Закрыть</button>
    </div>
  );
};

export default Profile;