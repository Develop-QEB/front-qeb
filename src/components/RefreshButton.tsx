import { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

// Botón "Actualizar": vuelve a pedir los datos de la vista SIN recargar la
// página. Invalida las queries de React Query (todas las activas, o solo las
// de `queryKeys` si se pasan) y espera a que terminen de refetchear; mientras
// tanto el icono gira. `onRefresh` permite limpiar cachés que no viven en
// React Query (p.ej. los inventarios por campaña que carga CampanasPage a
// mano) para que también se vuelvan a pedir.

interface RefreshButtonProps {
  isDark: boolean;
  /** Prefijos de queryKey a invalidar. Sin esto, invalida todas las queries activas. */
  queryKeys?: QueryKey[];
  /** Limpieza extra antes de refetchear (cachés fuera de React Query). */
  onRefresh?: () => void | Promise<void>;
  /** 'toolbar' = mismo tamaño que el botón Filtros de los listados; 'compact' = chip pequeño de cabecera. */
  variant?: 'toolbar' | 'compact';
  /** Texto del botón; '' deja solo el icono. */
  label?: string;
  className?: string;
}

function horaCorta(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export function RefreshButton({
  isDark,
  queryKeys,
  onRefresh,
  variant = 'toolbar',
  label = 'Actualizar',
  className = '',
}: RefreshButtonProps) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [ultima, setUltima] = useState<number | null>(null);

  const handleClick = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh?.();
      if (queryKeys && queryKeys.length > 0) {
        await Promise.all(queryKeys.map(k => queryClient.invalidateQueries({ queryKey: k })));
      } else {
        await queryClient.invalidateQueries();
      }
      setUltima(Date.now());
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, onRefresh, queryKeys, queryClient]);

  const base = variant === 'toolbar'
    ? 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all'
    : 'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs border transition-all';
  const colores = isDark
    ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200'
    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-900';
  const iconCls = variant === 'toolbar' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={refreshing}
      title={`Actualizar la vista sin recargar la página${ultima ? ` · última actualización ${horaCorta(ultima)}` : ''}`}
      aria-label="Actualizar vista"
      className={`${base} ${colores} ${refreshing ? 'opacity-70 cursor-wait' : ''} ${className}`}
    >
      <RefreshCw className={`${iconCls} ${refreshing ? 'animate-spin' : ''}`} />
      {label && <span>{refreshing ? 'Actualizando...' : label}</span>}
    </button>
  );
}
