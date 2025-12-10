import api from '../lib/api';
import { Solicitud, SolicitudStats, PaginatedResponse, ApiResponse, Catorcena } from '../types';

export interface SolicitudesParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  yearInicio?: number;
  yearFin?: number;
  catorcenaInicio?: number;
  catorcenaFin?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  groupBy?: string;
}

export interface CatorcenasResponse {
  success: boolean;
  data: Catorcena[];
  years: number[];
}

export interface UserOption {
  id: number;
  nombre: string;
  area: string;
  puesto: string;
}

export interface InventarioFilters {
  estados: string[];
  ciudades: { ciudad: string; estado: string }[];
  formatos: string[];
  nse: string[];
}

export interface SolicitudCaraInput {
  ciudad: string;
  estado: string;
  tipo: string;
  flujo?: string;
  bonificacion?: number;
  caras: number;
  nivel_socioeconomico: string;
  formato: string;
  costo: number;
  tarifa_publica?: number;
  inicio_periodo: string;
  fin_periodo: string;
  caras_flujo?: number;
  caras_contraflujo?: number;
  descuento?: number;
}

export interface CreateSolicitudInput {
  // Client data
  cliente_id: number;
  cuic: number | string;
  razon_social: string;
  unidad_negocio?: string;
  marca_id?: number;
  marca_nombre?: string;
  asesor?: string;
  producto_id?: number;
  producto_nombre?: string;
  agencia?: string;
  categoria_id?: number;
  categoria_nombre?: string;
  // Campaign data
  nombre_campania: string;
  descripcion: string;
  notas?: string;
  presupuesto?: number;
  // Articulo
  articulo: string;
  // Asignados
  asignados: { id: number; nombre: string }[];
  // Dates
  fecha_inicio: string;
  fecha_fin: string;
  // File
  archivo?: string;
  tipo_archivo?: string;
  // IMU
  IMU: boolean;
  // Caras
  caras: SolicitudCaraInput[];
}

export const solicitudesService = {
  async getAll(params: SolicitudesParams = {}): Promise<PaginatedResponse<Solicitud>> {
    const response = await api.get<PaginatedResponse<Solicitud>>('/solicitudes', { params });
    return response.data;
  },

  async getById(id: number): Promise<Solicitud> {
    const response = await api.get<ApiResponse<Solicitud>>(`/solicitudes/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener solicitud');
    }
    return response.data.data;
  },

  async updateStatus(id: number, status: string): Promise<Solicitud> {
    const response = await api.patch<ApiResponse<Solicitud>>(`/solicitudes/${id}/status`, { status });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar status');
    }
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<null>>(`/solicitudes/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar solicitud');
    }
  },

  async getStats(params: { yearInicio?: number; yearFin?: number; catorcenaInicio?: number; catorcenaFin?: number } = {}): Promise<SolicitudStats> {
    const response = await api.get<ApiResponse<SolicitudStats>>('/solicitudes/stats', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadisticas');
    }
    return response.data.data;
  },

  async getCatorcenas(year?: number): Promise<CatorcenasResponse> {
    const response = await api.get<CatorcenasResponse>('/solicitudes/catorcenas', {
      params: year ? { year } : {}
    });
    return response.data;
  },

  async exportAll(params: Omit<SolicitudesParams, 'page' | 'limit'> = {}): Promise<Solicitud[]> {
    const response = await api.get<ApiResponse<Solicitud[]>>('/solicitudes/export', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al exportar solicitudes');
    }
    return response.data.data;
  },

  async getUsers(area?: string): Promise<UserOption[]> {
    const response = await api.get<ApiResponse<UserOption[]>>('/solicitudes/users', {
      params: area ? { area } : {},
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener usuarios');
    }
    return response.data.data;
  },

  async getInventarioFilters(): Promise<InventarioFilters> {
    const response = await api.get<ApiResponse<InventarioFilters>>('/solicitudes/inventario-filters');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener filtros de inventario');
    }
    return response.data.data;
  },

  async getFormatosByCiudades(ciudades: string[]): Promise<string[]> {
    if (ciudades.length === 0) return [];
    const response = await api.get<ApiResponse<string[]>>('/solicitudes/formatos-by-ciudades', {
      params: { ciudades: ciudades.join(',') },
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener formatos');
    }
    return response.data.data;
  },

  async getNextId(): Promise<number> {
    const response = await api.get<ApiResponse<{ nextId: number }>>('/solicitudes/next-id');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener próximo ID');
    }
    return response.data.data.nextId;
  },

  async create(data: CreateSolicitudInput): Promise<{ solicitud: Solicitud }> {
    const response = await api.post<ApiResponse<{ solicitud: Solicitud }>>('/solicitudes', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear solicitud');
    }
    return response.data.data;
  },

  async update(id: number, data: CreateSolicitudInput): Promise<void> {
    const response = await api.put<ApiResponse<void>>(`/solicitudes/${id}`, data);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al actualizar solicitud');
    }
  },

  async getFullDetails(id: number): Promise<SolicitudFullDetails> {
    const response = await api.get<ApiResponse<SolicitudFullDetails>>(`/solicitudes/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener detalles de solicitud');
    }
    return response.data.data;
  },

  async atender(id: number): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/solicitudes/${id}/atender`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al atender solicitud');
    }
  },

  async getComments(id: number): Promise<Comentario[]> {
    const response = await api.get<ApiResponse<Comentario[]>>(`/solicitudes/${id}/comments`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener comentarios');
    }
    return response.data.data;
  },

  async addComment(id: number, comentario: string): Promise<Comentario> {
    const response = await api.post<ApiResponse<Comentario>>(`/solicitudes/${id}/comments`, { comentario });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al agregar comentario');
    }
    return response.data.data;
  },
};

// Types for full details
export interface SolicitudCara {
  id: number;
  idquote: string;
  ciudad: string;
  estados: string;
  tipo: string;
  flujo: string;
  bonificacion: number;
  caras: number;
  nivel_socioeconomico: string;
  formato: string;
  costo: number;
  tarifa_publica: number;
  inicio_periodo: string;
  fin_periodo: string;
  caras_flujo: number;
  caras_contraflujo: number;
  articulo: string;
  descuento: number;
}

export interface Comentario {
  id: number;
  autor_id: number;
  autor_nombre: string;
  comentario: string;
  creado_en: string;
  campania_id: number;
  solicitud_id: number;
}

export interface Historial {
  id: number;
  tipo: string;
  ref_id: number;
  accion: string;
  fecha_hora: string;
  detalles: string;
}

export interface SolicitudFullDetails {
  solicitud: Solicitud;
  propuesta: {
    id: number;
    cliente_id: number;
    fecha: string;
    status: string;
    descripcion: string;
    notas: string;
    solicitud_id: number;
    asignado: string;
    id_asignado: string;
    inversion: number;
    articulo: string;
  } | null;
  cotizacion: {
    id: number;
    nombre_campania: string;
    numero_caras: number;
    fecha_inicio: string;
    fecha_fin: string;
    frontal: number;
    cruzada: number;
    nivel_socioeconomico: string;
    bonificacion: number;
    precio: number;
    articulo: string;
  } | null;
  campania: {
    id: number;
    nombre: string;
    fecha_inicio: string;
    fecha_fin: string;
    total_caras: string;
    bonificacion: number;
    status: string;
    articulo: string;
  } | null;
  caras: SolicitudCara[];
  comentarios: Comentario[];
  historial: Historial[];
}
