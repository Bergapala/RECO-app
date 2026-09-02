import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  borderRadius,
  darkColors,
  fontBody,
  fontSizes,
  fontTitle,
  lightColors,
  spacing,
  withOpacity,
  type ThemeColors,
} from '@/theme';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'reco:theme-mode';

export type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  fontTitle: string;
  fontBody: string;
  fontSizes: typeof fontSizes;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  withOpacity: typeof withOpacity;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Fournit le thème actif (clair par défaut au premier lancement, comme
 * demandé) à toute l'app, et persiste le choix de l'utilisateur en local
 * avec AsyncStorage pour qu'il survive entre les sessions. Enveloppe
 * `<Slot />` dans src/app/_layout.tsx.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Pas grave si la sauvegarde échoue (stockage plein, etc.) — le
      // thème reste actif pour la session en cours, juste pas persisté.
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? darkColors : lightColors,
      fontTitle,
      fontBody,
      fontSizes,
      spacing,
      borderRadius,
      withOpacity,
      toggleTheme,
      setMode,
    }),
    [mode, toggleTheme, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Thème actif — couleurs, typographie, espacements, `toggleTheme()`. Même
 * forme que l'ancien objet `theme` statique (voir src/theme/index.ts), pour
 * pouvoir écrire `theme.colors.xxx` sans rien changer d'autre dans les
 * écrans déjà convertis. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme() doit être appelé à l’intérieur de <ThemeProvider>.');
  }
  return context;
}
