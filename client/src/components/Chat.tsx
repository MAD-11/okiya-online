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
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>Чат</div>
      <div style={styles.messageList}>
        {messages.length === 0 && (
          <div style={styles.empty}>Нет сообщений</div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.sender === myNick;
          return (
            <div key={i} style={{ ...styles.row, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              {!isMine && <div style={styles.avatar}>{msg.sender[0]}</div>}
              <div style={{
                ...styles.bubble,
                backgroundColor: isMine ? '#3e362e' : '#f0e8db',
                color: isMine ? '#fff' : '#3e362e',
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
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Сообщение..."
          style={styles.input}
        />
        <button onClick={handleSend} style={styles.sendBtn}>↑</button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '280px',
    width: '100%',
    backgroundColor: '#fdfaf5',
    borderRadius: '20px',
    border: '1px solid #e0d6c8',
    overflow: 'hidden',
    fontFamily: '"Inter", sans-serif',
  },
  header: {
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#5e503a',
    borderBottom: '1px solid #e0d6c8',
    backgroundColor: '#f7f3eb',
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
    color: '#b0a090',
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
    backgroundColor: '#d4c3b3',
    color: '#3e362e',
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
    borderTop: '1px solid #e0d6c8',
    backgroundColor: '#f7f3eb',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '20px',
    border: '1px solid #d4c3b3',
    outline: 'none',
    fontSize: '13px',
    backgroundColor: '#fff',
    fontFamily: 'inherit',
  },
  sendBtn: {
    marginLeft: '8px',
    width: '34px',
    height: '34px',
    borderRadius: '17px',
    border: 'none',
    backgroundColor: '#3e362e',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default Chat;