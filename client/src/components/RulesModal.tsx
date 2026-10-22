import React, { useState } from 'react';

interface RulesModalProps {
  onClose: () => void;
  onStartTutorial?: () => void;
}

const RulesModal: React.FC<RulesModalProps> = ({ onClose, onStartTutorial }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'moves' | 'win' | 'block'>('rules');

  const renderBoardIllustration = (boardData: string[][], highlight?: [number, number][]) => {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 65px)',   // фиксированная ширина 65px
        gap: '6px',
        justifyContent: 'center',
        margin: '12px auto',
        overflowX: 'auto',
        maxWidth: '100%',
      }}>
        {boardData.map((row, r) =>
          row.map((cell, c) => {
            const isHighlight = highlight?.some(([hr, hc]) => hr === r && hc === c);
            const trimmed = cell.trim();
            const emojis = (trimmed === '.' || trimmed === '')
              ? []
              : trimmed.match(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || [];
            const firstEmoji = emojis[0] || '';
            const secondEmoji = emojis[1] || '';
            const hasTwo = emojis.length >= 2;
            const isEmpty = firstEmoji === '';

            return (
              <div
                key={`${r}-${c}`}
                style={{
                  display: 'flex',
                  flexDirection: hasTwo ? 'column' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '65px',
                  height: '65px',
                  backgroundColor: isHighlight ? '#f1c40f' : 'var(--cell-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '4px',
                  boxSizing: 'border-box',
                }}
              >
                {!isEmpty && (
                  <span style={{
                    fontSize: hasTwo ? '26px' : '34px',
                    lineHeight: 1,
                    fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
                  }}>
                    {firstEmoji}
                  </span>
                )}
                {hasTwo && (
                  <span style={{
                    fontSize: '22px',
                    lineHeight: 1,
                    marginTop: '4px',
                    fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
                  }}>
                    {secondEmoji}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 style={styles.title}>📖 Правила игры</h2>

        <div style={styles.tabs}>
          <button onClick={() => setActiveTab('rules')} style={{ ...styles.tab, ...(activeTab === 'rules' ? styles.activeTab : {}) }}>📜 Правила</button>
          <button onClick={() => setActiveTab('moves')} style={{ ...styles.tab, ...(activeTab === 'moves' ? styles.activeTab : {}) }}>🎲 Ходы</button>
          <button onClick={() => setActiveTab('win')} style={{ ...styles.tab, ...(activeTab === 'win' ? styles.activeTab : {}) }}>🏆 Победа</button>
          <button onClick={() => setActiveTab('block')} style={{ ...styles.tab, ...(activeTab === 'block' ? styles.activeTab : {}) }}>🛡️ Блокировка</button>
        </div>

        <div style={styles.content}>
          {activeTab === 'rules' && (
            <div>
              <p><strong>🌸 Цель:</strong> выложить 4 своих камня в ряд (горизонталь, вертикаль, диагональ) или квадрат 2×2.</p>
              <p><strong>🎲 Как ходить:</strong></p>
              <ul>
                <li>Первый ход: можно взять любую карточку <strong>с края поля</strong> (то есть из первого или последнего ряда/столбца), кроме центральных четырёх клеток.</li>
                <li>Следующие ходы: нужно взять фишку, у которой совпадает хотя бы один символ (растение <em>или</em> явление) с <strong>предыдущей взятой фишкой</strong>.</li>
                <li>Взятая фишка заменяется вашим камнем (🌸 или 🌑).</li>
              </ul>
              <p><strong>🏆 Выигрыш:</strong> после размещения камня проверяется, образовался ли ряд/квадрат из ваших камней. Если да – вы победили.</p>
              <p><strong>🤝 Ничья:</strong> если поле полностью заполнено (все 16 клеток заняты камнями), а победитель не определён – игра заканчивается ничьей. В сериях счёт не меняется.</p>
              <p><strong>⚙️ Режимы:</strong> Одна игра (до 1 победы), серии до 3 или 5 побед (со сменой цветов каждый раунд).</p>
              <p><strong>💡 Совет:</strong> блокируйте возможные ряды соперника – не давайте ему выстроить 3 камня в линию.</p>
            </div>
          )}

          {activeTab === 'moves' && (
            <div>
              <p><strong>Пример допустимого хода:</strong> последняя взятая фишка — 🌸☀️ (сакура+солнце). Следующая фишка должна иметь либо сакуру, либо солнце.</p>
              {renderBoardIllustration([
                ['🌸☀️', '🌺🌧️', '🌲🐦', '🍁📜'],
                ['🌲☀️', '🌸🌧️', '🍁🐦', '🌺📜'],
                ['🍁☀️', '🌲🌧️', '🌸🐦', '🌺📜'],
                ['🌺☀️', '🍁🌧️', '🌲🐦', '🌸📜']
              ], [[1,1], [2,2], [0,1]])}
              <p style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>✨ Подсвеченные клетки — допустимые ходы (совпадает символ солнца).</p>
            </div>
          )}

          {activeTab === 'win' && (
            <div>
              <p><strong>Выигрышные комбинации:</strong></p>
              <p>👉 <strong>4 в ряд по горизонтали</strong></p>
              {renderBoardIllustration([
                ['🌸', '🌸', '🌸', '🌸'],
                ['.', '.', '.', '.'],
                ['.', '.', '.', '.'],
                ['.', '.', '.', '.']
              ])}
              <p>👉 <strong>4 в ряд по вертикали</strong></p>
              {renderBoardIllustration([
                ['🌸', '.', '.', '.'],
                ['🌸', '.', '.', '.'],
                ['🌸', '.', '.', '.'],
                ['🌸', '.', '.', '.']
              ])}
              <p>👉 <strong>4 в ряд по диагонали</strong></p>
              {renderBoardIllustration([
                ['🌸', '.', '.', '.'],
                ['.', '🌸', '.', '.'],
                ['.', '.', '🌸', '.'],
                ['.', '.', '.', '🌸']
              ])}
              <p>👉 <strong>Квадрат 2×2</strong></p>
              {renderBoardIllustration([
                ['🌸', '🌸', '.', '.'],
                ['🌸', '🌸', '.', '.'],
                ['.', '.', '.', '.'],
                ['.', '.', '.', '.']
              ])}
            </div>
          )}

          {activeTab === 'block' && (
            <div>
              <p><strong>Как блокировать соперника?</strong></p>
              <p>Если соперник уже имеет 3 камня в ряд, поставьте свой камень на свободную клетку, чтобы завершить этот ряд — тогда он не сможет выиграть на этом направлении.</p>
              {renderBoardIllustration([
                ['🌸', '🌸', '🌸', '!'],
                ['', '⚫', '', ''],
                ['', '', '⚫', ''],
                ['', '', '', '']
              ], [[0,3]])}
              <p style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>✨ Подсвеченная клетка — блокирующий ход чёрных.</p>
              <p>Также следите за возможными квадратами 2×2.</p>
            </div>
          )}
        </div>

        <div style={styles.buttonsRow}>
          <button onClick={onClose} style={styles.closeBtn}>Закрыть</button>
          {onStartTutorial && (
            <button onClick={onStartTutorial} style={styles.tutorialBtn}>
              🎓 Пройти обучающий курс (скоро)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '20px',
  },
  modal: {
    background: 'var(--modal-bg)',
    borderRadius: '24px',
    maxWidth: '700px',
    width: '90%',
    maxHeight: '85vh',
    overflow: 'auto',
    padding: '28px',
    border: '1px solid var(--border)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    color: 'var(--text)',
  },
  title: {
    margin: '0 0 20px',
    fontSize: '24px',
    fontWeight: 600,
    textAlign: 'center',
    color: 'var(--text)',
    letterSpacing: '0.5px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '22px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tab: {
    padding: '9px 16px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--secondary-text)',
    transition: 'all 0.2s',
    fontFamily: '"Inter", sans-serif',
  },
  activeTab: {
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    borderColor: 'transparent',
    fontWeight: 600,
    boxShadow: '0 4px 16px rgba(232,165,192,0.3)',
  },
  content: {
    marginBottom: '24px',
    lineHeight: 1.6,
    color: 'var(--text)',
    fontSize: '14px',
  },
  buttonsRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  closeBtn: {
    padding: '11px 24px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  tutorialBtn: {
    padding: '11px 24px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
    transition: 'all 0.2s',
  },
};

export default RulesModal;