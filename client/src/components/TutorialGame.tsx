import React from 'react';

const TutorialGame: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  console.log('TutorialGame rendering - SIMPLE VERSION');
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'red', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <h1 style={{ color: 'white' }}>ТРЕНАЖЁР РАБОТАЕТ</h1>
      <button onClick={onClose} style={{ padding: '10px 20px', marginTop: '20px' }}>Закрыть</button>
    </div>
  );
};

export default TutorialGame;