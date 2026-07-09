import { useEffect, useState } from 'react';

/**
 * Retorna true cuando el viewport es < 768px (breakpoint md de Tailwind).
 * Se actualiza en tiempo real al redimensionar la ventana.
 */
export function useIsMobile(): boolean {
  const query = '(max-width: 767px)';
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Compat: safari viejo usa addListener
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
    } else {
      // @ts-expect-error - fallback legacy
      mql.addListener(handler);
    }
    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handler);
      } else {
        // @ts-expect-error - fallback legacy
        mql.removeListener(handler);
      }
    };
  }, []);

  return isMobile;
}
