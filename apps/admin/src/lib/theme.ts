export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';
const KEY = 'admin-theme';

export function getThemePreference(): ThemePreference {
  const value = localStorage.getItem(KEY);
  return value === 'LIGHT' || value === 'DARK' || value === 'SYSTEM' ? value : 'SYSTEM';
}

export function applyTheme(preference: ThemePreference) {
  localStorage.setItem(KEY, preference);
  const dark = preference === 'DARK' || (preference === 'SYSTEM' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function initializeTheme() {
  applyTheme(getThemePreference());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemePreference() === 'SYSTEM') applyTheme('SYSTEM');
  });
}
