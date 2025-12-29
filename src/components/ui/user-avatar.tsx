import { cn } from '../../lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const STATIC_URL = API_URL.replace(/\/api$/, '');

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-4 h-4 text-[8px]',
  sm: 'w-5 h-5 text-[9px]',
  md: 'w-6 h-6 text-[10px]',
  lg: 'w-8 h-8 text-xs',
  xl: 'w-9 h-9 text-sm',
};

interface UserAvatarProps {
  nombre?: string | null;
  foto_perfil?: string | null;
  size?: AvatarSize;
  className?: string;
}

export function UserAvatar({ nombre, foto_perfil, size = 'md', className }: UserAvatarProps) {
  const initial = nombre?.charAt(0)?.toUpperCase() || 'U';
  const sizeClass = sizeClasses[size];

  if (foto_perfil) {
    return (
      <img
        src={`${STATIC_URL}${foto_perfil}`}
        alt={nombre || 'Usuario'}
        className={cn(
          'rounded-full object-cover flex-shrink-0',
          sizeClass,
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-medium flex-shrink-0',
        sizeClass,
        className
      )}
    >
      {initial}
    </div>
  );
}
