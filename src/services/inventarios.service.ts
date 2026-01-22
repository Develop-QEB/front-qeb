import api from '../lib/api';
import { Inventario, InventarioMapItem, InventarioStats, PaginatedResponse, ApiResponse } from '../types';

export interface InventariosParams {
  page?: number;
  limit?: number;
  search?: string;
  tipo?: string;
  estatus?: string;
  plaza?: string;
}

export interface DisponiblesParams {
  ciudad?: string;
  estado?: string;
  formato?: string;
  flujo?: string;
  nse?: string;
  tipo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  solicitudCaraId?: number;
}

export interface InventarioDisponible extends Inventario {
  espacios: { id: number; inventario_id: number; numero_espacio: number }[];
  espacios_count: number;
  ya_reservado_para_cara: boolean;
  espacio_id: number | null;  // ID del espacio específico (para digitales)
  numero_espacio: number | null;  // Número del espacio (ej: 1 de 13)
}

export interface DisponiblesResponse {
  success: boolean;
  data: InventarioDisponible[];
  total: number;
  filtros_aplicados: DisponiblesParams;
}

export const inventariosService = {
  async getAll(params: InventariosParams = {}): Promise<PaginatedResponse<Inventario>> {
    const response = await api.get<PaginatedResponse<Inventario>>('/inventarios', { params });
    return response.data;
  },

  async getForMap(params: { tipo?: string; estatus?: string; plaza?: string } = {}): Promise<InventarioMapItem[]> {
    const response = await api.get<ApiResponse<InventarioMapItem[]>>('/inventarios/map', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventarios para mapa');
    }
    return response.data.data;
  },

  async getById(id: number): Promise<Inventario> {
    const response = await api.get<ApiResponse<Inventario>>(`/inventarios/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario');
    }
    return response.data.data;
  },

  async getStats(): Promise<InventarioStats> {
    const response = await api.get<ApiResponse<InventarioStats>>('/inventarios/stats');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadisticas');
    }
    return response.data.data;
  },

  async getTipos(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/tipos');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener tipos');
    }
    return response.data.data;
  },

  async getPlazas(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/plazas');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener plazas');
    }
    return response.data.data;
  },

  async getEstatus(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/estatus');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estatus');
    }
    return response.data.data;
  },

  async getDisponibles(params: DisponiblesParams = {}): Promise<DisponiblesResponse> {
    const response = await api.get<DisponiblesResponse>('/inventarios/disponibles', { params });
    return response.data;
  },

  async getEstados(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/estados');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estados');
    }
    return response.data.data;
  },

  async getCiudadesByEstado(estado?: string): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/ciudades', {
      params: estado ? { estado } : {}
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener ciudades');
    }
    return response.data.data;
  },

  async getFormatosByCiudad(ciudad?: string): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/formatos', {
      params: ciudad ? { ciudad } : {}
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener formatos');
    }
    return response.data.data;
  },

  async getNSE(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/nse');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener NSE');
    }
    return response.data.data;
  },

  async getHistorial(id: number): Promise<{
    inventario: {
      id: number;
      codigo_unico: string;
      ubicacion: string;
      mueble: string;
      plaza: string;
      estado: string;
      tipo_de_cara: string;
      tradicional_digital: string;
      latitud: number;
      longitud: number;
      ancho: number;
      alto: number;
    };
    historial: Array<{
      reserva_id: number;
      reserva_estatus: string;
      archivo: string | null;
      arte_aprobado: string | null;
      fecha_reserva: string;
      instalado: boolean;
      APS: number | null;
      inicio_periodo: string;
      fin_periodo: string;
      tipo_medio: string;
      campana_id: number;
      campana_nombre: string;
      cliente_nombre: string;
      numero_catorcena: number;
      anio_catorcena: number;
    }>;
  }> {
    const response = await api.get<ApiResponse<{
      inventario: {
        id: number;
        codigo_unico: string;
        ubicacion: string;
        mueble: string;
        plaza: string;
        estado: string;
        tipo_de_cara: string;
        tradicional_digital: string;
        latitud: number;
        longitud: number;
        ancho: number;
        alto: number;
      };
      historial: Array<{
        reserva_id: number;
        reserva_estatus: string;
        archivo: string | null;
        arte_aprobado: string | null;
        fecha_reserva: string;
        instalado: boolean;
        APS: number | null;
        inicio_periodo: string;
        fin_periodo: string;
        tipo_medio: string;
        campana_id: number;
        campana_nombre: string;
        cliente_nombre: string;
        numero_catorcena: number;
        anio_catorcena: number;
      }>;
    }>>(`/inventarios/${id}/historial`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener historial');
    }
    return response.data.data;
  },

  // Poblar espacios de inventarios digitales
  async poblarEspacios(): Promise<{
    inventarios_procesados: number;
    espacios_creados: number;
    detalle: Array<{ id: number; codigo: string; tipo: string; espacios: number }>;
  }> {
    const response = await api.post<ApiResponse<{
      inventarios_procesados: number;
      espacios_creados: number;
      detalle: Array<{ id: number; codigo: string; tipo: string; espacios: number }>;
    }>>('/inventarios/espacios/poblar');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al poblar espacios');
    }
    return response.data.data;
  },

  // Obtener espacios disponibles de un inventario
  async getEspaciosDisponibles(inventarioId: number, params: {
    fecha_inicio?: string;
    fecha_fin?: string;
    solicitudCaraId?: number;
  } = {}): Promise<{
    total_espacios: number;
    disponibles: number;
    reservados: number;
    espacios: Array<{ id: number; inventario_id: number; numero_espacio: number; disponible: boolean }>;
  }> {
    const response = await api.get<ApiResponse<{
      total_espacios: number;
      disponibles: number;
      reservados: number;
      espacios: Array<{ id: number; inventario_id: number; numero_espacio: number; disponible: boolean }>;
    }>>(`/inventarios/${inventarioId}/espacios`, { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener espacios');
    }
    return response.data.data;
  },
};
