import React from 'react';
import { Tile } from '../types/game';

interface LastPickedTileProps {
  tile: Tile | null;
}

const tileEmojiMap: Record<string, string> = {
  sakura: '🌸', iris: '🌺', pine: '🌲', maple: '🍁',
  sun: '☀️', bird: '🐦', rain: '🌧️', tanzaku: '📜',
};

const LastPickedTile: React.FC<LastPickedTileProps> = ({ tile }) => {
  if (!tile) return null;
  return (
    <div style={styles.wrap}>
      <span style={styles.emoji}>{tileEmojiMap[tile.plant]}{tileEmojiMap[tile.symbol]}</span>
      <span style={styles.text}>{tile.plant} · {tile.symbol}</span>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    padding: '8px 16px',
    fontSize: '14px',
    color: 'var(--secondary-text)',
    background: 'var(--card-bg)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  },
  emoji: { fontSize: '22px' },
  text: { textTransform: 'capitalize', letterSpacing: '0.5px' },
};

export default LastPickedTile;