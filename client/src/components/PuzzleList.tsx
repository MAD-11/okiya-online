import React from 'react';
import { PuzzleDifficulty } from '../types/game';

interface PuzzleListProps {
  onSelect: (difficulty: PuzzleDifficulty) => void;
  onClose: () => void;
}

const PuzzleList: React.FC<PuzzleListProps> = ({ onSelect, onClose }) => {
  const levels: Array<{
    value: PuzzleDifficulty;
    icon: string;
    title: string;
    desc: string;
    borderColor: string;
  }> = [
    {
      value: 1,
      icon: '🟢',
      title: 'Выиграй за 1 ход',
      desc: 'Найди победную клетку',
      borderColor: 'rgba(46, 204, 113, 0.5)',
    },
    {
      value: 2,
      icon: '🔴',
      title: 'Заблокируй соперника',
      desc: 'Не дай чёрным выиграть',
      borderColor: 'rgba(231, 76, 60, 0.5)',
    },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🎯 Пазлы</h2>
      <p style={styles.subtitle}>Тренируй тактику на реальных позициях</p>

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
    gridTemplateColumns: 'repeat(2, minmax(180px, 240px))',
    gap: '16px',
    marginBottom: '32px',
  },
  card: {
    padding: '32px 20px',
    borderRadius: '18px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    transition: 'all 0.2s',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  cardEmoji: { fontSize: '40px', lineHeight: 1 },
  cardTitle: { fontSize: '15px', fontWeight: 600, letterSpacing: '0.3px', textAlign: 'center' },
  cardDesc: { fontSize: '12px', color: 'var(--secondary-text)', textAlign: 'center' },
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