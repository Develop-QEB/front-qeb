import { create } from 'zustand';

interface ModalState {
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
}

export const useModalStore = create<ModalState>((set) => ({
  activeModal: null,
  setActiveModal: (modal) => set({ activeModal: modal }),
}));
