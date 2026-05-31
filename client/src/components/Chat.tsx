import React, { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface Message {
  sender: string;
  text: string;
  timestamp: number;
}

interface ChatProps {
  messages: Message[];
  onSend: (text: string) => void;
  myNick?: string;
  socket?: Socket | null;
  roomId?: string | null;
  opponentTyping?: boolean;
}

const MAX_MESSAGE_LENGTH = 200;

const Chat: React.FC<ChatProps> = ({ messages = [], onSend, myNick, socket, roomId, opponentTyping = false }) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number>(); // fixed: NodeJS.Timeout -> number
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    if (!isTyping && value.trim()) {
      setIsTyping(true);
      socket?.emit('typing', roomId, true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        socket?.emit('typing', roomId, false);
      }
    }, 2000);
  };

  const handleSend = () => {
    const trimmed = input.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (trimmed) {
      onSend(trimmed);
      setInput('');
      if (isTyping) {
        setIsTyping(false);
        socket?.emit('typing', roomId, false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>Чат</div>
      <div style={styles.messageList}>
        {messages.length === 0 && <div style={styles.empty}>Нет сообщений</div>}
        {messages.map((msg, i) => {
          const isMine = msg.sender === myNick;
          return (
            <div key={i} style={{ ...styles.row, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              {!isMine && <div style={styles.avatar}>{msg.sender[0]}</div>}
              <div style={{
                ...styles.bubble,
                backgroundColor: isMine ? 'var(--chat-bubble-mine)' : 'var(--chat-bubble-other)',
                color: isMine ? 'var(--chat-text-mine)' : 'var(--chat-text-other)',
              }}>
                <div style={styles.sender}>{msg.sender}</div>
                <div style={styles.text}>{msg.text}</div>
                <div style={styles.time}>{formatTime(msg.timestamp)}</div>
              </div>
              {isMine && <div style={styles.avatar}>{msg.sender[0]}</div>}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={styles.inputArea}>
        <input
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Сообщение..."
          maxLength={MAX_MESSAGE_LENGTH}
          style={styles.input}
        />
        <button onClick={handleSend} style={styles.sendBtn}>↑</button>
      </div>
      {opponentTyping && <div style={styles.typingIndicator}>Соперник печатает...</div>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    backgroundColor: 'var(--chat-bg)',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    fontFamily: '"Inter", sans-serif',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  header: {
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--secondary-text)',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  empty: {
    color: 'var(--secondary-text)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '50px',
    fontSize: '13px',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '6px',
  },
  avatar: {
    width: '24px',
    height: '24px',
    borderRadius: '12px',
    backgroundColor: 'var(--btn-bg)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 600,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '80%',
    padding: '8px 12px',
    borderRadius: '12px',
    borderBottomRightRadius: '2px',
    borderBottomLeftRadius: '2px',
    wordBreak: 'break-word',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sender: {
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '2px',
    opacity: 0.8,
  },
  text: {
    fontSize: '13px',
    lineHeight: '1.4',
  },
  time: {
    fontSize: '10px',
    textAlign: 'right',
    marginTop: '4px',
    opacity: 0.6,
  },
  inputArea: {
    display: 'flex',
    padding: '8px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    outline: 'none',
    fontSize: '13px',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text)',
    fontFamily: 'inherit',
  },
  sendBtn: {
    marginLeft: '8px',
    width: '34px',
    height: '34px',
    borderRadius: '17px',
    border: 'none',
    backgroundColor: 'var(--btn-bg)',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingIndicator: {
    fontSize: '11px',
    padding: '4px 12px 8px',
    color: 'var(--secondary-text)',
    fontStyle: 'italic',
  },
};

export default Chat;