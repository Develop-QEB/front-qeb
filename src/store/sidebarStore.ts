import { create } from 'zustand';

interface SidebarState {
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

/**
 * Estado global del sidebar en mobile. En desktop (md+) el sidebar es fijo
 * y este estado no se usa: el toggle expand/collapse sigue viviendo en MainLayout.
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  mobileOpen: false,
  openMobile: () => set({ mobileOpen: true }),
  closeMobile: () => set({ mobileOpen: false }),
  toggleMobile: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
}));
