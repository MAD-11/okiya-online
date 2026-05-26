import React, { createContext, useState, useContext, useEffect } from 'react';

type Skin = 'sakura' | 'bird' | 'maple';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  darkMode: false,
  toggleDarkMode: () => {},
  skin: 'sakura',
  setSkin: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [skin, setSkin] = useState<Skin>(() => (localStorage.getItem('skin') as Skin) || 'sakura');

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
    document.body.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('skin', skin);
  }, [skin]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, skin, setSkin }}>
      {children}
    </ThemeContext.Provider>
  );
};