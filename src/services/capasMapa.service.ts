import api from '../lib/api';
import { ApiResponse } from '../types';
import type { CapaMapa, NuevaCapa } from '../features/propuestas/capasMapa';

// Capas de POI / poligonos KML por circuito. La version publica (solo
// visible_cliente) NO pasa por aqui: viaja dentro de GET /public/propuestas/:id.
export const capasMapaService = {
  /** Vista Compartir interna: todas las capas vivas de la propuesta. */
  async listarPorPropuesta(propuestaId: number): Promise<CapaMapa[]> {
    const response = await api.get<ApiResponse<CapaMapa[]>>(`/capas-mapa/propuesta/${propuestaId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al obtener capas');
    }
    return response.data.data ?? [];
  },

  async crear(input: NuevaCapa): Promise<CapaMapa> {
    const response = await api.post<ApiResponse<CapaMapa>>('/capas-mapa', input);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al guardar la capa');
    }
    return response.data.data;
  },

  async actualizar(id: number, patch: { nombre?: string; visibleCliente?: boolean }): Promise<CapaMapa> {
    const response = await api.patch<ApiResponse<CapaMapa>>(`/capas-mapa/${id}`, patch);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar la capa');
    }
    return response.data.data;
  },

  async eliminar(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<{ id: number }>>(`/capas-mapa/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar la capa');
    }
  },
};
