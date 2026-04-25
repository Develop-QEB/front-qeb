import { api } from '../lib/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CircuitoResumen {
  cto: string;
  plaza: string;
  total: number;
  muebles: Record<string, number>;
}

export interface CircuitoDetalle {
  cto: number;
  ctoLabel: string;
  plazaCode: string;
  total: number;
  inventarios: Array<{
    id: number;
    codigo_unico: string;
    mueble: string;
    tradicional_digital: string;
    plaza: string;
  }>;
}

export interface ConflictoReserva {
  inventario_id: number;
  codigo_unico: string;
  fecha_inicio: string;
  fecha_fin: string;
  propuesta_id: number | null;
}

export interface DisponibilidadResult {
  disponible: boolean;
  total: number;
  conflictos: ConflictoReserva[];
  motivo?: string;
}

export const circuitosService = {
  async list(): Promise<CircuitoResumen[]> {
    const res = await api.get<ApiResponse<CircuitoResumen[]>>('/circuitos/list');
    if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Error al listar circuitos');
    return res.data.data;
  },

  async detalle(itemCode: string): Promise<CircuitoDetalle> {
    const res = await api.get<ApiResponse<CircuitoDetalle>>('/circuitos/detalle', {
      params: { itemCode },
    });
    if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Error al obtener detalle');
    return res.data.data;
  },

  async checkDisponibilidad(itemCode: string, fecha_inicio: string, fecha_fin: string): Promise<DisponibilidadResult> {
    const res = await api.post<ApiResponse<DisponibilidadResult>>('/circuitos/check-disponibilidad', {
      itemCode, fecha_inicio, fecha_fin,
    });
    if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Error al validar disponibilidad');
    return res.data.data;
  },
};
