import api from '../lib/api';
import { Inventario, InventarioMapItem, InventarioStats, PaginatedResponse, ApiResponse } from '../types';

export interface AccionInventario {
  id: number;
  inventario_id: number;
  accion: string;
  detalles: string | null;
  usuario_nombre: string | null;
  fecha: string;
}

export interface BulkCreateResult {
  insertados: number;
  duplicados: number;
  actualizados?: number;
  duplicados_ocupados?: number;
  errores: { fila: number; campo: string; mensaje: string }[];
  total: number;
}

export interface BulkCheckItem {
  codigo_unico: string;
  estatus: string | null;
  estatus_real: string | null;
  id: number | null;
  campana?: string;
}

export interface BulkCheckResult {
  nuevos: string[];
  sobreescribibles: BulkCheckItem[];
  ocupados: BulkCheckItem[];
}

export interface InventariosParams {
  page?: number;
  limit?: number;
  search?: string;
  tipo?: string;
  estatus?: string;
  plaza?: string;
  cto?: string;
  campanaId?: number;
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
  excluir_categoria?: string;
  excluir_distancia_km?: number;
  excluir_mi_macro?: string | number;
  // Modo de exclusión por categoría: 'distancia' (Haversine, default),
  // 'contracara' (misma estructura con la categoría en la otra cara) o 'ambas'.
  excluir_modo?: 'distancia' | 'contracara' | 'ambas';
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

  async downloadCSV(
    params: Pick<InventariosParams, 'search' | 'tipo' | 'estatus' | 'plaza'> & { ids?: number[] } = {}
  ): Promise<void> {
    const { ids, ...filters } = params;
    // Si hay ids, ignorar filtros y mandar solo esos
    const queryParams = ids && ids.length > 0
      ? { ids: ids.join(',') }
      : filters;
    const response = await api.get('/inventarios/download/csv', { params: queryParams, responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = ids && ids.length > 0 ? `inventario_seleccionados_${ids.length}.csv` : 'inventario.csv';
    a.click();
    URL.revokeObjectURL(url);
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

  async getStats(params?: {
    search?: string;
    tipo?: string;
    estatus?: string;
    plaza?: string;
    campanaId?: number;
  }): Promise<InventarioStats> {
    const response = await api.get<ApiResponse<InventarioStats>>('/inventarios/stats', { params });
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

  async getCtos(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/ctos');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener CTOs');
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
      instalado: number;
      APS: number | null;
      grupo_completo_id: number | null;
      posted: number;
      inicio_periodo: string;
      fin_periodo: string;
      tipo_medio: string;
      articulo: string | null;
      propuesta_id: number;
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
        instalado: number;
        APS: number | null;
        grupo_completo_id: number | null;
        posted: number;
        inicio_periodo: string;
        fin_periodo: string;
        tipo_medio: string;
        articulo: string | null;
        propuesta_id: number;
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

  async getAcciones(id: number): Promise<AccionInventario[]> {
    const response = await api.get<ApiResponse<AccionInventario[]>>(`/inventarios/${id}/acciones`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener acciones');
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

  // Bulk check inventarios against DB
  // `expandir`: devuelve TODOS los inventarios por codigo_unico (p.ej. cara
  // Tradicional + Digital). Por defecto se conserva uno (compat. importación CSV).
  async bulkCheck(codigos: string[], expandir = false): Promise<BulkCheckResult> {
    const response = await api.post<ApiResponse<BulkCheckResult>>('/inventarios/bulk-check', { codigos, expandir });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al verificar inventarios');
    }
    return response.data.data;
  },

  // Bulk create inventarios from CSV
  async bulkCreate(inventarios: Record<string, unknown>[], overwrite_codigos?: string[]): Promise<BulkCreateResult> {
    const response = await api.post<ApiResponse<BulkCreateResult>>('/inventarios/bulk', { inventarios, overwrite_codigos });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear inventarios masivamente');
    }
    return response.data.data;
  },

  // Create inventario
  async create(data: Record<string, unknown>): Promise<Inventario> {
    const response = await api.post<ApiResponse<Inventario>>('/inventarios', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear inventario');
    }
    return response.data.data;
  },

  // Update inventario
  async update(id: number, data: Record<string, unknown>): Promise<Inventario> {
    const response = await api.put<ApiResponse<Inventario>>(`/inventarios/${id}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar inventario');
    }
    return response.data.data;
  },

  // Get distinct client categories
  async getCategoriasCliente(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/categorias-cliente');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener categorías');
    }
    return response.data.data;
  },

  // Toggle block/unblock
  async toggleBlock(id: number): Promise<Inventario> {
    const response = await api.patch<ApiResponse<Inventario>>(`/inventarios/${id}/toggle-block`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al bloquear/desbloquear inventario');
    }
    return response.data.data;
  },

  // Verificar lista de códigos del CSV contra el inventario para una cara/periodo:
  // devuelve por código su estado real (libre / ya_reservado_para_cara / ocupado / no_existe)
  // y un mensaje en lenguaje claro listo para mostrar al usuario.
  async checkCodigos(params: {
    codigos: string[];
    solicitudCaraId: number | null;
    fechaInicio: string;
    fechaFin: string;
  }): Promise<{
    codigos: Array<{
      codigo_unico: string;
      estado: 'libre' | 'ya_reservado_para_cara' | 'ocupado' | 'no_existe';
      mensaje: string;
    }>;
  }> {
    const response = await api.post<ApiResponse<{
      codigos: Array<{
        codigo_unico: string;
        estado: 'libre' | 'ya_reservado_para_cara' | 'ocupado' | 'no_existe';
        mensaje: string;
      }>;
    }>>('/inventarios/check-codigos', params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al verificar códigos');
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
