import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Room {
  roomId: string;
  players: string;
  nickRed?: string;
  nickBlack?: string;
  status: string;
}

interface RoomListProps {
  onJoin: (roomId: string) => void;
  socket: Socket | null;
}

const RoomList: React.FC<RoomListProps> = ({ onJoin, socket }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, [socket]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Открытые комнаты</h3>
        <button onClick={fetchRooms} style={styles.refreshBtn}>
          {loading ? 'Обновление...' : '⟳ Обновить'}
        </button>
      </div>
      {rooms.length === 0 ? (
        <p style={styles.empty}>Нет доступных комнат</p>
      ) : (
        <ul style={styles.list}>
          {rooms.map(room => (
            <li key={room.roomId} style={styles.item}>
              <div style={styles.itemInfo}>
                <span style={styles.roomCode}>{room.roomId}</span>
                <span style={styles.players}>
                  {room.nickRed || '???'} vs {room.nickBlack || '???'} ({room.players})
                </span>
              </div>
              <button onClick={() => onJoin(room.roomId)} style={styles.joinBtn}>Войти</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '20px',
    textAlign: 'left',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: '12px',
    padding: '15px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    color: '#4a3f35',
  },
  refreshBtn: {
    background: 'none',
    border: '1px solid #d4a373',
    borderRadius: '8px',
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#4a3f35',
  },
  empty: {
    color: '#7f6e5d',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #e0d6c8',
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  roomCode: {
    fontWeight: 600,
    color: '#4a3f35',
    fontSize: '16px',
  },
  players: {
    fontSize: '14px',
    color: '#7f6e5d',
  },
  joinBtn: {
    backgroundColor: '#d4a373',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 14px',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default RoomList;