import React, { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

interface RoomListProps {
  onJoin: (roomId: string) => void;
}

const RoomList: React.FC<RoomListProps> = ({ onJoin }) => {
  const { socket } = useSocket(import.meta.env.VITE_SERVER_URL);
  const [rooms, setRooms] = useState<any[]>([]);

  const fetchRooms = () => {
    if (socket) {
      socket.emit('list_rooms', (data: any[]) => setRooms(data));
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [socket]);

  return (
    <div style={{ marginTop: 20 }}>
      <h3>Публичные комнаты <button onClick={fetchRooms}>Обновить</button></h3>
      {rooms.length === 0 ? (
        <p>Нет доступных комнат</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {rooms.map(room => (
            <li key={room.roomId} style={{ marginBottom: 8 }}>
              {room.roomId} ({room.players}) {room.nickRed || '...'} vs {room.nickBlack || '...'}{' '}
              <button onClick={() => onJoin(room.roomId)}>Войти</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RoomList;