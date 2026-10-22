import React, { createContext, useState, useContext, useEffect } from 'react';

export type Skin =
  | 'sakura' | 'bird' | 'maple' | 'moon'
  | 'bamboo' | 'fox' | 'fuji' | 'torii';

export type ThemeMode = 'auto' | 'light' | 'dark';

interface ThemeContextType {
  darkMode: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleDarkMode: () => void;
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  darkMode: true,
  themeMode: 'dark',
  setThemeMode: () => {},
  toggleDarkMode: () => {},
  skin: 'sakura',
  setSkin: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const VALID_SKINS: Skin[] = ['sakura', 'bird', 'maple', 'moon', 'bamboo', 'fox', 'fuji', 'torii'];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // default = dark (пользователь выбрал тёмную тему как основную)
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('okiya_themeMode');
    if (stored === 'auto' || stored === 'light' || stored === 'dark') return stored;
    const old = localStorage.getItem('okiya_darkMode');
    if (old === 'false') return 'light';
    if (old === 'true') return 'dark';
    return 'dark'; // default
  });

  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );

  const [skin, setSkin] = useState<Skin>(() => {
    const stored = localStorage.getItem('okiya_skin') as Skin | null;
    return stored && VALID_SKINS.includes(stored) ? stored : 'sakura';
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else (mq as any).addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else (mq as any).removeListener(handler);
    };
  }, []);

  const darkMode = themeMode === 'auto' ? systemDark : themeMode === 'dark';

  useEffect(() => {
    localStorage.setItem('okiya_themeMode', themeMode);
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [themeMode, darkMode]);

  useEffect(() => {
    localStorage.setItem('okiya_skin', skin);
  }, [skin]);

  const setThemeMode = (mode: ThemeMode) => setThemeModeState(mode);
  const toggleDarkMode = () => setThemeModeState(darkMode ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ darkMode, themeMode, setThemeMode, toggleDarkMode, skin, setSkin }}>
      {children}
    </ThemeContext.Provider>
  );
};