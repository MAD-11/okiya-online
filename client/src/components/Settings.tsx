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

const themeModes: { value: ThemeMode; label: string; icon: string; hint: string }[] = [
  { value: 'auto',  label: 'Авто',    icon: '🌗', hint: 'Следовать системной теме' },
  { value: 'light', label: 'Светлая', icon: '☀️', hint: 'Всегда светлая' },
  { value: 'dark',  label: 'Тёмная',  icon: '🌙', hint: 'Всегда тёмная' },
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
        <div style={styles.modeGroup}>
          {themeModes.map(m => (
            <button
              key={m.value}
              onClick={() => setThemeMode(m.value)}
              title={m.hint}
              style={{
                ...styles.modeBtn,
                backgroundColor: themeMode === m.value ? 'var(--btn-bg)' : 'transparent',
                color: themeMode === m.value ? 'var(--btn-text)' : 'var(--text)',
                borderColor: 'var(--btn-bg)',
              }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.option}>
        <label style={styles.label}>
          <input type="checkbox" checked={soundOn} onChange={toggleSound} /> 🔔 Звуки
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
                backgroundColor: skin === s.value ? 'var(--btn-bg)' : 'transparent',
                color: skin === s.value ? 'var(--btn-text)' : 'var(--text)',
                borderColor: 'var(--btn-bg)',
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
  container: { padding: '24px', background: 'var(--modal-bg)', color: 'var(--text)', fontFamily: '"Inter", sans-serif', borderRadius: '24px' },
  title: { fontSize: '20px', fontWeight: 400, margin: '0 0 20px', color: 'var(--text)', fontFamily: '"Cormorant Garamond", serif' },
  option: { marginBottom: '20px' },
  label: { fontSize: '14px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
  modeGroup: { display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' },
  modeBtn: { padding: '8px 14px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontWeight: 500, fontSize: '13px', transition: 'all 0.2s' },
  skinGroup: { display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' },
  skinBtn: { padding: '8px 16px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontWeight: 500, fontSize: '13px', transition: 'all 0.2s' },
  closeBtn: { display: 'block', margin: '24px auto 0', padding: '10px 24px', borderRadius: '20px', border: 'none', backgroundColor: 'var(--btn-bg)', color: 'var(--btn-text)', fontWeight: 500, cursor: 'pointer' },
};

export default Settings;