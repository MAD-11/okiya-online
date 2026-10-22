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

  const handleJoin = (roomId: string) => { onJoin(roomId); onClose(); };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Открытые комнаты</h3>
        <div style={styles.headerActions}>
          <button onClick={fetchRooms} style={styles.refreshBtn}>
            {loading ? '…' : '⟳'}
          </button>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
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
    borderRadius: '24px',
    padding: '24px',
    maxWidth: '440px', width: '90%',
    maxHeight: '70vh', overflowY: 'auto',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '18px',
  },
  title: { margin: 0, fontSize: '20px', fontWeight: 600 },
  headerActions: { display: 'flex', gap: '8px', alignItems: 'center' },
  refreshBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '6px 12px',
    fontSize: '14px', cursor: 'pointer',
    color: 'var(--text)',
    transition: 'all 0.2s',
  },
  closeBtn: {
    background: 'none', border: 'none',
    fontSize: '18px', cursor: 'pointer',
    color: 'var(--secondary-text)', padding: '4px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  empty: { color: 'var(--secondary-text)', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' },
  roomCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    transition: 'all 0.2s',
  },
  roomInfo: { display: 'flex', flexDirection: 'column', gap: '4px' },
  roomCode: { fontWeight: 700, fontSize: '15px', letterSpacing: '1px' },
  players: { fontSize: '12px', color: 'var(--secondary-text)' },
  joinBtn: {
    padding: '8px 18px',
    borderRadius: '10px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    fontWeight: 600, fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(232,165,192,0.25)',
  },
};

export default RoomList;