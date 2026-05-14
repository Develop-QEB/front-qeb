import api from '../lib/api';

export interface AuditSummary {
  total_reservas: number;
  reservas_en_duplicado: number;
  reservas_huerfanas: number;
  reservas_sin_inventario: number;
  grupos_con_clientes_distintos: number;
  catorcenas_activas: number;
}

export interface AuditDuplicadoGroup {
  inventario_id: number;
  codigo_unico: string | null;
  tipo_de_cara: string | null;
  plaza: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  veces: number;
  clientes_distintos: number;
  propuestas_distintas: number;
  clase: 'ENTRE_CLIENTES' | 'MISMO_CLIENTE_CAMP' | 'FILA_REPETIDA';
  clientes: string | null;
  propuesta_ids: string | null;
  campania_ids: string | null;
  articulos: string | null;
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

export const auditReservasService = {
  async getSummary(): Promise<AuditSummary> {
    const { data } = await api.get('/audit-reservas/summary');
    return data.data;
  },
  async getDuplicados(): Promise<AuditDuplicadoGroup[]> {
    const { data } = await api.get('/audit-reservas/duplicados');
    return data.data;
  },
  async getHuerfanos(): Promise<AuditHuerfanoRow[]> {
    const { data } = await api.get('/audit-reservas/huerfanos');
    return data.data;
  },
  async getPorCatorcena(): Promise<AuditPorCatorcenaRow[]> {
    const { data } = await api.get('/audit-reservas/por-catorcena');
    return data.data;
  },
  async getPorCliente(): Promise<AuditPorClienteRow[]> {
    const { data } = await api.get('/audit-reservas/por-cliente');
    return data.data;
  },
};
