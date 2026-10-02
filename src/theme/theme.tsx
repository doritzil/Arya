import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { palette, shadows, type Palette } from './tokens.generated';

export type Scheme = 'light' | 'dark';

export interface Theme {
  scheme: Scheme;
  colors: Palette;
  shadows: (typeof shadows)['light'];
  reduceTransparency: boolean;
  reduceMotion: boolean;
}

const ThemeContext = createContext<Theme | null>(null);

const READERS = {
  reduceTransparencyChanged: 'isReduceTransparencyEnabled',
  reduceMotionChanged: 'isReduceMotionEnabled',
} as const;

function useAccessibilityFlag(event: keyof typeof READERS) {
  const [value, setValue] = useState(false);
  useEffect(() => {
    let alive = true;
    // Not every platform implements every reader (react-native-web lacks reduce transparency).
    const read = AccessibilityInfo[READERS[event]] as (() => Promise<boolean>) | undefined;
    if (typeof read === 'function') {
      read
        .call(AccessibilityInfo)
        .then((v) => alive && setValue(v))
        .catch(() => {});
    }
    const sub = AccessibilityInfo.addEventListener?.(event, setValue);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [event]);
  return value;
}

/** Provides the Aria palette for the system scheme, or a forced one. */
export function ThemeProvider({ force, children }: { force?: Scheme; children: ReactNode }) {
  const system = useColorScheme();
  const scheme: Scheme = force ?? (system === 'dark' ? 'dark' : 'light');
  const reduceTransparency = useAccessibilityFlag('reduceTransparencyChanged');
  const reduceMotion = useAccessibilityFlag('reduceMotionChanged');
  const value = useMemo<Theme>(
    () => ({ scheme, colors: palette[scheme], shadows: shadows[scheme], reduceTransparency, reduceMotion }),
    [scheme, reduceTransparency, reduceMotion],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>');
  return t;
}
