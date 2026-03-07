import { useCallback } from 'react';

// local Storage
export function useFormPersist(key: string) {
  const save = useCallback((data: object) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // localStorage lleno o no disponible
    }
  }, [key]);

  const load = useCallback(<T>(): T | null => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : null;
    } catch {
      return null;
    }
  }, [key]);

  const clear = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  return { save, load, clear };
}
