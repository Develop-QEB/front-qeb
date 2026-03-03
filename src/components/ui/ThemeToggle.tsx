import { useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  // Keep DOM class in sync with state
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2.5 rounded-full border shadow-lg backdrop-blur-sm transition-colors cursor-pointer ${
        isDark
          ? 'bg-zinc-800/80 border-purple-500/20 hover:bg-purple-900/30'
          : 'bg-white/80 border-purple-200/50 hover:bg-purple-50'
      }`}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5 text-purple-600" />
      )}
    </button>
  );
}
