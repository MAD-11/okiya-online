import React, { useEffect, useState } from 'react';

interface PlayerIntroProps {
  nick: string;
  onFinish: () => void;
}

const PlayerIntro: React.FC<PlayerIntroProps> = ({ nick, onFinish }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onFinish();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  if (!visible) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.textContainer}>
        <h1 style={styles.title}>⚔️ Противник найден!</h1>
        <p style={styles.nick}>{nick}</p>
      </div>
      <div style={styles.particles} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    animation: 'fadeIn 0.3s ease-out',
  },
  textContainer: {
    textAlign: 'center',
    animation: 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  title: {
    color: '#f1c40f',
    fontSize: 'clamp(24px, 8vw, 48px)',
    fontWeight: 700,
    textShadow: '0 0 20px rgba(241,196,15,0.5)',
    margin: '0 0 20px',
    fontFamily: '"Cormorant Garamond", serif',
    letterSpacing: '4px',
  },
  nick: {
    color: '#fff',
    fontSize: 'clamp(32px, 10vw, 64px)',
    fontWeight: 900,
    textShadow: '0 0 30px rgba(255,255,255,0.5)',
    margin: 0,
    fontFamily: '"Inter", sans-serif',
    textTransform: 'uppercase',
  },
  particles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at 30% 50%, rgba(241,196,15,0.1) 0%, transparent 50%)',
  },
};

export default PlayerIntro;