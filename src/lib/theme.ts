export type ThemeMode = 'light' | 'dark';

const THEME_COLORS: Record<ThemeMode, string> = {
  light: '#F8F5FC',
  dark: '#160D21',
};

const THEME_CACHE_KEY = 'memo_theme';

/** Force the given theme onto <html> and keep the browser chrome in sync. */
export function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;

  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);

  // Cache for the next cold start so the first paint is already correct.
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
  } catch {
    // Storage may be unavailable; the in-memory theme still applies.
  }
}

/** Stored "system" (or missing) falls back to light – the app only offers Light/Dark. */
export function resolveTheme(theme?: string | null): ThemeMode {
  return theme === 'dark' ? 'dark' : 'light';
}

/**
 * Apply the persisted theme before React mounts so the first paint is
 * already correct (no light flash when starting in dark mode).
 */
export function applyStoredTheme(): void {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached === 'light' || cached === 'dark') {
      applyTheme(cached);
      return;
    }
  } catch {
    // Ignore and fall through to the database.
  }

  try {
    const raw = localStorage.getItem('hourglass_web_db');
    if (raw) {
      const db = JSON.parse(raw) as {
        app_settings?: Array<{ theme?: string }>;
      };
      applyTheme(resolveTheme(db.app_settings?.[0]?.theme));
      return;
    }
  } catch {
    // Corrupt/unavailable storage – just use the default.
  }

  applyTheme(resolveTheme(null));
}
