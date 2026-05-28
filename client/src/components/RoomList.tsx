import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Room {
  roomId: string;
  players: string;
  status: string;
  nickRed?: string;
  nickBlack?: string;
}

interface RoomListProps {
  onJoin: (roomId: string) => void;
  socket: Socket | null;
  onClose: () => void;
}

const RoomList: React.FC<RoomListProps> = ({ onJoin, socket, onClose }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = () => {
    if (!socket) return;
    setLoading(true);
    socket.emit('list_rooms', (data: Room[]) => {
      setRooms(data || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [socket]);

  const handleJoin = (roomId: string) => {
    onJoin(roomId);
    onClose();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Открытые комнаты</h3>
        <button onClick={fetchRooms} style={styles.refreshBtn}>
          {loading ? 'Обновление…' : '⟳ Обновить'}
        </button>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>
      <div style={styles.list}>
        {rooms.length === 0 ? (
          <p style={styles.empty}>Нет доступных комнат</p>
        ) : (
          rooms.map(room => (
            <div key={room.roomId} style={styles.roomCard}>
              <div style={styles.roomInfo}>
                <span style={styles.roomCode}>{room.roomId}</span>
                <span style={styles.players}>
                  {room.nickRed || '???'} vs {room.nickBlack || '???'} ({room.players})
                </span>
              </div>
              <button onClick={() => handleJoin(room.roomId)} style={styles.joinBtn}>
                Войти
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--modal-bg)',
    borderRadius: '20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
    padding: '20px',
    maxWidth: '420px',
    width: '90%',
    maxHeight: '70vh',
    overflowY: 'auto',
    color: 'var(--text)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 500,
    color: 'var(--text)',
    fontFamily: '"Inter", sans-serif',
  },
  refreshBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '4px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    color: 'var(--text)',
    fontFamily: '"Inter", sans-serif',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: 'var(--secondary-text)',
    marginLeft: '8px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  empty: {
    color: 'var(--secondary-text)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '20px',
  },
  roomCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    borderRadius: '12px',
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
  },
  roomInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  roomCode: {
    fontWeight: 600,
    fontSize: '15px',
    color: 'var(--text)',
    fontFamily: '"Inter", sans-serif',
  },
  players: {
    fontSize: '13px',
    color: 'var(--secondary-text)',
  },
  joinBtn: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: 'none',
    backgroundColor: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: '"Inter", sans-serif',
  },
};

export default RoomList;