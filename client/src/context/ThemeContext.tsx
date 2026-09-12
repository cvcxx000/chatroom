import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'chatroom_theme';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeState | null>(null);

function getSystemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore
  }
  return 'system';
}

function applyTheme(mode: ThemeMode, systemDark: boolean) {
  const dark = mode === 'dark' || (mode === 'system' && systemDark);
  const root = document.documentElement;
  if (dark) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
  return dark;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme());
  const [systemDark, setSystemDark] = useState<boolean>(() => getSystemDark());

  // Track OS-level color scheme changes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark = useMemo(
    () => theme === 'dark' || (theme === 'system' && systemDark),
    [theme, systemDark],
  );

  // Apply the attribute whenever the resolved dark state changes.
  useEffect(() => {
    applyTheme(theme, systemDark);
  }, [theme, systemDark]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<ThemeState>(
    () => ({ theme, setTheme, isDark }),
    [theme, setTheme, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
