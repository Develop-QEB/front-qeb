import api from '../lib/api';

// =============================================================================
// AuditSummary — KPIs comprehensivos agrupados por categoría
// =============================================================================
export interface AuditSummary {
  kpis: {
    // Generales
    total_reservas: number;
    catorcenas_activas: number;
    total_inventarios: number;
    // Duplicación
    patsa_style: number;
    cross_cam_fisico: number;
    inv_duplicados: number;
    cod_reutilizado: number;
    // Integridad
    huerfanas: number;
    zombies_ei: number;
    cal_invertido: number;
    cal_cero: number;
    ei_duplicado: number;
    // Status
    cliente_desalineado: number;
    cam_inactiva_con_reservas: number;
    // Inv sucio
    inv_sucio: number;
    // APS
    aps_multi_cam: number;
    aps_multi_cliente: number;
    // Clientes
    marca_clientes_dup: number;
  };
}

export interface AuditDuplicadoGroup {
  inventario_id: number;
  codigo_unico: string | null;
  tipo_de_cara: string | null;
  plaza: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  veces: number;
  cam_id: number | null;
  cam_nombre: string | null;
  cliente: string | null;
  articulo: string | null;
  rv_ids: string;
  aps: string | null;
}

export interface AuditHuerfanoRow {
  reserva_id: number;
  inventario_id: number;
  codigo_unico: string | null;
  plaza: string | null;
  cliente_id: number;
  cliente_nombre: string | null;
  solicitudCaras_id: number;
  sc_id: number | null;
  propuesta_id_text: string | null;
  propuesta_id_resolved: number | null;
  propuesta_status: string | null;
  propuesta_deleted: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  motivo: string;
}

export interface AuditPorCatorcenaRow {
  fecha_inicio: string;
  fecha_fin: string;
  total_reservas: number;
  inventarios_unicos: number;
  clientes_unicos: number;
  propuestas_unicas: number;
  grupos_duplicados: number;
}

export interface AuditPorClienteRow {
  cliente_id: number;
  razon_social: string | null;
  marca: string | null;
  asesor: string | null;
  total_reservas: number;
  inventarios_unicos: number;
  propuestas_unicas: number;
  campanias_unicas: number;
}

export interface AuditPorVendedorRow {
  asesor: string;
  total_reservas: number;
  clientes_unicos: number;
  propuestas_unicas: number;
  campanias_unicas: number;
}

export interface AuditInvDuplicadoRow {
  codigo: string | null;
  cara: string | null;
  plaza: string | null;
  latitud: number | null;
  longitud: number | null;
  n_inv: number;
  inv_ids: string;
  codigos_unicos: string;
  ubicaciones: string;
  reservas_totales: number;
}

export interface AuditClienteDesalineadoRow {
  propuesta_id: number;
  propuesta_status: string | null;
  cam_id: number | null;
  cam_nombre: string | null;
  cam_status: string | null;
  solicitud_cliente_id: number | null;
  propuesta_cliente_id: number | null;
  cam_cliente_id: number | null;
  sol_card_code: string | null;
  cli_card_code: string | null;
  sol_razon_social: string | null;
  cli_razon_social: string | null;
  cuic_cotizacion: number | null;
  cuic_cliente: string | null;
  motivos: string;
}

export interface AuditStatusRaroRow {
  cam_id: number;
  cam_nombre: string | null;
  cam_status: string | null;
  prop_status: string | null;
  prop_deleted: string | null;
  reservas_activas: number;
  motivo: string;
}

export interface AuditInvSucioRow {
  inv_id: number;
  codigo_unico: string | null;
  codigo: string | null;
  tipo_de_cara: string | null;
  plaza: string | null;
  mueble: string | null;
  motivo: string;
}

export interface AuditReservasSuciasRow {
  reserva_id: number;
  inventario_id: number;
  cliente_id: number | null;
  cam_nombre: string | null;
  sc_inicio: string | null;
  sc_fin: string | null;
  cal_inicio: string | null;
  cal_fin: string | null;
  estatus: string | null;
  APS: string | null;
  motivo: string;
}

