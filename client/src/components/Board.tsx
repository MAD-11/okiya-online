import React, { useState, useCallback, useRef } from 'react';
import { Board as BoardType, ValidMoves } from '../types/game';
import { initAudio } from '../utils/sound';

interface BoardProps {
  board: BoardType;
  validMoves: ValidMoves;
  onClick: (row: number, col: number) => void;
  currentPlayer: string;
  myColor: string | null;
  lastMove: { row: number; col: number } | null;
  hostSkin: string;
  guestSkin: string;
  shake?: boolean;
}

const skinEmoji: Record<string, { red: string; black: string }> = {
  sakura: { red: '🌸', black: '🌺' },
  bird:   { red: '🐦', black: '🐦‍⬛' },
  maple:  { red: '🍁', black: '🍂' },
  moon:   { red: '🌙', black: '🌑' },
  bamboo: { red: '🎋', black: '🎍' },
  fox:    { red: '🦊', black: '🐺' },
  fuji:   { red: '🗻', black: '🏔️' },
  torii:  { red: '⛩️', black: '🏯' },
};

const Board: React.FC<BoardProps> = ({ board, validMoves, onClick, lastMove, hostSkin, guestSkin, shake = false }) => {
  const cellSize = 88;
  const fontSize = 32;
  const [invalidCell, setInvalidCell] = useState<{ row: number; col: number } | null>(null);
  const [cursor, setCursor] = useState<{ row: number; col: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const canInteract = (row: number, col: number) => !!validMoves[row]?.[col];

  const handleCellClick = (row: number, col: number) => {
    if (canInteract(row, col)) {
      initAudio();
      onClick(row, col);
    } else {
      setInvalidCell({ row, col });
      setTimeout(() => setInvalidCell(null), 200);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!cursor) {
      let start: { row: number; col: number } | null = null;
      for (let r = 0; r < 4 && !start; r++) {
        for (let c = 0; c < 4 && !start; c++) {
          if (canInteract(r, c)) start = { row: r, col: c };
        }
      }
      setCursor(start || { row: 1, col: 1 });
      return;
    }
    let { row, col } = cursor;
    let handled = true;
    switch (e.key) {
      case 'ArrowUp':    row = (row + 3) % 4; break;
      case 'ArrowDown':  row = (row + 1) % 4; break;
      case 'ArrowLeft':  col = (col + 3) % 4; break;
      case 'ArrowRight': col = (col + 1) % 4; break;
      case 'Enter':
      case ' ':
        if (canInteract(row, col)) handleCellClick(row, col);
        else {
          setInvalidCell({ row, col });
          setTimeout(() => setInvalidCell(null), 200);
        }
        break;
      case 'Escape':
        setCursor(null);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      setCursor({ row, col });
    }
  }, [cursor, validMoves, onClick]);

  const getStoneEmoji = (color: 'red' | 'black') => {
    if (color === 'red') return skinEmoji[hostSkin]?.red || skinEmoji.sakura.red;
    return skinEmoji[guestSkin]?.black || skinEmoji.sakura.black;
  };

  return (
    <div
      className={shake ? 'board-shake' : ''}
      ref={containerRef}
      style={styles.boardContainer}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-label="Игровое поле. Используйте стрелки и Enter для хода"
    >
      <div className="board-grid" style={styles.grid}>
        {board.map((row, r) =>
          row.map((cell, c) => {
            const isValid = validMoves[r]?.[c];
            const isPlayerCell = cell === 'red' || cell === 'black';
            const isLastMove = lastMove?.row === r && lastMove?.col === c;
            const isInvalid = invalidCell?.row === r && invalidCell?.col === c;
            const isCursor = focused && cursor?.row === r && cursor?.col === c;
            const stoneEmoji = cell === 'red' ? getStoneEmoji('red')
                             : cell === 'black' ? getStoneEmoji('black')
                             : null;

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                style={{
                  ...styles.cell,
                  width: cellSize,
                  height: cellSize,
                  fontSize,
                  cursor: isValid ? 'pointer' : 'default',
                  backgroundColor: isPlayerCell
                    ? cell === 'red' ? 'var(--stone-red-bg)' : 'var(--stone-black-bg)'
                    : isInvalid ? '#ffcccc' : 'var(--cell-bg)',
                  border: '1px solid var(--border)',
                  boxShadow: isValid
                    ? 'inset 0 0 0 2px var(--valid-move-border)'
                    : undefined,
                  outline: isCursor ? '2px solid var(--turn-indicator)' : 'none',
                  outlineOffset: '-2px',
                }}
              >
                {cell && typeof cell !== 'string' && (
                  <span style={styles.tileEmoji}>{getTileEmoji(cell.plant, cell.symbol)}</span>
                )}
                {stoneEmoji && (
                  <span
                    key={isLastMove ? `anim-${r}-${c}` : `stone-${r}-${c}`}
                    style={{
                      ...styles.stone,
                      animation: isLastMove ? 'placeStone 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
                    }}
                  >
                    {stoneEmoji}
                  </span>
                )}
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
  boardContainer: { display: 'flex', justifyContent: 'center', outline: 'none' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 88px)',
    gap: '8px',
    padding: '16px',
    borderRadius: '16px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
  },
  cell: {
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
    boxSizing: 'border-box',
    // УБРАН perspective — он конфликтовал с анимацией
  },
  tileEmoji: { filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' },
  stone: {
    fontSize: '38px',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
    display: 'inline-block',
    // УБРАН transformStyle — не нужен без 3D
  },
};

export default Board;