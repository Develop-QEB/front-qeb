import api from '../lib/api';
import { Propuesta, PaginatedResponse, ApiResponse } from '../types';

/** Pieza que el backend NO pudo reservar, con su motivo. Permite decirle al
 *  usuario exactamente qué falló en vez de solo un contador. */
export interface ReservaOmitida {
  inventario_id: number;
  codigo_unico: string | null;
  motivo: string;
}

export interface PropuestasParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  yearInicio?: number;
  yearFin?: number;
  catorcenaInicio?: number;
  catorcenaFin?: number;
  soloAtendidas?: boolean;
  tipoPeriodo?: string;
  cambioEstatusDesde?: string;
  cambioEstatusHasta?: string;
  creacionDesde?: string;
  creacionHasta?: string;
  // Nuevo filtro unificado (HistorialFilterPopover)
  modo?: 'creacion' | 'cambio_estatus';
  fechaDesde?: string;
  fechaHasta?: string;
  estatusValor?: string;
  excludeRechazadas?: boolean;
}

export interface PropuestaStats {
  total: number;
  byStatus: Record<string, number>;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

export interface PropuestaComentario {
  id: number;
  comentario: string;
  creado_en: string;
  autor_nombre: string;
  autor_foto?: string | null;
}

export interface ApproveParams {
  precio_simulado?: number;
  asignados?: string;
  id_asignados?: string;
}

export interface InventarioReservado {
  rsv_ids: string;
  id: number;
  codigo_unico: string;
  solicitud_caras_id: number | null;
  mueble: string | null;
  estado: string | null;
  municipio: string | null;
  ubicacion: string | null;
  tipo_de_cara: string | null;
  caras_totales: number;
  caras_bonificadas: number;
  caras_renta: number;
  latitud: number;
  longitud: number;
  plaza: string | null;
  estatus_reserva: string | null;
  articulo: string | null;
  tipo_medio: string | null;
  inicio_periodo: string | null;
  fin_periodo: string | null;
  tradicional_digital: string | null;
  tipo_de_mueble: string | null;
  ancho: number | null;
  alto: number | null;
  nivel_socioeconomico: string | null;
  tarifa_publica: number | null;
  tarifa_bruta_sc?: number | null; // tarifa publica SIN descuento (costo/caras) — para inversion bruta
  grupo_completo_id: number | null;
  numero_catorcena?: number | null;
  anio_catorcena?: number | null;
  formato?: string | null;
}

export interface PropuestaFullDetails {
  propuesta: Propuesta;
  solicitud: {
    id: number;
    cuic: string;
    cliente: string;
    razon_social: string;
    unidad_negocio: string;
    marca_nombre: string;
    asesor: string;
    agencia: string;
    producto_nombre: string;
    categoria_nombre: string;
  } | null;
  cotizacion: {
    id: number;
    nombre_campania: string;
    fecha_inicio: string;
    fecha_fin: string;
    numero_caras: number;
    bonificacion: number;
    precio: number;
  } | null;
  campania: {
    id: number;
    nombre: string;
    status: string;
  } | null;
  caras: {
    id: number;
    ciudad: string;
    estados: string;
    tipo: string;
    formato: string;
    caras: number;
    bonificacion: number;
    tarifa_publica: number;
    articulo: string;
    inicio_periodo: string;
    fin_periodo: string;
  }[];
}

export interface HistorialEntry {
  id: number;
  tipo: string;
  ref_id: number;
  accion: string;
  detalles: string | null;
  fecha_hora: string;
}

export const propuestasService = {
  async getAll(params: PropuestasParams = {}): Promise<PaginatedResponse<Propuesta>> {
    const response = await api.get<PaginatedResponse<Propuesta>>('/propuestas', { params });
    return response.data;
  },

  async getVersionarioData(params: Omit<PropuestasParams, 'soloAtendidas'> & { page?: number; limit?: number; lite?: boolean; propuestaIds?: string; exportLayout?: boolean } = {}): Promise<{
    inventarios: any[];
    propuestasInfo: any[];
    carasInfo: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    // exportLayout puede tardar (back hace batches internos), por eso timeout extendido.
    const timeout = params.exportLayout ? 180000 : 60000;
    const response = await api.get<ApiResponse<any>>('/propuestas/versionario', { params, timeout });
    return response.data.data;
  },

  async getById(id: number): Promise<Propuesta> {
    const response = await api.get<ApiResponse<Propuesta>>(`/propuestas/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener propuesta');
    }
    return response.data.data;
  },

  async updateStatus(id: number, status: string, comentario_cambio_status?: string): Promise<Propuesta> {
    const response = await api.patch<ApiResponse<Propuesta>>(`/propuestas/${id}/status`, {
      status,
      comentario_cambio_status
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar status');
    }
    return response.data.data;
  },

  async getStats(params: Omit<PropuestasParams, 'page' | 'limit' | 'soloAtendidas'> = {}): Promise<PropuestaStats> {
    const response = await api.get<ApiResponse<PropuestaStats>>('/propuestas/stats', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadisticas');
    }
    return response.data.data;
  },

  async getComments(id: number): Promise<PropuestaComentario[]> {
    const response = await api.get<ApiResponse<PropuestaComentario[]>>(`/propuestas/${id}/comments`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al obtener comentarios');
    }
    return response.data.data || [];
  },

  async addComment(id: number, comentario: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/propuestas/${id}/comments`, { comentario });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al agregar comentario');
    }
  },

