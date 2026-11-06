import * as React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propuestaStatus?: string;
}

/**
 * Modal informativo que se muestra cuando se intenta abrir el modal de
 * Asignar Inventario sobre una propuesta ya pasada a ventas.
 * Mismo patron visual que ConfirmModal (bg-popover, border-border, rounded-xl).
 */
export function PropuestaAprobadaInfoModal({ isOpen, onClose, propuestaStatus }: Props) {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-popover border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4', 'bg-yellow-500/20')}>
            <AlertTriangle className={cn('h-6 w-6', 'text-yellow-400')} />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-foreground text-center mb-2">
            No se puede editar esta propuesta
          </h3>

          {/* Message */}
          <p className="text-sm text-muted-foreground text-center mb-6">
            Esta propuesta ya pasó a ventas
            {propuestaStatus ? (
              <>
                {' '}(<span className="text-foreground font-medium">{propuestaStatus}</span>)
              </>
            ) : null}
            . Para agregar circuitos a una campaña ya vendida, hazlo desde el módulo de Campañas.
          </p>

          {/* Button */}
          <div className="flex">
            <Button className="flex-1" onClick={onClose}>
              Entendido
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
