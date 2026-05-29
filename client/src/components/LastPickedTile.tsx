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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '12px',
      fontSize: '15px',
      color: 'var(--secondary-text)',
      fontFamily: '"Inter", sans-serif',
      background: 'var(--chat-bubble-other)',
      padding: '6px 16px',
      borderRadius: '20px',
      border: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '22px' }}>{tileEmojiMap[tile.plant]}{tileEmojiMap[tile.symbol]}</span>
      <span style={{ textTransform: 'capitalize' }}>{tile.plant} · {tile.symbol}</span>
    </div>
  );
};

export default LastPickedTile;