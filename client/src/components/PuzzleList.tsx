import React from 'react';
import { PuzzleDifficulty } from '../types/game';

interface PuzzleListProps {
  onSelect: (difficulty: PuzzleDifficulty) => void;
  onClose: () => void;
}

const PuzzleList: React.FC<PuzzleListProps> = ({ onSelect, onClose }) => {
  const levels: Array<{ value: PuzzleDifficulty; icon: string; title: string; desc: string; borderColor: string }> = [
    {
      value: 1,
      icon: '🟢',
      title: 'Лёгкий',
      desc: 'Выиграй за 1 ход',
      borderColor: 'rgba(46, 204, 113, 0.5)',
    },
    {
      value: 2,
      icon: '🟡',
      title: 'Средний',
      desc: 'Выиграй за 2 хода',
      borderColor: 'rgba(232, 165, 192, 0.5)',
    },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🎯 Пазлы</h2>
      <p style={styles.subtitle}>Найди выигрышную комбинацию за минимальное число ходов</p>

      <div style={styles.grid}>
        {levels.map(lvl => (
          <button
            key={lvl.value}
            onClick={() => onSelect(lvl.value)}
            className="difficulty-hover"
            style={{ ...styles.card, borderColor: lvl.borderColor }}
          >
            <span style={styles.cardEmoji}>{lvl.icon}</span>
            <span style={styles.cardTitle}>{lvl.title}</span>
            <span style={styles.cardDesc}>{lvl.desc}</span>
          </button>
        ))}
      </div>

      <button onClick={onClose} style={styles.closeBtn}>Закрыть</button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
    background: 'var(--bg)',
    backgroundImage: 'var(--bg-decor-1), var(--bg-decor-2)',
    backgroundAttachment: 'fixed',
    backgroundSize: 'cover',
    zIndex: 2000,
    color: 'var(--text)',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  title: {
    fontSize: '32px',
    fontWeight: 200,
    letterSpacing: '4px',
    marginBottom: '8px',
    background: 'linear-gradient(135deg, #e8a5c0, #7ee8c7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--secondary-text)',
    marginBottom: '36px',
    letterSpacing: '0.5px',
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(160px, 220px))',
    gap: '16px',
    marginBottom: '32px',
  },
  card: {
    padding: '28px 16px',
    borderRadius: '18px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.2s',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  cardEmoji: { fontSize: '36px', lineHeight: 1 },
  cardTitle: { fontSize: '16px', fontWeight: 600, letterSpacing: '0.5px' },
  cardDesc: { fontSize: '12px', color: 'var(--secondary-text)' },
  closeBtn: {
    padding: '11px 28px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
};

export default PuzzleList;