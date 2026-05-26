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
    <div>
      <h3 style={{ margin: '0 0 15px', color: '#4a3f35' }}>Настройки</h3>
      <div style={styles.option}>
        <label style={styles.label}>
          <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
          <span> Тёмная тема</span>
        </label>
      </div>
      <div style={styles.option}>
        <p style={{ margin: '0 0 5px', fontWeight: 600, color: '#4a3f35' }}>Скин камней:</p>
        <div style={styles.skinGroup}>
          {skins.map(s => (
            <button
              key={s.value}
              onClick={() => setSkin(s.value as any)}
              style={{
                ...styles.skinBtn,
                background: skin === s.value ? '#d4a373' : 'transparent',
                color: skin === s.value ? 'white' : '#4a3f35',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={onClose} style={styles.closeBtn}>Закрыть</button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  option: {
    marginBottom: '20px',
  },
  label: {
    cursor: 'pointer',
    fontSize: '16px',
    color: '#4a3f35',
  },
  skinGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  skinBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #d4a373',
    cursor: 'pointer',
    fontWeight: 600,
    transition: '0.2s',
  },
  closeBtn: {
    display: 'block',
    margin: '0 auto',
    background: '#d4a373',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
};

export default Settings;