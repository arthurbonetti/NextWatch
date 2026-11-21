import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Appearance,
  ColorSchemeName,
  ImageStyle,
  Platform,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';

import {
  darkTheme,
  lightTheme,
  ResolvedThemeMode,
  Theme,
  ThemeColors,
  ThemeMode,
} from '@/constants/theme';

const THEME_STORAGE_KEY = '@nextwatch/theme-mode';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

type ThemeContextValue = {
  theme: Theme;
  colors: ThemeColors;
  themeMode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  isDark: boolean;
  themeReady: boolean;
  setThemeMode: (mode: ThemeMode) => void;
};

function normalizeColorScheme(scheme: ColorSchemeName | string | null | undefined): ResolvedThemeMode {
  return scheme === 'dark' ? 'dark' : 'light';
}

function parseStoredThemeMode(raw: string | null): ThemeMode | null {
  if (raw === 'light' || raw === 'dark' || raw === 'system') {
    return raw;
  }
  return null;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  colors: lightTheme.colors,
  themeMode: 'system',
  resolvedMode: 'light',
  isDark: false,
  themeReady: false,
  setThemeMode: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<ResolvedThemeMode>(() =>
    normalizeColorScheme(Appearance.getColorScheme()),
  );
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        const parsed = parseStoredThemeMode(stored);
        if (parsed) {
          setThemeModeState(parsed);
        }
        setThemeReady(true);
      })
      .catch(() => {
        if (!active) return;
        setThemeReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(normalizeColorScheme(colorScheme));
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const resolvedMode: ResolvedThemeMode = themeMode === 'system' ? systemScheme : themeMode;
  const theme = resolvedMode === 'dark' ? darkTheme : lightTheme;
  const isDark = resolvedMode === 'dark';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.backgroundColor = theme.colors.bgPrimary;
    root.style.colorScheme = resolvedMode;
    if (document.body) {
      document.body.style.backgroundColor = theme.colors.bgPrimary;
    }
  }, [resolvedMode, theme.colors.bgPrimary]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: theme.colors,
      themeMode,
      resolvedMode,
      isDark,
      themeReady,
      setThemeMode,
    }),
    [isDark, resolvedMode, setThemeMode, theme, themeMode, themeReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useThemedStyles<T extends NamedStyles<T>>(factory: (theme: Theme) => T): T {
  const { theme } = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
}
