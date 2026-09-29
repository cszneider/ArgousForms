export const THEME_STORAGE_KEY = 'argousdocs:theme';
export function resolveColorMode(saved, prefersDark) {
  return saved === 'light' || saved === 'dark'
    ? saved
    : prefersDark
      ? 'dark'
      : 'light';
}
export function oppositeColorMode(mode) {
  return mode === 'dark' ? 'light' : 'dark';
}
