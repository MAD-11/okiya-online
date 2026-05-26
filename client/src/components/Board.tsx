import React from 'react';
import { Board as BoardType, ValidMoves } from '../types/game';

interface BoardProps {
  board: BoardType;
  validMoves: ValidMoves;
  onClick: (row: number, col: number) => void;
  currentPlayer: string;
  myColor: string | null;
  lastMove: { row: number; col: number } | null;
}

const Board: React.FC<BoardProps> = ({ board, validMoves, onClick, currentPlayer, myColor, lastMove }) => {
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
                  ...(isValid ? styles.validMove : {}),
                  ...(isPlayerCell ? styles.occupied : {}),
                  backgroundColor: isPlayerCell
                    ? cell === 'red'
                      ? 'rgba(231, 76, 60, 0.25)'
                      : 'rgba(44, 62, 80, 0.25)'
                    : '#faf3e8',
                  cursor: isValid ? 'pointer' : 'default',
                  animation: isLastMove ? 'placeStone 0.3s ease-out' : 'none',
                }}
                title={cell && typeof cell !== 'string' ? `${cell.plant} ${cell.symbol}` : ''}
              >
                {cell && typeof cell !== 'string' && (
                  <span style={styles.tileEmoji}>
                    {getTileEmoji(cell.plant, cell.symbol)}
                  </span>
                )}
                {cell === 'red' && <span style={styles.stone}>🌸</span>}
                {cell === 'black' && <span style={styles.stone}>🐦</span>}
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
    sakura: '🌸',
    iris: '🌺',
    pine: '🌲',
    maple: '🍁',
    sun: '☀️',
    bird: '🐦',
    rain: '🌧️',
    tanzaku: '📜',
  };
  return `${map[plant] || plant}${map[symbol] || symbol}`;
}

// Адаптивные размеры клеток
const cellSize = Math.min(window.innerWidth, window.innerHeight) * 0.18;
const fontSize = cellSize * 0.4;

const styles: Record<string, React.CSSProperties> = {
  boardContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 20,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: `repeat(4, ${cellSize}px)`,
    gap: '4px',
    padding: '8px',
    background: 'rgba(0,0,0,0.05)',
    borderRadius: '12px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
  },
  cell: {
    width: cellSize,
    height: cellSize,
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSize,
    transition: 'all 0.2s ease',
    position: 'relative' as const,
    boxSizing: 'border-box',
  },
  validMove: {
    border: '3px solid #f1c40f',
    boxShadow: '0 0 12px #f1c40f88',
    animation: 'pulse 1.5s infinite',
  },
  occupied: {
    backdropFilter: 'blur(2px)',
  },
  tileEmoji: {
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
  },
  stone: {
    fontSize: fontSize,
    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))',
  },
};

export default Board;