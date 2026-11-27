import { create } from 'zustand';
import type { OrdenCircuito } from '../lib/solicitudPrefill';

/**
 * Puente entre QEBooh (chat) y los formularios de la app.
 *
 * - solicitudPendiente: el chat pidió abrir "Nueva solicitud" con un borrador
 *   prellenado. SolicitudesPage la abre al montarse (o al instante si ya está
 *   montada) y la consume para no reabrirla al volver a la página.
 * - circuitoPendiente: el chat pidió llenar el circuito en captura del formulario
 *   de solicitud abierto. El formulario la aplica y la consume.
 * - contextoFormulario: resumen en texto de lo que el usuario lleva capturado en
 *   el formulario abierto. El chat lo manda con cada pregunta para que QEBooh
 *   aconseje sobre lo que hay en pantalla. null = no hay formulario que compartir.
 */
interface QeboohPuente {
  solicitudPendiente: boolean;
  pedirNuevaSolicitud: () => void;
  consumirNuevaSolicitud: () => void;
  circuitoPendiente: OrdenCircuito | null;
  pedirCircuito: (orden: OrdenCircuito) => void;
  consumirCircuito: () => void;
  contextoFormulario: string | null;
  setContextoFormulario: (contexto: string | null) => void;
}

export const useQeboohStore = create<QeboohPuente>((set) => ({
  solicitudPendiente: false,
  pedirNuevaSolicitud: () => set({ solicitudPendiente: true }),
  consumirNuevaSolicitud: () => set({ solicitudPendiente: false }),
  circuitoPendiente: null,
  pedirCircuito: (orden) => set({ circuitoPendiente: orden }),
  consumirCircuito: () => set({ circuitoPendiente: null }),
  contextoFormulario: null,
  setContextoFormulario: (contexto) => set({ contextoFormulario: contexto }),
}));
