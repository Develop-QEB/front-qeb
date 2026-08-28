import { create } from 'zustand';

export interface ConflictoAlerta {
  titulo: string;
  descripcion?: string;
  tareaId?: number;
}

interface ConflictoAlertaState {
  alerta: ConflictoAlerta | null;
  show: (a: ConflictoAlerta) => void;
  dismiss: () => void;
}

/**
 * Alerta modal (centro de pantalla) para notificaciones de conflictos de
 * ocupación. Separada del toaster a propósito: no pasa por las preferencias
 * de popup y espera un clic. Su único productor es useSocket, que decide el
 * ruteo (soft-launch: DEV → este modal; otros roles → toast persistente).
 */
export const useConflictoAlertaStore = create<ConflictoAlertaState>((set) => ({
  alerta: null,
  show: (a) => set({ alerta: a }),
  dismiss: () => set({ alerta: null }),
}));
