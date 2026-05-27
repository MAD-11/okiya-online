import React from 'react';
import { Board as BoardType, ValidMoves } from '../types/game';

interface BoardProps {
  board: BoardType;
  validMoves: ValidMoves;
  onClick: (row: number, col: number) => void;
  currentPlayer: string;
  myColor: string | null;
  lastMove: { row: number; col: number } | null;
  skin: string; // новый пропс
}

const skinEmoji: Record<string, { red: string; black: string }> = {
  sakura: { red: '🌸', black: '⚫' },
  bird: { red: '🐦', black: '⚫' },
  maple: { red: '🍁', black: '⚫' },
};

const Board: React.FC<BoardProps> = ({ board, validMoves, onClick, lastMove, skin }) => {
  const cellSize = 88;
  const fontSize = 32;

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
                onClick={() => isValid && onClick(r, c)}
                style={{
                  ...styles.cell,
                  width: cellSize,
                  height: cellSize,
                  fontSize: fontSize,
                  cursor: isValid ? 'pointer' : 'default',
                  backgroundColor: isPlayerCell
                    ? cell === 'red' ? 'rgba(180,130,110,0.2)' : 'rgba(80,70,60,0.2)'
                    : '#fdfaf5',
                  border: isValid ? '2px solid #c9a96e' : '1px solid #e0d6c8',
                  animation: isLastMove ? 'placeStone 0.3s ease-out' : 'none',
                }}
              >
                {cell && typeof cell !== 'string' && (
                  <span style={styles.tileEmoji}>{getTileEmoji(cell.plant, cell.symbol)}</span>
                )}
                {cell === 'red' && <span style={styles.stone}>{skinEmoji[skin]?.red || '🌸'}</span>}
                {cell === 'black' && <span style={styles.stone}>{skinEmoji[skin]?.black || '⚫'}</span>}
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
  return `${map[plant] || ' '}${map[symbol] || ' '}`;
}

const styles: Record<string, React.CSSProperties> = {
  boardContainer: { display: 'flex', justifyContent: 'center' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 88px)',
    gap: '8px',
    padding: '16px',
    background: '#f7f3eb',
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