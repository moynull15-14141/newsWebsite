import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getThemePreference, initializeTheme } from './theme';

// This suite runs under Vitest's default "node" environment (no jsdom in this project — see the
// other web tests, which render via `renderToStaticMarkup` instead of a real DOM). `theme.ts` only
// touches three globals (`localStorage`, `document.documentElement`, `matchMedia`) and holds no
// module-level state, so minimal hand-rolled stubs per test are enough.
function installDomStubs() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    clear: () => store.clear(),
  };
  const classes = new Set<string>();
  (globalThis as any).document = {
    documentElement: {
      classList: {
        toggle: (name: string, force?: boolean) => {
          const shouldHave = force ?? !classes.has(name);
          shouldHave ? classes.add(name) : classes.delete(name);
        },
        contains: (name: string) => classes.has(name),
      },
      style: {} as Record<string, string>,
    },
  };
}

describe('theme', () => {
  beforeEach(() => {
    installDomStubs();
    (globalThis as any).matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() });
  });
  afterEach(() => vi.restoreAllMocks());

  describe('getThemePreference', () => {
    it('defaults to SYSTEM when nothing is stored', () => {
      expect(getThemePreference()).toBe('SYSTEM');
    });

    it('reads back a previously stored valid preference', () => {
      localStorage.setItem('news-theme', 'DARK');
      expect(getThemePreference()).toBe('DARK');
    });

    it('falls back to SYSTEM for a corrupted/unexpected stored value', () => {
      localStorage.setItem('news-theme', 'not-a-real-value');
      expect(getThemePreference()).toBe('SYSTEM');
    });
  });

  describe('applyTheme', () => {
    it('adds the dark class and persists the choice for DARK', () => {
      applyTheme('DARK');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.style.colorScheme).toBe('dark');
      expect(localStorage.getItem('news-theme')).toBe('DARK');
    });

    it('removes the dark class for LIGHT', () => {
      applyTheme('DARK');
      applyTheme('LIGHT');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.style.colorScheme).toBe('light');
      expect(localStorage.getItem('news-theme')).toBe('LIGHT');
    });

    it('follows the OS preference for SYSTEM', () => {
      (globalThis as any).matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn() });
      applyTheme('SYSTEM');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('initializeTheme', () => {
    it('applies the stored preference on load and listens for OS changes', () => {
      localStorage.setItem('news-theme', 'DARK');
      const addEventListener = vi.fn();
      (globalThis as any).matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener });

      initializeTheme();

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });
});
