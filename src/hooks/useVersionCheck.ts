import { useEffect, useRef } from 'react';

declare const __BUILD_TIME__: number;

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useVersionCheck() {
  const currentBuild = useRef(__BUILD_TIME__);

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.buildTime && data.buildTime !== currentBuild.current) {
          window.location.reload();
        }
      } catch {
        // silently ignore network errors
      }
    }

    // Check when tab becomes visible again
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, []);
}
