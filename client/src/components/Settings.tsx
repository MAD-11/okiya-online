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

interface SettingsProps {
  onClose: () => void;
  onRestartOnboarding?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose, onRestartOnboarding }) => {
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
                boxShadow: themeMode === m.value ? '0 4px 16px rgba(232,165,192,0.3)' : 'none',
              }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      <label style={{
        ...styles.cardLabel,
        borderColor: soundOn ? 'rgba(232,165,192,0.6)' : 'var(--border)',
        background: soundOn ? 'rgba(232,165,192,0.08)' : 'rgba(255,255,255,0.03)',
      }}>
        <input type="checkbox" checked={soundOn} onChange={toggleSound} style={styles.hiddenCheckbox} />
        <span style={styles.cardIcon}>{soundOn ? '🔔' : '🔕'}</span>
        <div style={styles.cardText}>
          <span style={styles.cardTitle}>Звуки</span>
          <span style={styles.cardHint}>Ходы, победа, подключение соперника</span>
        </div>
        <span style={{
          ...styles.toggleDot,
          background: soundOn ? 'var(--accent)' : 'transparent',
          borderColor: soundOn ? 'var(--accent)' : 'var(--border)',
        }}>
          {soundOn && <span style={styles.toggleDotInner} />}
        </span>
      </label>

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
                boxShadow: skin === s.value ? '0 4px 16px rgba(232,165,192,0.3)' : 'none',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {onRestartOnboarding && (
        <div style={styles.option}>
          <button
            onClick={() => {
              localStorage.removeItem('okiya_onboarded');
              onRestartOnboarding();
            }}
            style={styles.onboardingResetBtn}
          >
            🎓 Показать онбординг снова
          </button>
        </div>
      )}
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
  hiddenCheckbox: { display: 'none' },
  cardLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    marginBottom: '20px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  cardIcon: {
    fontSize: '22px',
    lineHeight: 1,
  },
  cardText: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    flex: 1,
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  cardHint: {
    fontSize: '11px',
    color: 'var(--secondary-text)',
    letterSpacing: '0.3px',
  },
  toggleDot: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  toggleDotInner: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#fff',
    display: 'block',
  },
  label: {
    fontSize: '13px', color: 'var(--secondary-text)',
    marginBottom: '10px',
    fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px',
  },
  group: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  chip: {
    padding: '9px 16px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,          // ← всегда 600, не меняется
    transition: 'all 0.2s',
    minWidth: '92px',         // ← фиксированная минимальная ширина
    textAlign: 'center',
    boxSizing: 'border-box',
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
  onboardingResetBtn: {
    width: '100%',
    padding: '11px 16px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: '"Inter", sans-serif',
    transition: 'all 0.2s',
  },
};

export default Settings;