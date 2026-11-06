import * as React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propuestaStatus?: string;
}

/**
 * Modal informativo que se muestra cuando se intenta abrir el modal de
 * Asignar Inventario sobre una propuesta ya pasada a ventas.
 *
 * Caso Oral B 30-oct-2026: agregar caras a propuestas 'Aprobada' las
 * creaba en estatus 'Reservado' colgado, invisibles para los candados
 * anti-choque. Se bloquea la apertura y se redirige al modulo de Campanas.
 */
export function PropuestaAprobadaInfoModal({ isOpen, onClose, propuestaStatus }: Props) {
  // Handle ESC key
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-popover border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>

          <h3 className="text-lg font-semibold text-foreground text-center mb-3">
            No se puede editar esta propuesta
          </h3>

          <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              Esta propuesta ya pasó a ventas
              {propuestaStatus ? (
                <>
                  {' '}(<span className="text-foreground font-medium">{propuestaStatus}</span>)
                </>
              ) : null}
              .
            </p>
            <p>
              Si agregas caras desde aquí, el sistema las guardaría como{' '}
              <span className="text-amber-300 font-medium">Reservado</span> colgado,
              invisibles para los candados anti-choque. Fue lo que pasó con{' '}
              <span className="text-foreground font-medium">Oral B el 30-oct</span>.
            </p>
            <p>
              Para agregar circuitos a una campaña ya vendida, hazlo desde el{' '}
              <span className="text-foreground font-medium">módulo de Campañas</span> —
              ahí nacen como{' '}
              <span className="text-emerald-300 font-medium">Vendido</span> correctamente.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
