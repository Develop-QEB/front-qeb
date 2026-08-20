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
 * ocupación. Separada del toaster a propósito: el toast es opt-in por
 * preferencias y se cierra solo; un choque/duplicado de reservas es raro y
 * accionable, así que se muestra siempre a sus destinatarios y espera un clic.
 */
export const useConflictoAlertaStore = create<ConflictoAlertaState>((set) => ({
  alerta: null,
  show: (a) => set({ alerta: a }),
  dismiss: () => set({ alerta: null }),
}));
