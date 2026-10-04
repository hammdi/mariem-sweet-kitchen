import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from './theme';
import { ThemeMode } from './tokens';

/**
 * Thème clair / sombre de l'administration (bouton ☀️ de la barre du haut).
 * Le choix est mémorisé sur cet appareil. Le site public reste en clair.
 */
const KEY = 'mariem.theme';
const Ctx = createContext<{ mode: ThemeMode; toggle: () => void }>({ mode: 'light', toggle: () => undefined });

const readMode = (): ThemeMode => {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readMode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  // Variables CSS du thème sur <html> (les fenêtres et menus sont rendus hors de la page)
  useEffect(() => {
    document.documentElement.dataset.mkTheme = mode;
    return () => {
      delete document.documentElement.dataset.mkTheme;
    };
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* choix non mémorisé : sans conséquence */
      }
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </Ctx.Provider>
  );
}

export const useThemeMode = () => useContext(Ctx);
