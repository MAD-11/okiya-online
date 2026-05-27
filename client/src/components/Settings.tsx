import React from 'react';
import { useTheme, Skin } from '../contexts/ThemeContext';

const skins: { value: Skin; label: string }[] = [
  { value: 'sakura', label: '🌸 Сакура' },
  { value: 'bird', label: '🐦 Птица' },
  { value: 'maple', label: '🍁 Клён' },
];

const Settings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { darkMode, toggleDarkMode, skin, setSkin } = useTheme();

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Настройки</h3>
      <div style={styles.option}>
        <label style={styles.label}>
          <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} /> Тёмная тема
        </label>
      </div>
      <div style={styles.option}>
        <p style={styles.label}>Скин камней</p>
        <div style={styles.skinGroup}>
          {skins.map(s => (
            <button
              key={s.value}
              onClick={() => setSkin(s.value)}
              style={{
                ...styles.skinBtn,
                backgroundColor: skin === s.value ? '#3e362e' : 'transparent',
                color: skin === s.value ? '#fff' : '#3e362e',
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
  container: {
    padding: '24px',
    fontFamily: '"Inter", sans-serif',
  },
  title: {
    fontSize: '20px',
    fontWeight: 400,
    color: '#3e362e',
    margin: '0 0 20px',
    fontFamily: '"Cormorant Garamond", serif',
  },
  option: {
    marginBottom: '20px',
  },
  label: {
    fontSize: '14px',
    color: '#3e362e',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  skinGroup: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  skinBtn: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid #3e362e',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '13px',
    transition: 'all 0.2s',
  },
  closeBtn: {
    display: 'block',
    margin: '24px auto 0',
    padding: '10px 24px',
    borderRadius: '20px',
    border: 'none',
    backgroundColor: '#3e362e',
    color: '#fff',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: '"Inter", sans-serif',
  },
};

export default Settings;