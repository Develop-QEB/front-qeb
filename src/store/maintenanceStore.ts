import { create } from 'zustand';

// Modo mantenimiento global. Se activa cuando el back devuelve 503 con
// code='MAINTENANCE'. Renderea un overlay no cerrable encima de toda la app.
interface MaintenanceState {
  isInMaintenance: boolean;
  motivo: string | null;
  setMaintenance: (motivo: string | null) => void;
  clear: () => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  isInMaintenance: false,
  motivo: null,
  setMaintenance: (motivo) => set({ isInMaintenance: true, motivo }),
  clear: () => set({ isInMaintenance: false, motivo: null }),
}));
