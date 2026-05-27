import React, { useState, useRef, useEffect } from 'react';

interface Message {
  sender: string;
  text: string;
  timestamp: number;
}

interface ChatProps {
  messages: Message[];
  onSend: (text: string) => void;
  myNick?: string;
}

const Chat: React.FC<ChatProps> = ({ messages = [], onSend, myNick }) => {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed) {
      onSend(trimmed);
      setInput('');
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>💬 Чат</div>
      <div style={styles.messageList}>
        {messages.length === 0 && (
          <div style={styles.empty}>Пока нет сообщений</div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.sender === myNick;
          return (
            <div
              key={i}
              style={{
                ...styles.messageRow,
                justifyContent: isMine ? 'flex-end' : 'flex-start',
              }}
            >
              {!isMine && (
                <div style={styles.avatar}>
                  {msg.sender.charAt(0).toUpperCase()}
                </div>
              )}
              <div
                style={{
                  ...styles.bubble,
                  backgroundColor: isMine ? '#d4a373' : '#f0e6d2',
                  color: isMine ? 'white' : '#4a3f35',
                }}
              >
                <div style={styles.sender}>{msg.sender}</div>
                <div style={styles.text}>{msg.text}</div>
                <div style={styles.time}>{formatTime(msg.timestamp)}</div>
              </div>
              {isMine && (
                <div style={styles.avatar}>
                  {msg.sender.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={styles.inputArea}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Напишите сообщение..."
          style={{
            ...styles.input,
            borderColor: isFocused ? '#d4a373' : '#e0d6c8',
          }}
        />
        <button onClick={handleSend} style={styles.sendBtn}>
          ➤
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '300px',
    width: '100%',
    maxWidth: '300px',
    backgroundColor: '#fffaf3',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    fontFamily: '"Segoe UI", "Noto Serif JP", serif',
  },
  header: {
    padding: '12px 16px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#4a3f35',
    borderBottom: '1px solid #e0d6c8',
    backgroundColor: '#f5efe0',
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
    color: '#b0a090',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '40px',
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '6px',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#d4a373',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '75%',
    padding: '8px 12px',
    borderRadius: '12px',
    borderBottomRightRadius: '4px',
    borderBottomLeftRadius: '4px',
    wordBreak: 'break-word',
  },
  sender: {
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '2px',
    opacity: 0.8,
  },
  text: {
    fontSize: '14px',
    lineHeight: '1.4',
  },
  time: {
    fontSize: '10px',
    textAlign: 'right',
    marginTop: '4px',
    opacity: 0.7,
  },
  inputArea: {
    display: 'flex',
    padding: '8px',
    borderTop: '1px solid #e0d6c8',
    backgroundColor: '#f5efe0',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '20px',
    border: '1px solid #e0d6c8',
    outline: 'none',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  },
  sendBtn: {
    marginLeft: '8px',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#d4a373',
    color: 'white',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
};

export default Chat;