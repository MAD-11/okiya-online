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
  readOnly?: boolean;   // ← новый проп
}

const MAX_MESSAGE_LENGTH = 200;

const Chat: React.FC<ChatProps> = ({
  messages = [],
  onSend,
  myNick,
  socket,
  roomId,
  opponentTyping = false,
  readOnly = false,
}) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!readOnly) inputRef.current?.focus();
  }, [readOnly]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
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
    }, 2000) as unknown as number;
  };

  const handleSend = () => {
    if (readOnly) return;
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

  const formatTime = (t: number) =>
    new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        ЧАТ
        {readOnly && <span style={styles.readOnlyHeader}>👁 только просмотр</span>}
      </div>

      <div style={styles.messageList}>
        {messages.length === 0 && <div style={styles.empty}>Нет сообщений</div>}
        {messages.map((msg, i) => {
          const isMine = msg.sender === myNick;
          return (
            <div key={i} style={{ ...styles.row, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              {!isMine && <div style={styles.avatar}>{msg.sender[0]}</div>}
              <div
                style={{
                  ...styles.bubble,
                  backgroundColor: isMine ? 'var(--chat-bubble-mine)' : 'var(--chat-bubble-other)',
                  color: isMine ? 'var(--chat-text-mine)' : 'var(--chat-text-other)',
                  borderTopRightRadius: isMine ? '4px' : '14px',
                  borderTopLeftRadius: isMine ? '14px' : '4px',
                }}
              >
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

      {!readOnly ? (
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
      ) : (
        <div style={styles.readOnlyFooter}>Вы смотрите как зритель</div>
      )}

      {opponentTyping && !readOnly && (
        <div style={styles.typingIndicator}>Соперник печатает...</div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    background: 'var(--card-bg)',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    fontFamily: '"Inter", sans-serif',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
  },
  header: {
    padding: '14px 20px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--secondary-text)',
    borderBottom: '1px solid var(--border)',
    letterSpacing: '2px',
    background: 'rgba(255,255,255,0.02)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  readOnlyHeader: {
    fontSize: '9px',
    color: 'var(--accent)',
    letterSpacing: '0.5px',
    fontWeight: 500,
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  empty: {
    color: 'var(--secondary-text)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '50px',
    fontSize: '13px',
  },
  row: { display: 'flex', alignItems: 'flex-end', gap: '8px' },
  avatar: {
    width: '26px',
    height: '26px',
    borderRadius: '13px',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%',
    padding: '10px 14px',
    borderRadius: '14px',
    wordBreak: 'break-word',
    border: '1px solid var(--border)',
  },
  sender: { fontSize: '11px', fontWeight: 600, marginBottom: '3px', opacity: 0.75 },
  text: { fontSize: '13px', lineHeight: 1.45 },
  time: { fontSize: '10px', textAlign: 'right', marginTop: '4px', opacity: 0.55 },
  inputArea: {
    display: 'flex',
    padding: '10px',
    borderTop: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    outline: 'none',
    fontSize: '13px',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    fontFamily: 'inherit',
  },
  sendBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(232,165,192,0.3)',
    flexShrink: 0,
  },
  readOnlyFooter: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
    fontSize: '11px',
    color: 'var(--secondary-text)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  typingIndicator: {
    fontSize: '11px',
    padding: '4px 16px 10px',
    color: 'var(--accent)',
    fontStyle: 'italic',
  },
};

export default Chat;