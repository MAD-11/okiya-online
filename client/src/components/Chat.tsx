import React, { useState, useRef, useEffect } from 'react';

interface Message {
  sender: string;
  text: string;
  timestamp: number;
}

interface ChatProps {
  messages: Message[];
  onSend: (text: string) => void;
}

const Chat: React.FC<ChatProps> = ({ messages = [], onSend }) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div style={{
      border: '1px solid #ccc',
      borderRadius: 8,
      padding: 10,
      width: 200,
      maxHeight: 300,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-color, white)',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 8 }}>
        {(messages || []).map((msg, i) => (
          <div key={i} style={{ fontSize: 12, marginBottom: 4, wordBreak: 'break-word' }}>
            <strong>{msg.sender}</strong>: {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={{ flex: 1, padding: 4 }}
          placeholder="Сообщение..."
        />
        <button onClick={handleSend}>Отпр</button>
      </div>
    </div>
  );
};

export default Chat;