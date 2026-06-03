import React from 'react';

const TutorialGame: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  console.log('TutorialGame is rendering!');
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'red',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
        <h2>Тренажёр работает!</h2>
        <button onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
};

export default TutorialGame;