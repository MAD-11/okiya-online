import React, { useState } from 'react';
import { useTheme, Skin, ThemeMode } from '../contexts/ThemeContext';
import { getSoundEnabled, setSoundEnabled } from '../utils/sound';

const skins: { value: Skin; label: string }[] = [
  { value: 'sakura', label: '🌸 Сакура' },
  { value: 'bird',   label: '🐦 Птица' },
  { value: 'maple',  label: '🍁 Клён' },
  { value: 'moon',   label: '🌙 Луна' },
  { value: 'bamboo', label: '🎋 Бамбук' },
  { value: 'fox',    label: '🦊 Лиса' },
  { value: 'fuji',   label: '🗻 Фудзи' },
  { value: 'torii',  label: '⛩️ Тории' },
];

const themeModes: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'auto',  label: 'Авто',    icon: '🌗' },
  { value: 'light', label: 'Светлая', icon: '☀️' },
  { value: 'dark',  label: 'Тёмная',  icon: '🌙' },
];

const Settings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { themeMode, setThemeMode, skin, setSkin } = useTheme();
  const [soundOn, setSoundOn] = useState<boolean>(() => getSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Настройки</h3>

      <div style={styles.option}>
        <p style={styles.label}>🎨 Тема</p>
        <div style={styles.group}>
          {themeModes.map(m => (
            <button
              key={m.value}
              onClick={() => setThemeMode(m.value)}
              style={{
                ...styles.chip,
                background: themeMode === m.value ? 'var(--btn-bg)' : 'transparent',
                color: themeMode === m.value ? 'var(--btn-text)' : 'var(--text)',
                borderColor: themeMode === m.value ? 'transparent' : 'var(--border)',
                fontWeight: themeMode === m.value ? 600 : 500,
                boxShadow: themeMode === m.value ? '0 4px 16px rgba(232,165,192,0.3)' : 'none',
              }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.option}>
        <label style={styles.checkLabel}>
          <input type="checkbox" checked={soundOn} onChange={toggleSound} style={styles.checkbox} />
          <span>🔔 Звуки</span>
        </label>
      </div>

      <div style={styles.option}>
        <p style={styles.label}>Скин камней</p>
        <div style={styles.group}>
          {skins.map(s => (
            <button
              key={s.value}
              onClick={() => setSkin(s.value)}
              style={{
                ...styles.chip,
                background: skin === s.value ? 'var(--btn-bg)' : 'transparent',
                color: skin === s.value ? 'var(--btn-text)' : 'var(--text)',
                borderColor: skin === s.value ? 'transparent' : 'var(--border)',
                fontWeight: skin === s.value ? 600 : 500,
                boxShadow: skin === s.value ? '0 4px 16px rgba(232,165,192,0.3)' : 'none',
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
    padding: '28px',
    background: 'var(--modal-bg)',
    color: 'var(--text)',
    fontFamily: '"Inter", sans-serif',
    borderRadius: '24px',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  },
  title: {
    fontSize: '22px', fontWeight: 600,
    margin: '0 0 24px', color: 'var(--text)',
    letterSpacing: '0.5px',
  },
  option: { marginBottom: '24px' },
  label: {
    fontSize: '13px', color: 'var(--secondary-text)',
    marginBottom: '10px',
    fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px',
  },
  checkLabel: {
    fontSize: '14px', color: 'var(--text)',
    display: 'flex', alignItems: 'center', gap: '10px',
    cursor: 'pointer', padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
  },
  checkbox: { width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' },
  group: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  chip: {
    padding: '9px 16px',
    borderRadius: '12px',
    border: '1px solid',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
  },
  closeBtn: {
    display: 'block', margin: '20px auto 0',
    padding: '12px 32px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    fontWeight: 600, fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
  },
};

export default Settings;