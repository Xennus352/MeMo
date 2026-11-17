export type ThemeMode = 'light' | 'dark';
export type ThemeTransitionEffect = 'fade' | 'wipe' | 'circle' | 'swipe' | 'paint';
export type ThemeTransitionMode = 'random' | 'custom';
export type WipeOrientation = 'random' | 'horizontal' | 'vertical';
export type CircleOrigin = 'random' | 'center';
export type SwipeDirection =
  | 'random'
  | 'left' | 'right' | 'top' | 'bottom'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ThemeTransitionConfig {
  /** 'random' picks a pooled effect on every switch, 'custom' uses `custom` */
  mode: ThemeTransitionMode;
  /** Effect used when mode === 'custom' */
  custom: ThemeTransitionEffect;
  wipeOrientation: WipeOrientation;
  circleOrigin: CircleOrigin;
  swipeDirection: SwipeDirection;
}

export const DEFAULT_THEME_TRANSITION: ThemeTransitionConfig = {
  mode: 'random',
  custom: 'paint',
  wipeOrientation: 'random',
  circleOrigin: 'random',
  swipeDirection: 'random',
};

const TRANSITION_EFFECTS: readonly ThemeTransitionEffect[] = ['fade', 'wipe', 'circle', 'swipe', 'paint'];
const WIPE_ORIENTATIONS: readonly WipeOrientation[] = ['random', 'horizontal', 'vertical'];
const CIRCLE_ORIGINS: readonly CircleOrigin[] = ['random', 'center'];
const SWIPE_DIRECTIONS: readonly SwipeDirection[] = ['random', 'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

export function parseThemeTransition(raw: string | null | undefined): ThemeTransitionConfig {
  try {
    const p = JSON.parse(raw ?? '');
    if (!p || typeof p !== 'object') return { ...DEFAULT_THEME_TRANSITION };
    return {
      mode: p.mode === 'custom' ? 'custom' : 'random',
      custom: TRANSITION_EFFECTS.includes(p.custom) ? p.custom : DEFAULT_THEME_TRANSITION.custom,
      wipeOrientation: WIPE_ORIENTATIONS.includes(p.wipeOrientation) ? p.wipeOrientation : 'random',
      circleOrigin: CIRCLE_ORIGINS.includes(p.circleOrigin) ? p.circleOrigin : 'random',
      swipeDirection: SWIPE_DIRECTIONS.includes(p.swipeDirection) ? p.swipeDirection : 'random',
    };
  } catch {
    return { ...DEFAULT_THEME_TRANSITION };
  }
}

export function serializeThemeTransition(cfg: ThemeTransitionConfig): string {
  return JSON.stringify({
    mode: cfg.mode,
    custom: cfg.custom,
    wipeOrientation: cfg.wipeOrientation,
    circleOrigin: cfg.circleOrigin,
    swipeDirection: cfg.swipeDirection,
  });
}

/**
 * Snapshot of the user's chosen theme transition. Keeping the parsed config
 * in a module variable lets any call site apply the transition without
 * pulling in a store (avoids an import cycle between theme.ts and the stores).
 */
let transitionConfig: ThemeTransitionConfig = { ...DEFAULT_THEME_TRANSITION };

export function setThemeTransitionConfig(rawOrConfig: string | ThemeTransitionConfig | null | undefined): void {
  transitionConfig =
    typeof rawOrConfig === 'string'
      ? parseThemeTransition(rawOrConfig)
      : { ...DEFAULT_THEME_TRANSITION, ...(rawOrConfig ?? {}) };
}

export function getThemeTransitionConfig(): ThemeTransitionConfig {
  return { ...transitionConfig };
}

/** Effects in the pool for 'random' mode — every transition in the app (from Serpantinum's wallpaper set) */
export const THEME_TRANSITION_POOL: readonly ThemeTransitionEffect[] = ['fade', 'wipe', 'circle', 'swipe', 'paint'];

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

export interface ThemeTransitionOptions {
  /** Click origin as a fraction of the viewport (0..1), used by circle and paint */
  originX?: number;
  originY?: number;
}

const clamp01 = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

const pickRandom = <T,>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];

const resolvedEffect = (): ThemeTransitionEffect => {
  const cfg = transitionConfig;
  return cfg.mode === 'custom' ? cfg.custom : pickRandom(THEME_TRANSITION_POOL);
};

const resolvedWipeOrientation = (): 'horizontal' | 'vertical' => {
  const cfg = transitionConfig;
  if (cfg.wipeOrientation === 'random') return Math.random() < 0.5 ? 'horizontal' : 'vertical';
  return cfg.wipeOrientation;
};

const resolvedSwipeDirection = (): SwipeDirection => {
  const cfg = transitionConfig;
  if (cfg.swipeDirection === 'random') {
    return pickRandom(['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as const);
  }
  return cfg.swipeDirection;
};

/**
 * Apply a theme the user just picked, animating between palettes with the
 * Serpantinum wallpaper transition they chose (see /Acknowledgements in
 * Settings → About). Falls back to an instant switch when the API is missing
 * or the user prefers reduced motion.
 */
export function applyThemeAnimated(theme: ThemeMode, opts: ThemeTransitionOptions = {}): void {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (typeof document.startViewTransition !== 'function' || reduced) {
    applyTheme(theme);
    return;
  }

  const effect = resolvedEffect();
  const root = document.documentElement;
  root.dataset.themeTransition = effect;

  // Circle & paint reveal from a clickable origin; wipe is always center-split
  if (effect === 'wipe') {
    root.dataset.themeWipeOrientation = resolvedWipeOrientation();
  } else {
    delete root.dataset.themeWipeOrientation;
  }

  if (effect === 'circle' || effect === 'paint') {
    let ox = clamp01(opts.originX, 0.5);
    let oy = clamp01(opts.originY, 0.5);
    if (effect === 'circle' && transitionConfig.circleOrigin === 'center') {
      ox = 0.5;
      oy = 0.5;
    }
    const farthest = Math.hypot(Math.max(ox, 1 - ox), Math.max(oy, 1 - oy));
    root.style.setProperty('--theme-origin-x', `${(ox * 100).toFixed(1)}%`);
    root.style.setProperty('--theme-origin-y', `${(oy * 100).toFixed(1)}%`);
    root.style.setProperty('--theme-max-radius', `${(farthest * 100).toFixed(1)}%`);
  }

  if (effect === 'swipe') {
    root.dataset.themeSwipeDirection = resolvedSwipeDirection();
  } else {
    delete root.dataset.themeSwipeDirection;
  }

  document.startViewTransition(() => {
    applyTheme(theme);
  });
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
