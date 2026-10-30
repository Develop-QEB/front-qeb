import api from '../lib/api';

export interface HistorialEntry {
  id: number;
  tipo: string;
  ref_id: number;
  accion: string;
  fecha_hora: string;
  detalles: string | null;
  // Clasificacion en los tres ejes de la taxonomia. La calcula el back
  // (utils/historialTaxonomia.ts) para que el front solo pinte.
  etapa: string;
  modulo: string;
  categoria: string;
}

export interface HistorialResponse {
  success: boolean;
  data: HistorialEntry[];
  /** verTodo=false -> el back recorto la vista a lo del propio usuario. */
  visibilidad?: { verTodo: boolean };
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
  // Multiselect: viajan como parametro repetido (?tipo=a&tipo=b). El back
  // los combina en OR entre si y en AND con el resto de los filtros.
  tipo?: string[];
  accion?: string[];
  usuario?: string[];
  etapa?: string[];
  modulo?: string[];
  categoria?: string[];
  search?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  auditAdmin?: boolean; // solo DEV: filtra acciones de Administrador/DEV
}

export interface HistorialUsuario {
  id: number;
  nombre: string;
}

/** Opcion de los dropdowns de Modulo / Tipo de accion. `grupo` es el encabezado de seccion. */
export interface OpcionTaxonomia {
  value: string;
  label: string;
  grupo: string;
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
    for (const t of filters.tipo ?? []) params.append('tipo', t);
    for (const a of filters.accion ?? []) params.append('accion', a);
    for (const u of filters.usuario ?? []) params.append('usuario', u);
    for (const e of filters.etapa ?? []) params.append('etapa', e);
    for (const m of filters.modulo ?? []) params.append('modulo', m);
    for (const c of filters.categoria ?? []) params.append('categoria', c);
    if (filters.search) params.set('search', filters.search);
    if (filters.fechaDesde) params.set('fechaDesde', filters.fechaDesde);
    if (filters.fechaHasta) params.set('fechaHasta', filters.fechaHasta);
    if (filters.auditAdmin) params.set('audit_admin', 'true');

    const { data } = await api.get(`/historial?${params.toString()}`);
    return data;
  },

  // Listas de clasificacion. Son estaticas en el back (no consultan la BD),
  // asi que se pueden cachear agresivamente.
  async getEtapas(): Promise<OpcionTaxonomia[]> {
    const { data } = await api.get('/historial/etapas');
    return data.data;
  },

  async getModulos(): Promise<OpcionTaxonomia[]> {
    const { data } = await api.get('/historial/modulos');
    return data.data;
  },

  async getCategorias(): Promise<OpcionTaxonomia[]> {
    const { data } = await api.get('/historial/categorias');
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
