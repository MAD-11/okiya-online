import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Room {
  roomId: string;
  players: string;
  status: string;
  nickRed?: string;
  nickBlack?: string;
  isActive?: boolean;
  canSpectate?: boolean;
}

interface RoomListProps {
  onJoin: (roomId: string) => void;
  onSpectate: (roomId: string) => void;
  socket: Socket | null;
  onClose: () => void;
}

const RoomList: React.FC<RoomListProps> = ({ onJoin, onSpectate, socket, onClose }) => {
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
  const handleSpectate = (roomId: string) => { onSpectate(roomId); onClose(); };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Открытые комнаты</h3>
        <div style={styles.headerActions}>
          <button onClick={fetchRooms} style={styles.refreshBtn} title="Обновить">
            {loading ? '…' : '⟳'}
          </button>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
      </div>

      <div style={styles.list}>
        {rooms.length === 0 ? (
          <p style={styles.empty}>Нет доступных комнат</p>
        ) : (
          rooms.map(room => {
            const showSpectate = room.canSpectate === true;
            const showJoin = !showSpectate && room.players !== '2/2';
            return (
              <div key={room.roomId} style={styles.roomCard}>
                <div style={styles.roomInfo}>
                  <div style={styles.roomTop}>
                    <span style={styles.roomCode}>{room.roomId}</span>
                    {room.isActive && <span style={styles.activeBadge}>🟢 В игре</span>}
                  </div>
                  <span style={styles.players}>
                    {room.nickRed || '???'} vs {room.nickBlack || '???'} ({room.players})
                  </span>
                </div>

                {showSpectate && (
                  <button onClick={() => handleSpectate(room.roomId)} style={styles.spectateBtn} title="Смотреть игру">
                    👁 Смотреть
                  </button>
                )}
                {showJoin && (
                  <button onClick={() => handleJoin(room.roomId)} style={styles.joinBtn}>
                    Войти
                  </button>
                )}
                {!showSpectate && !showJoin && (
                  <span style={styles.fullLabel}>Полная</span>
                )}
              </div>
            );
          })
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
    maxWidth: '460px',
    width: '90%',
    maxHeight: '70vh',
    overflowY: 'auto',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '18px',
  },
  title: { margin: 0, fontSize: '20px', fontWeight: 600 },
  headerActions: { display: 'flex', gap: '8px', alignItems: 'center' },
  refreshBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '6px 12px',
    fontSize: '14px',
    cursor: 'pointer',
    color: 'var(--text)',
    transition: 'all 0.2s',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: 'var(--secondary-text)',
    padding: '4px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
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
    padding: '14px 16px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    transition: 'all 0.2s',
    gap: '12px',
  },
  roomInfo: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 },
  roomTop: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  roomCode: {
    fontWeight: 700,
    fontSize: '15px',
    letterSpacing: '1px',
  },
  activeBadge: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#2ecc71',
    background: 'rgba(46,204,113,0.12)',
    border: '1px solid rgba(46,204,113,0.4)',
    borderRadius: '8px',
    padding: '2px 6px',
    letterSpacing: '0.3px',
  },
  players: { fontSize: '12px', color: 'var(--secondary-text)' },
  joinBtn: {
    padding: '8px 18px',
    borderRadius: '10px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(232,165,192,0.25)',
    flexShrink: 0,
  },
  spectateBtn: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(232,165,192,0.5)',
    background: 'rgba(232,165,192,0.12)',
    color: 'var(--accent)',
    fontWeight: 600,
    fontSize: '12px',
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  fullLabel: {
    fontSize: '11px',
    color: 'var(--secondary-text)',
    fontStyle: 'italic',
    flexShrink: 0,
    padding: '8px 12px',
  },
};

export default RoomList;