export interface AuditCrossCamFisicoRow {
  codigo: string | null;
  cara: string | null;
  plaza: string | null;
  latitud: number | null;
  longitud: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  n_inv_ids: number;
  n_cams: number;
  inv_ids: string;
  cams_ids: string;
  cams_nombres: string;
  rv_ids: string;
}

export interface AuditCodReutilizadoRow {
  codigo: string | null;
  cara: string | null;
  plaza: string | null;
  n_ubicaciones: number;
  inv_ids: string;
  codigos_unicos: string;
  coords: string;
  ubicaciones: string;
}

export interface AuditApsCompartidoRow {
  APS: string;
  n_reservas: number;
  n_cams: number;
  n_clientes: number;
  cams_ids: string;
  cams_nombres: string;
  clientes: string;
  severidad: string;
}

export interface AuditZombieRow {
  reserva_id: number;
  ei_id_apuntado: number;
  cliente_id: number | null;
  cliente_nombre: string | null;
  solicitudCaras_id: number;
  sc_id: number | null;
  articulo: string | null;
  cam_id: number | null;
  cam_nombre: string | null;
  estatus: string | null;
  APS: string | null;
  fecha_inicio: string | null;
}

export interface AuditEiDuplicadoRow {
  inventario_id: number;
  numero_espacio: number;
  n_rows: number;
  ei_ids: string;
  codigo_unico: string | null;
  plaza: string | null;
  tradicional_digital: string | null;
}

export interface AuditMarcaClientesDupRow {
  marca: string;
  producto: string | null;
  n_clientes: number;
  cliente_ids: string;
  card_codes: string;
  razones_sociales: string;
  sap_dbs: string;
}

async function get<T>(path: string): Promise<T> {
  const { data } = await api.get(path);
  return data.data;
}

export const auditReservasService = {
  getSummary: () => get<AuditSummary>('/audit-reservas/summary'),
  getDuplicados: () => get<AuditDuplicadoGroup[]>('/audit-reservas/duplicados'),
  getHuerfanos: () => get<AuditHuerfanoRow[]>('/audit-reservas/huerfanos'),
  getPorCatorcena: () => get<AuditPorCatorcenaRow[]>('/audit-reservas/por-catorcena'),
  getPorCliente: () => get<AuditPorClienteRow[]>('/audit-reservas/por-cliente'),
  getPorVendedor: () => get<AuditPorVendedorRow[]>('/audit-reservas/por-vendedor'),
  getInvDuplicados: () => get<AuditInvDuplicadoRow[]>('/audit-reservas/inv-duplicados'),
  getClienteDesalineado: () => get<AuditClienteDesalineadoRow[]>('/audit-reservas/cliente-desalineado'),
  getStatusRaro: () => get<AuditStatusRaroRow[]>('/audit-reservas/status-raro'),
  getInvSucio: () => get<AuditInvSucioRow[]>('/audit-reservas/inv-sucio'),
  getReservasSucias: () => get<AuditReservasSuciasRow[]>('/audit-reservas/reservas-sucias'),
  getCrossCamFisico: () => get<AuditCrossCamFisicoRow[]>('/audit-reservas/cross-cam-fisico'),
  getCodReutilizado: () => get<AuditCodReutilizadoRow[]>('/audit-reservas/cod-reutilizado'),
  getApsCompartido: () => get<AuditApsCompartidoRow[]>('/audit-reservas/aps-compartido'),
  getZombies: () => get<AuditZombieRow[]>('/audit-reservas/zombies'),
  getEiDuplicado: () => get<AuditEiDuplicadoRow[]>('/audit-reservas/ei-duplicado'),
  getMarcaClientesDup: () => get<AuditMarcaClientesDupRow[]>('/audit-reservas/marca-clientes-dup'),
};
