import React from 'react';
import { Tile } from '../types/game';

interface LastPickedTileProps {
  tile: Tile | null;
}

const tileEmojiMap: Record<string, string> = {
  sakura: '🌸',
  iris: '🌺',
  pine: '🌲',
  maple: '🍁',
  sun: '☀️',
  bird: '🐦',
  rain: '🌧️',
  tanzaku: '📜',
};

const LastPickedTile: React.FC<LastPickedTileProps> = ({ tile }) => {
  if (!tile) return null;
  return (
    <div style={styles.container}>
      <span style={styles.emoji}>
        {tileEmojiMap[tile.plant]}{tileEmojiMap[tile.symbol]}
      </span>
      <span style={styles.label}>
        {tile.plant} {tile.symbol}
      </span>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    margin: '10px auto',
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.6)',
    borderRadius: '12px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    width: 'fit-content',
    fontFamily: '"Segoe UI", "Noto Serif JP", serif',
  },
  emoji: {
    fontSize: '28px',
  },
  label: {
    fontSize: '18px',
    color: '#4a3f35',
    textTransform: 'capitalize',
  },
};

export default LastPickedTile;