import React, { useEffect, useState } from 'react';

interface TimerProps {
  turnStartedAt: number;
  turnDuration: number;
}

const Timer: React.FC<TimerProps> = ({ turnStartedAt, turnDuration }) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - turnStartedAt;
      setRemaining(Math.max(0, turnDuration - elapsed));
    };
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [turnStartedAt, turnDuration]);

  const seconds = Math.ceil(remaining / 1000);
  const isLow = remaining < 10000;

  return (
    <div style={{
      fontSize: 20,
      fontWeight: 500,
      color: isLow ? '#c0392b' : '#3e362e',
      fontFamily: '"Inter", sans-serif',
    }}>
      {seconds}s
    </div>
  );
};

export default Timer;