import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import Game from './components/Game';

function App() {
  return (
    <ThemeProvider>
      <Game />
    </ThemeProvider>
  );
}

export default App;