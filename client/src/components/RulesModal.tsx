import React, { useState } from 'react';

interface RulesModalProps {
  onClose: () => void;
  onStartTutorial?: () => void; // позже для тренажёра
}

const RulesModal: React.FC<RulesModalProps> = ({ onClose, onStartTutorial }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'moves' | 'win' | 'block'>('rules');

  // Иллюстрация: пустая доска 4x4 с углами для первого хода
  const renderBoardIllustration = (boardData: string[][], highlight?: [number, number][]) => {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 40px)',
        gap: '4px',
        justifyContent: 'center',
        margin: '10px 0',
      }}>
        {boardData.map((row, r) => (
          row.map((cell, c) => {
            const isHighlight = highlight?.some(([hr, hc]) => hr === r && hc === c);
            return (
              <div key={`${r}-${c}`} style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isHighlight ? '#f1c40f' : 'var(--cell-bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '24px',
              }}>
                {cell}
              </div>
            );
          })
        ))}
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
                <li>Первый ход: можно взять любую фишку из <strong>углов</strong> (0,0), (0,3), (3,0), (3,3).</li>
                <li>Следующие ходы: нужно взять фишку, у которой совпадает хотя бы один символ (растение <em>или</em> явление) с <strong>предыдущей взятой фишкой</strong>.</li>
                <li>Взятая фишка заменяется вашим камнем (🌸 или 🌑).</li>
              </ul>
              <p><strong>🏆 Выигрыш:</strong> после размещения камня проверяется, образовался ли ряд/квадрат из ваших камней. Если да – вы победили.</p>
              <p><strong>🤝 Ничья:</strong> если поле заполнено, а победителя нет.</p>
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
                ['', '', '', ''],
                ['', '', '', ''],
                ['', '', '', '']
              ])}
              <p>👉 <strong>4 в ряд по вертикали</strong></p>
              {renderBoardIllustration([
                ['🌸', '', '', ''],
                ['🌸', '', '', ''],
                ['🌸', '', '', ''],
                ['🌸', '', '', '']
              ])}
              <p>👉 <strong>4 в ряд по диагонали</strong></p>
              {renderBoardIllustration([
                ['🌸', '', '', ''],
                ['', '🌸', '', ''],
                ['', '', '🌸', ''],
                ['', '', '', '🌸']
              ])}
              <p>👉 <strong>Квадрат 2×2</strong></p>
              {renderBoardIllustration([
                ['🌸', '🌸', '', ''],
                ['🌸', '🌸', '', ''],
                ['', '', '', ''],
                ['', '', '', '']
              ])}
            </div>
          )}

          {activeTab === 'block' && (
            <div>
              <p><strong>Как блокировать соперника?</strong></p>
              <p>Если соперник уже имеет 3 камня в ряд, поставьте свой камень на свободную клетку, чтобы завершить этот ряд — тогда он не сможет выиграть на этом направлении.</p>
              {renderBoardIllustration([
                ['🌸', '🌸', '🌸', ''],
                ['', '⚫', '', ''],
                ['', '', '', ''],
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    background: 'var(--modal-bg)',
    borderRadius: '24px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '85vh',
    overflow: 'auto',
    padding: '24px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
  },
  title: {
    margin: '0 0 16px',
    fontSize: '24px',
    textAlign: 'center',
    color: 'var(--text)',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '8px',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'var(--secondary-text)',
    transition: 'all 0.2s',
  },
  activeTab: {
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
  },
  content: {
    marginBottom: '24px',
    lineHeight: '1.5',
    color: 'var(--text)',
    fontSize: '14px',
  },
  buttonsRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    padding: '8px 20px',
    borderRadius: '30px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  tutorialBtn: {
    padding: '8px 20px',
    borderRadius: '30px',
    border: 'none',
    background: '#4a6741',
    color: 'white',
    cursor: 'pointer',
  },
};

export default RulesModal;