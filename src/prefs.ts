/** Small user preferences kept in localStorage (e.g. "install banner dismissed"). */
export const PREFS_KEY = 'mosaic.prefs';

export function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')[key];
    return v === undefined ? fallback : (v as T);
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    const all = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    all[key] = value;
    localStorage.setItem(PREFS_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable (private mode) – preferences are just not remembered */
  }
}
