import React, { createContext, useState, useContext, useEffect } from 'react';

export type Skin = 'sakura' | 'bird' | 'maple' | 'moon';

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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('okiya_darkMode') === 'true');
  const [skin, setSkin] = useState<Skin>(() => (localStorage.getItem('okiya_skin') as Skin) || 'sakura');

  useEffect(() => {
    localStorage.setItem('okiya_darkMode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('okiya_skin', skin);
  }, [skin]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, skin, setSkin }}>
      {children}
    </ThemeContext.Provider>
  );
};