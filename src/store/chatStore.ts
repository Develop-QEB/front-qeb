import { create } from 'zustand';

interface ChatState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Estado global del chat QEBooh. Se controla desde el boton del header
 * (no hay burbuja flotante). La ventana del chat lee isOpen de aqui.
 */
export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
