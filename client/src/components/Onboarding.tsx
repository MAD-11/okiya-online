import React, { useState } from 'react';

interface OnboardingProps {
  onFinish: () => void;
}

const SLIDES = [
  {
    emoji: '🌸',
    title: 'Добро пожаловать в Окийю',
    text: 'Изящная дуэльная игра в японском стиле. Два игрока, шестнадцать карточек императорского сада, одна цель — завоевать расположение императора.',
    accent: '#e8a5c0',
  },
  {
    emoji: '🏆',
    title: 'Ваша цель',
    text: 'Выложить 4 своих камня в ряд (горизонталь, вертикаль, диагональ) или квадрат 2×2. Или заблокировать все ходы сопернику.',
    accent: '#7ee8c7',
  },
  {
    emoji: '🎯',
    title: 'С чего начать?',
    text: '🎯 Пазлы — потренируйтесь на готовых позициях\n🤖 Бот — сыграйте против ИИ\n👥 Друг — создайте комнату и позовите по коду',
    accent: '#d4a373',
  },
];

const Onboarding: React.FC<OnboardingProps> = ({ onFinish }) => {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const isFirst = step === 0;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('okiya_onboarded', 'true');
      onFinish();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    localStorage.setItem('okiya_onboarded', 'true');
    onFinish();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <button onClick={handleSkip} className="flat-btn" style={styles.skipBtn} title="Пропустить">
          Пропустить
        </button>

        <div style={styles.emojiWrap}>
          <span style={styles.emoji}>{slide.emoji}</span>
          <div style={{
            ...styles.emojiGlow,
            background: `radial-gradient(circle, ${slide.accent}40 0%, transparent 70%)`,
          }} />
        </div>

        <h2 style={styles.title}>{slide.title}</h2>

        <div style={styles.textArea}>
          <p style={styles.text}>{slide.text}</p>
        </div>

        <div style={styles.dots}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.dot,
                background: i === step ? slide.accent : 'var(--border)',
                width: i === step ? '24px' : '8px',
              }}
            />
          ))}
        </div>

        <div style={styles.buttons}>
          {!isFirst && (
            <button onClick={handleBack} style={styles.secondaryBtn}>
              ← Назад
            </button>
          )}
          <button onClick={handleNext} style={styles.primaryBtn}>
            {isLast ? 'Начать 🎮' : 'Далее →'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'var(--bg)',
    backgroundImage: 'var(--bg-decor-1), var(--bg-decor-2)',
    backgroundAttachment: 'fixed',
    backgroundSize: 'cover',
    zIndex: 5000,
  },
  card: {
    background: 'var(--card-bg)',
    borderRadius: '28px',
    border: '1px solid var(--border)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    padding: '48px 36px 32px',
    maxWidth: '480px',
    width: '100%',
    height: 'min(560px, 88vh)',
    textAlign: 'center',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  skipBtn: {
    position: 'absolute',
    top: '16px',
    right: '20px',
    background: 'none',
    border: 'none',
    fontSize: '12px',
    color: 'var(--secondary-text)',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    padding: '4px 8px',
  },
  emojiWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '110px',
    flexShrink: 0,
  },
  emoji: {
    fontSize: '72px',
    lineHeight: 1,
    position: 'relative',
    zIndex: 1,
    animation: 'onboardingFloat 3s ease-in-out infinite',
  },
  emojiGlow: {
    position: 'absolute',
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    filter: 'blur(20px)',
    zIndex: 0,
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    margin: 0,
    color: 'var(--text)',
    letterSpacing: '0.3px',
    minHeight: '32px',
    flexShrink: 0,
  },
  textArea: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflowY: 'auto',
    padding: '0 4px',
  },
  text: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: 'var(--secondary-text)',
    margin: 0,
    whiteSpace: 'pre-line',
  },
  dots: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    alignItems: 'center',
    height: '16px',
    flexShrink: 0,
  },
  dot: {
    height: '8px',
    borderRadius: '4px',
    transition: 'all 0.3s ease',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    alignItems: 'stretch',
    minHeight: '48px',
    flexShrink: 0,
  },
  primaryBtn: {
    flex: 1,
    padding: '14px 24px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '14px',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
    transition: 'all 0.2s',
    fontFamily: '"Inter", sans-serif',
  },
  secondaryBtn: {
    padding: '14px 20px',
    fontSize: '14px',
    fontWeight: 500,
    border: '1px solid var(--border)',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontFamily: '"Inter", sans-serif',
    transition: 'all 0.2s',
  },
};

export default Onboarding;