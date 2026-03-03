import { useEffect, useState } from 'react';
import { useThemeStore } from '../../store/themeStore';

interface LoadingScreenProps {
  onFinished?: () => void;
  ready?: boolean;
}

export function LoadingScreen({ onFinished, ready }: LoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => setFadeOut(true), 300);
      return () => clearTimeout(t);
    }
  }, [ready]);

  useEffect(() => {
    if (fadeOut) {
      const t = setTimeout(() => onFinished?.(), 500);
      return () => clearTimeout(t);
    }
  }, [fadeOut, onFinished]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{
        background: isDark
          ? 'linear-gradient(to bottom right, #0f0a18, #1a1025, #0f0a18)'
          : 'linear-gradient(to bottom right, #ffffff, rgb(250 245 255 / 0.5), rgb(243 232 255 / 0.3))',
      }}
    >
      {/* Logo */}
      {isDark ? (
        <img src="/images/logo-bco.png" alt="QEB" className="h-14 w-auto mb-8 animate-[pulse_2s_ease-in-out_infinite]" />
      ) : (
        <img src="/images/logo-ooh.png" alt="QEB" className="h-14 w-auto mb-8 animate-[pulse_2s_ease-in-out_infinite]" />
      )}

      {/* Progress bar */}
      <div className={`w-64 h-1 rounded-full overflow-hidden ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
        <div
          className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"
          style={{ backgroundSize: '200% 100%' }}
        />
      </div>

      {/* Text */}
      <p className={`mt-5 text-sm animate-pulse ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
        Preparando tu espacio de trabajo...
      </p>

      <style>{`
        @keyframes loading {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
