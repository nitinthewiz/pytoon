// ThemeProvider + useTheme (visual-component-library spec §1.4).
//
// A block reads its colors/fonts/motion from useTheme() instead of importing NH/ANTON.
// The default context value is the JAMES theme so any standalone preview (a single block
// dropped in a <Composition> with no provider) still renders on-brand and never crashes.
//
// The provider also RESOLVES the theme's font *family names* (e.g. "Anton") into the CSS
// family strings Remotion registers, and overwrites theme.fonts.display/body with them —
// so consumers can use `t.fonts.display` directly as a CSS fontFamily, headless-safe.
import React from 'react';
import { parseTheme, type Theme } from './tokens';
import { loadThemeFonts } from './fonts';
import jamesRaw from './themes/james.theme.json';

// The parsed James theme — the system default (presentation-identical to today's NH).
export const JAMES: Theme = parseTheme(jamesRaw);

// Resolve a theme's font family names → registered CSS family strings, returning a new
// theme object safe to read directly. Memoized per-identity so providers don't re-load.
const resolvedCache = new WeakMap<Theme, Theme>();
export const resolveThemeFonts = (theme: Theme): Theme => {
  const cached = resolvedCache.get(theme);
  if (cached) return cached;
  const { display, body } = loadThemeFonts(theme);
  const resolved: Theme = { ...theme, fonts: { ...theme.fonts, display, body } };
  resolvedCache.set(theme, resolved);
  return resolved;
};

const ThemeCtx = React.createContext<Theme>(resolveThemeFonts(JAMES));

export const ThemeProvider: React.FC<{ theme: Theme; children: React.ReactNode }> = ({
  theme,
  children,
}) => {
  const resolved = React.useMemo(() => resolveThemeFonts(theme), [theme]);
  return <ThemeCtx.Provider value={resolved}>{children}</ThemeCtx.Provider>;
};

export const useTheme = (): Theme => React.useContext(ThemeCtx);
