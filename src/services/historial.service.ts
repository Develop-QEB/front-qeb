import api from '../lib/api';

export interface HistorialEntry {
  id: number;
  tipo: string;
  ref_id: number;
  accion: string;
  fecha_hora: string;
  detalles: string | null;
}

export interface HistorialResponse {
  success: boolean;
  data: HistorialEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface HistorialFilters {
  page?: number;
  limit?: number;
  tipo?: string;
  accion?: string;
  usuario?: string;
  search?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  auditAdmin?: boolean; // solo DEV: filtra acciones de Administrador/DEV
}

export interface HistorialUsuario {
  id: number;
  nombre: string;
}

// Fila de `tareas` con tipo='Actividad Comercial' (tablero CRM del tab
// "Actividad Comercial" en Historial de Acciones).
export interface ActividadComercialTarea {
  id: number;
  titulo: string | null;
  descripcion: string | null;
  tipo: string | null;
  estatus: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  responsable: string | null;
  id_responsable: number;
  asignado: string | null;
  campania_id: number | null;
  id_propuesta: string | null;
  /** JSON del formulario: cliente, marca, subtipo, ref_id, anio, catorcena, estatus_actividad, base. */
  contenido: string | null;
  created_at: string | null;
  // Cuenta vinculada (campaña o propuesta), derivada en el back para filtrar.
  // null en actividades sobre leads sin campaña/propuesta.
  cuic?: string | null;
  asesor?: string | null;
  cliente_nombre?: string | null;
}

export type ColumnaActividadComercial = 'Abierto' | 'Activo' | 'Finalizado';

export const historialService = {
  async getAll(filters: HistorialFilters = {}): Promise<HistorialResponse> {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.tipo) params.set('tipo', filters.tipo);
    if (filters.accion) params.set('accion', filters.accion);
    if (filters.usuario) params.set('usuario', filters.usuario);
    if (filters.search) params.set('search', filters.search);
    if (filters.fechaDesde) params.set('fechaDesde', filters.fechaDesde);
    if (filters.fechaHasta) params.set('fechaHasta', filters.fechaHasta);
    if (filters.auditAdmin) params.set('audit_admin', 'true');

    const { data } = await api.get(`/historial?${params.toString()}`);
    return data;
  },

  async getTipos(): Promise<string[]> {
    const { data } = await api.get('/historial/tipos');
    return data.data;
  },

  async getAcciones(): Promise<{ label: string; value: string }[]> {
    const { data } = await api.get('/historial/acciones');
    return data.data;
  },

  async getUsuarios(): Promise<HistorialUsuario[]> {
    const { data } = await api.get('/historial/usuarios');
    return data.data;
  },

  // ---- Tablero CRM de Actividad Comercial ----
  async getActividadesComerciales(): Promise<ActividadComercialTarea[]> {
    const { data } = await api.get('/historial/actividad-comercial');
    if (!data.success) throw new Error(data.error || 'Error al obtener actividades comerciales');
    return data.data ?? [];
  },

  /** Mueve la actividad de columna (escribe tareas.estatus; Finalizado -> 'Atendido'). */
  async moverActividadComercial(id: number, columna: ColumnaActividadComercial): Promise<ActividadComercialTarea> {
    const { data } = await api.patch(`/historial/actividad-comercial/${id}/estatus`, { columna });
    if (!data.success) throw new Error(data.error || 'No se pudo mover la actividad');
    return data.data;
  },

  async addNota(input: {
    ref_id?: number;
    tipo: string;
    nota: string;
    fecha_entrega?: string;
    recordar_dias_antes?: number;
  }): Promise<HistorialEntry> {
    const { data } = await api.post('/historial/notas', input);
    return data.data;
  },
};
