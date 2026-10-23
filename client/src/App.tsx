import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import Game from './components/Game';

const x: number = "string";

function App() {
  return (
    <ThemeProvider>
      <Game />
    </ThemeProvider>
  );
}

export default App;