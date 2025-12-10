// SAP Cache utilities - stores data in localStorage with timestamp

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const SAP_CACHE_KEYS = {
  CUIC: 'sap_cuic_cache',
  ARTICULOS: 'sap_articulos_cache',
} as const;

export function getSapCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid (within 24 hours)
    if (now - entry.timestamp < CACHE_DURATION) {
      return entry.data;
    }

    // Cache expired, remove it
    localStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

export function setSapCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    console.warn('Failed to cache SAP data:', e);
  }
}

export function clearSapCache(key?: string): void {
  if (key) {
    localStorage.removeItem(key);
  } else {
    localStorage.removeItem(SAP_CACHE_KEYS.CUIC);
    localStorage.removeItem(SAP_CACHE_KEYS.ARTICULOS);
  }
}

export function getCacheTimestamp(key: string): Date | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const entry = JSON.parse(cached);
    return new Date(entry.timestamp);
  } catch {
    return null;
  }
}
