import * as React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CircuitCheckboxProps {
  checked: boolean;
  /** Estado intermedio (algunos seleccionados): muestra un guion en vez de palomita */
  indeterminate?: boolean;
  onChange: () => void;
  title?: string;
  className?: string;
  /** Útil cuando el checkbox vive dentro de un contenedor clickeable (header colapsable) */
  stopPropagation?: boolean;
}

/**
 * Checkbox compacto y estilizado para la selección masiva de circuitos en
 * solicitudes / propuestas / campañas. Reemplaza al input nativo (que se veía
 * grande y desentonaba con el tema oscuro) por una caja redondeada con palomita.
 */
export function CircuitCheckbox({
  checked,
  indeterminate = false,
  onChange,
  title,
  className,
  stopPropagation = false,
}: CircuitCheckboxProps) {
  const active = checked || indeterminate;
  return (
    <label
      className={cn('relative inline-flex items-center justify-center cursor-pointer shrink-0', className)}
      title={title}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          'flex h-[15px] w-[15px] items-center justify-center rounded-[5px] border transition-all duration-150',
          active
            ? 'border-red-500 bg-red-500'
            : 'border-zinc-400/60 bg-transparent hover:border-red-400 dark:border-zinc-500/60'
        )}
      >
        {indeterminate ? (
          <Minus className="h-3 w-3 text-white" strokeWidth={3} />
        ) : checked ? (
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        ) : null}
      </span>
    </label>
  );
}
