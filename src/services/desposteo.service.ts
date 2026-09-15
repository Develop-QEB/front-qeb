import { AxiosError } from 'axios';
import api from '../lib/api';

// Filtro Autorizacion "Quitar Posteo" — cliente HTTP.

export type EstatusDesposteo =
  | 'solicitado'
  | 'filtro_aprobado'
  | 'aprobado'
  | 'rechazado'
  | 'ejecutado';

export type TipoNota =
  | 'inicio'
  | 'ajuste'
  | 'aprobacion_gerente'
  | 'rechazo_gerente'
  | 'aprobacion_facturacion'
  | 'rechazo_facturacion'
  | 'ejecucion';

export interface SnapshotAPS {
  aps: number;
  campania_id: number;
  campania_nombre: string;
  cliente_nombre: string | null;
  razon_social: string | null;
  post_log_id: number | null;
  posted_at: string | null;
  doc_entry: number | null;
  doc_num: number | null;
  monto_estimado: number;
  circuitos: Array<{
    id: number;
    articulo: string | null;
    formato: string | null;
    ciudad: string | null;
    costo: number;
  }>;
}

export interface DesposteoSolicitud {
  id: number;
  campania_id: number;
  aps: number;
  post_log_id: number | null;
  snapshot_aps: string | null;
  estatus: EstatusDesposteo;
  solicitado_por_id: number;
  solicitado_por_nombre: string;
  filtro_gc_id: number | null;
  filtro_gc_nombre: string | null;
  filtro_gc_at: string | null;
  facturacion_id: number | null;
  facturacion_nombre: string | null;
  facturacion_at: string | null;
  ti_ejecutor_id: number | null;
  ti_ejecutor_nombre: string | null;
  ti_ejecutor_at: string | null;
  sin_autorizacion: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DesposteoNota {
  id: number;
  desposteo_id: number;
  usuario_id: number;
  usuario_nombre: string;
  tipo: TipoNota;
  nota: string;
  created_at: string;
}

export interface DesposteoDetalle {
  solicitud: DesposteoSolicitud;
  notas: DesposteoNota[];
}

export interface VerificarResult {
  ok: boolean;
  solicitudId?: number;
  motivo?: string;
}

function extractApiError(err: unknown, fallback: string): Error {
  if (err instanceof AxiosError) {
    const serverError = err.response?.data as { error?: string; detalles?: unknown } | undefined;
    if (serverError?.error) return new Error(serverError.error);
  }
  if (err instanceof Error) return err;
  return new Error(fallback);
}

export const desposteoService = {
  async solicitar(input: { campania_id: number; aps: number; nota: string }): Promise<DesposteoSolicitud> {
    try {
      const { data } = await api.post('/desposteo/solicitar', input);
      if (!data.success) throw new Error(data.error || 'Error al solicitar desposteo');
      return data.data as DesposteoSolicitud;
    } catch (err) {
      throw extractApiError(err, 'Error al solicitar desposteo');
    }
  },

  async listar(params: { campania_id?: number; estatus?: EstatusDesposteo; incluir_ejecutados?: boolean }): Promise<DesposteoSolicitud[]> {
    try {
      const q = new URLSearchParams();
      if (params.campania_id) q.set('campania_id', String(params.campania_id));
      if (params.estatus) q.set('estatus', params.estatus);
      if (params.incluir_ejecutados) q.set('incluir_ejecutados', '1');
      const { data } = await api.get(`/desposteo?${q.toString()}`);
      if (!data.success) throw new Error(data.error || 'Error al listar');
      return data.data as DesposteoSolicitud[];
    } catch (err) {
      throw extractApiError(err, 'Error al listar solicitudes de desposteo');
    }
  },

  async detalle(id: number): Promise<DesposteoDetalle> {
    try {
      const { data } = await api.get(`/desposteo/${id}`);
      if (!data.success) throw new Error(data.error || 'Error al obtener detalle');
      return data.data as DesposteoDetalle;
    } catch (err) {
      throw extractApiError(err, 'Error al obtener detalle de desposteo');
    }
  },

  async historial(campania_id: number, aps: number): Promise<DesposteoNota[]> {
    try {
      const { data } = await api.get(`/desposteo/historial?campania_id=${campania_id}&aps=${aps}`);
      if (!data.success) throw new Error(data.error || 'Error al obtener historial');
      return data.data as DesposteoNota[];
    } catch (err) {
      throw extractApiError(err, 'Error al obtener historial de notas');
    }
  },

  async verificar(campania_id: number, aps: number): Promise<VerificarResult> {
    try {
      const { data } = await api.get(`/desposteo/verificar?campania_id=${campania_id}&aps=${aps}`);
      if (!data.success) throw new Error(data.error || 'Error al verificar');
      return data.data as VerificarResult;
    } catch (err) {
      throw extractApiError(err, 'Error al verificar autorizacion de desposteo');
    }
  },

  async filtroAprobar(id: number, nota?: string): Promise<DesposteoSolicitud> {
    try {
      const { data } = await api.post(`/desposteo/${id}/filtro/aprobar`, { nota });
      if (!data.success) throw new Error(data.error || 'Error al aprobar filtro');
      return data.data as DesposteoSolicitud;
    } catch (err) {
      throw extractApiError(err, 'Error al aprobar filtro');
    }
  },

  async filtroRechazar(id: number, nota: string): Promise<DesposteoSolicitud> {
    try {
      const { data } = await api.post(`/desposteo/${id}/filtro/rechazar`, { nota });
      if (!data.success) throw new Error(data.error || 'Error al rechazar filtro');
      return data.data as DesposteoSolicitud;
    } catch (err) {
      throw extractApiError(err, 'Error al rechazar filtro');
    }
  },

  async aprobar(id: number, nota?: string): Promise<DesposteoSolicitud> {
    try {
      const { data } = await api.post(`/desposteo/${id}/aprobar`, { nota });
      if (!data.success) throw new Error(data.error || 'Error al aprobar');
      return data.data as DesposteoSolicitud;
    } catch (err) {
      throw extractApiError(err, 'Error al aprobar desposteo');
    }
  },

  async rechazar(id: number, nota: string): Promise<DesposteoSolicitud> {
    try {
      const { data } = await api.post(`/desposteo/${id}/rechazar`, { nota });
      if (!data.success) throw new Error(data.error || 'Error al rechazar');
      return data.data as DesposteoSolicitud;
    } catch (err) {
      throw extractApiError(err, 'Error al rechazar desposteo');
    }
  },
};

// Etiquetas legibles.
export const ESTATUS_LABEL: Record<EstatusDesposteo, string> = {
  solicitado: 'Solicitado',
  filtro_aprobado: 'En facturacion',
  aprobado: 'Aprobado (pendiente TI)',
  rechazado: 'Rechazado',
  ejecutado: 'Ejecutado',
};

export const TIPO_NOTA_LABEL: Record<TipoNota, string> = {
  inicio: 'Inicio',
  ajuste: 'Ajuste',
  aprobacion_gerente: 'Check gerente',
  rechazo_gerente: 'Rechazo gerente',
  aprobacion_facturacion: 'Aprobado facturacion',
  rechazo_facturacion: 'Rechazado facturacion',
  ejecucion: 'Ejecutado en SAP',
};

// Roles con permisos (deben coincidir con back).
const ROLES_SOLICITA = new Set([
  'Asesor Comercial',
  'Asesor Comercial Aeropuerto',
  'Administrador',
  'DEV',
]);
const ROLES_FILTRO_GC = new Set([
  'Gerente Comercial Vía Pública',
  'Gerente Comercial Via Publica',
  'Gerente Comercial Plazas',
  'Gerente Comercial (Plazas)',
  'Gerente Comercial',
  'Administrador',
  'DEV',
]);
const ROLES_FACTURACION = new Set([
  'Coordinador de Facturación y Cobranza',
  'Coordinador de Facturación',
  'Administrador',
  'DEV',
]);
const ROLES_BYPASS = new Set(['Administrador', 'DEV']);

export function puedeSolicitarDesposteo(rol?: string | null): boolean {
  return !!rol && ROLES_SOLICITA.has(rol);
}
export function puedeFiltrarDesposteo(rol?: string | null): boolean {
  return !!rol && ROLES_FILTRO_GC.has(rol);
}
export function puedeAprobarDesposteoFacturacion(rol?: string | null): boolean {
  return !!rol && ROLES_FACTURACION.has(rol);
}
export function puedeBypassearDesposteo(rol?: string | null): boolean {
  return !!rol && ROLES_BYPASS.has(rol);
}
