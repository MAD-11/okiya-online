import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const skins = [
  { value: 'sakura', label: '🌸 Сакура' },
  { value: 'bird', label: '🐦 Птица' },
  { value: 'maple', label: '🍁 Клён' },
];

const Settings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { darkMode, toggleDarkMode, skin, setSkin } = useTheme();
  return (
    <div style={{ padding: 20, background: 'var(--bg-color, white)', borderRadius: 8, maxWidth: 300, margin: 'auto' }}>
      <h3>Настройки</h3>
      <label>
        <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} /> Тёмная тема
      </label>
      <div style={{ marginTop: 10 }}>
        <p>Скин камней:</p>
        {skins.map(s => (
          <button
            key={s.value}
            onClick={() => setSkin(s.value as any)}
            style={{
              fontWeight: skin === s.value ? 'bold' : 'normal',
              margin: '0 4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button onClick={onClose} style={{ marginTop: 10 }}>Закрыть</button>
    </div>
  );
};

export default Settings;