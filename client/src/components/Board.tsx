import React from 'react';
import { Board as BoardType, ValidMoves } from '../types/game';
import { initAudio } from '../utils/sound';

interface BoardProps {
  board: BoardType;
  validMoves: ValidMoves;
  onClick: (row: number, col: number) => void;
  currentPlayer: string;
  myColor: string | null;
  lastMove: { row: number; col: number } | null;
  hostSkin: string;   // скин для красных фигур (всегда хост)
  guestSkin: string;  // скин для чёрных фигур (всегда гость)
}

const skinEmoji: Record<string, { red: string; black: string }> = {
  sakura: { red: '🌸', black: '🌺' },
  bird: { red: '🐦', black: '🐦‍⬛' },
  maple: { red: '🍁', black: '🍂' },
  moon: { red: '🌙', black: '🌑' },
};

const Board: React.FC<BoardProps> = ({ board, validMoves, onClick, lastMove, hostSkin, guestSkin }) => {
  const cellSize = 88;
  const fontSize = 32;

  const handleCellClick = (row: number, col: number) => {
    if (validMoves[row]?.[col]) {
      initAudio();
      onClick(row, col);
    }
  };

  const getStoneEmoji = (color: 'red' | 'black') => {
    if (color === 'red') {
      return skinEmoji[hostSkin]?.red || skinEmoji.sakura.red;
    } else {
      return skinEmoji[guestSkin]?.black || skinEmoji.sakura.black;
    }
  };

  return (
    <div style={styles.boardContainer}>
      <div style={styles.grid}>
        {board.map((row, r) =>
          row.map((cell, c) => {
            const isValid = validMoves[r]?.[c];
            const isPlayerCell = cell === 'red' || cell === 'black';
            const isLastMove = lastMove?.row === r && lastMove?.col === c;
            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                style={{
                  ...styles.cell,
                  width: cellSize,
                  height: cellSize,
                  fontSize: fontSize,
                  cursor: isValid ? 'pointer' : 'default',
                  backgroundColor: isPlayerCell
                    ? cell === 'red' ? 'var(--stone-red-bg)' : 'var(--stone-black-bg)'
                    : 'var(--cell-bg)',
                  border: isValid ? '2px solid var(--valid-move-border)' : '1px solid var(--border)',
                  animation: isLastMove ? 'placeStone 0.3s ease-out' : 'none',
                }}
              >
                {cell && typeof cell !== 'string' && (
                  <span style={styles.tileEmoji}>{getTileEmoji(cell.plant, cell.symbol)}</span>
                )}
                {cell === 'red' && <span style={styles.stone}>{getStoneEmoji('red')}</span>}
                {cell === 'black' && <span style={styles.stone}>{getStoneEmoji('black')}</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

function getTileEmoji(plant: string, symbol: string): string {
  const map: Record<string, string> = {
    sakura: '🌸', iris: '🌺', pine: '🌲', maple: '🍁',
    sun: '☀️', bird: '🐦', rain: '🌧️', tanzaku: '📜',
  };
  return `${map[plant] || '❓'}${map[symbol] || '❓'}`;
}

const styles: Record<string, React.CSSProperties> = {
  boardContainer: { display: 'flex', justifyContent: 'center' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 88px)',
    gap: '8px',
    padding: '16px',
    backgroundColor: 'var(--bg)',
    borderRadius: '16px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
  },
  cell: {
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  tileEmoji: { filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' },
  stone: { fontSize: '34px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' },
};

export default Board;