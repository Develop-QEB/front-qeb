import { create } from 'zustand';

export interface NotifToast {
  id: number;
  titulo: string;
  descripcion?: string;
  tareaId?: number;
  tipo?: string;
  /** Recordatorios: no se cierran solos hasta que el usuario los cierre. */
  requireInteraction?: boolean;
}

let counter = 0;

interface NotifToastState {
  toasts: NotifToast[];
  push: (t: Omit<NotifToast, 'id'>) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

/**
 * Toasts de notificación in-app (sin depender del navegador). El hook de socket
 * empuja aquí cuando llega una notificación dirigida al usuario y el toaster
 * global (montado en MainLayout) los renderiza.
 */
export const useNotifToastStore = create<NotifToastState>((set) => ({
  toasts: [],
  push: (t) =>
    set((s) => {
      const id = ++counter;
      // Máximo 4 visibles a la vez (se conservan los más recientes).
      return { toasts: [...s.toasts, { ...t, id }].slice(-4) };
    }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
