import React, { useEffect, useState } from 'react';

interface TimerProps {
  turnStartedAt: number;
  turnDuration: number;
}

const Timer: React.FC<TimerProps> = ({ turnStartedAt, turnDuration }) => {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - turnStartedAt;
      const left = Math.max(0, turnDuration - elapsed);
      setRemaining(left);
    };
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [turnStartedAt, turnDuration]);

  const seconds = Math.ceil(remaining / 1000);
  const isLow = remaining < 10000;

  return (
    <div style={{
      fontSize: 24,
      fontWeight: 'bold',
      color: isLow ? '#e74c3c' : '#4a3f35',
      margin: '5px 0',
      transition: 'color 0.3s',
    }}>
      {seconds}s
    </div>
  );
};

export default Timer;