import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onFinished?: () => void;
  ready?: boolean;
}

export function LoadingScreen({ onFinished, ready }: LoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (ready) {
      // Small delay so animation feels intentional
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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1a1025] transition-opacity duration-500 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      {/* Logo */}
      <img
        src="/images/logo-bco.png"
        alt="QEB"
        className="h-14 w-auto mb-8 animate-[pulse_2s_ease-in-out_infinite]"
      />

      {/* Progress bar */}
      <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"
          style={{ backgroundSize: '200% 100%' }}
        />
      </div>

      {/* Text */}
      <p className="mt-5 text-sm text-zinc-500 animate-pulse">
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