  async approve(id: number, params: ApproveParams): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/propuestas/${id}/approve`, params);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al aprobar propuesta');
    }
  },

  async updateAsignados(id: number, asignados: string, id_asignados: string): Promise<Propuesta> {
    const response = await api.patch<ApiResponse<Propuesta>>(`/propuestas/${id}/asignados`, {
      asignados,
      id_asignados,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar asignados');
    }
    return response.data.data;
  },

  async getFullDetails(id: number): Promise<PropuestaFullDetails> {
    const response = await api.get<ApiResponse<PropuestaFullDetails>>(`/propuestas/${id}/full`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener detalles');
    }
    return response.data.data;
  },

  async getInventarioReservado(id: number): Promise<InventarioReservado[]> {
    const response = await api.get<ApiResponse<InventarioReservado[]>>(`/propuestas/${id}/inventario`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario');
    }
    return response.data.data;
  },

  async toggleReserva(
    propuestaId: number,
    data: {
      inventarioId: number;
      solicitudCaraId: number;
      clienteId: number;
      tipo: string;
      fechaInicio: string;
      fechaFin: string;
    }
  ): Promise<{ action: 'created' | 'deleted'; reserva?: any }> {
    const response = await api.post<ApiResponse<{ action: 'created' | 'deleted'; reserva?: any }>>(
      `/propuestas/${propuestaId}/reservas/toggle`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al cambiar reserva');
    }
    return response.data.data;
  },

  async createReservas(
    propuestaId: number,
    data: {
      reservas: Array<{
        inventario_id: number;
        tipo: string;
        latitud: number;
        longitud: number;
      }>;
      solicitudCaraId: number;
      clienteId: number;
      fechaInicio: string;
      fechaFin: string;
      agruparComoCompleto?: boolean;
    }
  ): Promise<{ calendarioId: number; reservasCreadas: number; reservasOmitidas?: number; omitidos?: ReservaOmitida[] }> {
    const response = await api.post<ApiResponse<{ calendarioId: number; reservasCreadas: number; reservasOmitidas?: number; omitidos?: ReservaOmitida[] }>>(
      `/propuestas/${propuestaId}/reservas`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear reservas');
    }
    return response.data.data;
  },

  async deleteReservas(propuestaId: number, reservaIds: number[]): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/propuestas/${propuestaId}/reservas`, {
      data: { reservaIds },
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar reservas');
    }
  },

  async getReservasForModal(propuestaId: number): Promise<ReservaModalItem[]> {
    const response = await api.get<ApiResponse<ReservaModalItem[]>>(`/propuestas/${propuestaId}/reservas-modal`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener reservas');
    }
    return response.data.data;
  },

  async updatePropuesta(
    id: number,
    data: {
      nombre_campania?: string;
      notas?: string;
      descripcion?: string;
      year_inicio?: number;
      catorcena_inicio?: number;
      year_fin?: number;
      catorcena_fin?: number;
      // Client fields
      cliente_id?: number;
      cuic?: number;
      razon_social?: string;
      unidad_negocio?: string;
      marca_id?: number;
      marca_nombre?: string;
      asesor?: string;
      producto_id?: number;
      producto_nombre?: string;
      agencia?: string;
      categoria_id?: number;
      categoria_nombre?: string;
      card_code?: string;
      salesperson_code?: number;
      sap_database?: string;
      IMU?: boolean;
    }
  ): Promise<Propuesta> {
    const response = await api.patch<ApiResponse<Propuesta>>(`/propuestas/${id}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar propuesta');
    }
    return response.data.data;
  },

  async uploadArchivo(propuestaId: number, file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('archivo', file);
    const response = await api.post<ApiResponse<{ url: string }>>(`/propuestas/${propuestaId}/archivo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al subir archivo');
    }
    return response.data.data;
  },

  async updateCara(propuestaId: number, caraId: number, data: CaraUpdateData): Promise<SolicitudCara> {
    const response = await api.patch<ApiResponse<SolicitudCara>>(`/propuestas/${propuestaId}/caras/${caraId}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar cara');
    }
    return response.data.data;
  },

  async bulkUpdateCaras(propuestaId: number, caras: { caraId: number; data: CaraUpdateData }[]): Promise<{ updated: SolicitudCara[]; message: string }> {
    const response = await api.patch<ApiResponse<SolicitudCara[]> & { message?: string }>(`/propuestas/${propuestaId}/caras/bulk`, { caras });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al actualizar caras en lote');
    }
    return { updated: response.data.data || [], message: response.data.message || '' };
  },

  async createCara(propuestaId: number, data: CaraUpdateData): Promise<SolicitudCara> {
    const response = await api.post<ApiResponse<SolicitudCara>>(`/propuestas/${propuestaId}/caras`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear cara');
    }
    return response.data.data;
  },

  async deleteCara(propuestaId: number, caraId: number, eliminarGrupo?: boolean): Promise<void> {
    const url = `/propuestas/${propuestaId}/caras/${caraId}${eliminarGrupo ? '?eliminarGrupo=true' : ''}`;
    const response = await api.delete<ApiResponse<void>>(url);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar cara');
    }
  },

  async getCaras(propuestaId: number): Promise<SolicitudCara[]> {
    const response = await api.get<ApiResponse<SolicitudCara[]>>(`/propuestas/${propuestaId}/caras`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener caras de propuesta');
    }
    return response.data.data;
  },

  async getHistorial(propuestaId: number): Promise<HistorialEntry[]> {
    const response = await api.get<ApiResponse<HistorialEntry[]>>(`/propuestas/${propuestaId}/historial`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener historial');
    }
    return response.data.data;
  },
};

export interface CaraUpdateData {
  ciudad?: string;
  estados?: string;
  tipo?: string;
  flujo?: string;
  bonificacion?: number;
  caras?: number;
  nivel_socioeconomico?: string;
  formato?: string;
  costo?: number;
  tarifa_publica?: number;
  inicio_periodo?: string;
  fin_periodo?: string;
  caras_flujo?: number;
  caras_contraflujo?: number;
  articulo?: string;
  descuento?: number;
  grupo_rt_bf?: number | null;
  // Si true, propaga este update a todas las caras del mismo grupo_masivo_id
  aplicarAGrupo?: boolean;
  // Solo para createCara desde el modal de edición: persiste la cara pero NO
  // dispara la autorización (ni contamina otras caras ni crea la tarea). La
  // autorización se genera al dar "Guardar Cambios" (bulkUpdateCaras).
  deferAuth?: boolean;
}

export interface SolicitudCara {
  id: number;
  idquote?: string;
  ciudad?: string;
  estados?: string;
  tipo?: string;
  flujo?: string;
  bonificacion?: number;
  caras: number;
  nivel_socioeconomico: string;
  formato: string;
  costo: number;
  tarifa_publica: number;
  inicio_periodo: string;
  fin_periodo: string;
  caras_flujo?: number;
  caras_contraflujo?: number;
  articulo?: string;
  descuento?: number;
  autorizacion_dg?: string;
  autorizacion_dcm?: string;
  grupo_rt_bf?: number | null;
}

export interface ReservaModalItem {
  reserva_id: number;
  espacio_id: number;
  inventario_id: number;
  codigo_unico: string;
  tipo_de_cara: string;
  latitud: number;
  longitud: number;
  plaza: string;
  formato: string;
  ubicacion: string | null;
  isla: string | null;
  estatus_inventario: string | null;
  estatus: string;
  grupo_completo_id: number | null;
  solicitud_cara_id: number;
  articulo: string | null;
}
