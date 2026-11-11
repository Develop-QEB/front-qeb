// Cliente del modulo Almacen Artes — fase 1 MVP.
import { api } from '../lib/api';

export interface AlmacenArteStock {
  biblioteca_artes_id: number;
  campania_id: number;
  campania_nombre: string | null;
  nombre_arte: string;
  nombre_generico: string | null;
  archivo: string;
  tipo: string;
  estatus_operaciones: string | null;
  cliente: string | null;
  marca: string | null;
  asesor: string | null;
  cantidad_inicial: number;
  cantidad_recibida: number;
  cantidad_instalada: number;
  cantidad_salidas_manuales: number;
  cantidad_disponible: number;
}

export interface AlmacenArteMovimiento {
  id: number;
  biblioteca_artes_id: number;
  campania_id: number;
  tipo: 'alta_inicial' | 'entrada_recepcion' | 'salida_instalacion' | 'entrada_manual' | 'salida_manual' | 'ajuste';
  cantidad: number;
  tarea_id: number | null;
  reserva_id: number | null;
  usuario_id: number | null;
  usuario_nombre: string | null;
  nota: string | null;
  fecha_hora: string;
}

export interface AlmacenArtesListParams {
  search?: string;
  campania_id?: number;
  cliente_id?: number;
  estatus_operaciones?: string;
}

interface ApiResponse<T> { success: boolean; data?: T; error?: string }

export const almacenArtesService = {
  async list(params: AlmacenArtesListParams = {}): Promise<AlmacenArteStock[]> {
    const res = await api.get<ApiResponse<AlmacenArteStock[]>>('/almacen-artes', { params });
    if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Error al listar');
    return res.data.data;
  },

  async historial(bibliotecaArteId: number): Promise<AlmacenArteMovimiento[]> {
    const res = await api.get<ApiResponse<AlmacenArteMovimiento[]>>(`/almacen-artes/${bibliotecaArteId}/historial`);
    if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Error al traer historial');
    return res.data.data;
  },

  async entradaManual(bibliotecaArteId: number, cantidad: number, nota?: string): Promise<void> {
    const res = await api.post<ApiResponse<void>>(`/almacen-artes/${bibliotecaArteId}/entrada-manual`, { cantidad, nota });
    if (!res.data.success) throw new Error(res.data.error || 'Error al registrar entrada');
  },

  async salidaManual(bibliotecaArteId: number, cantidad: number, nota: string): Promise<void> {
    const res = await api.post<ApiResponse<void>>(`/almacen-artes/${bibliotecaArteId}/salida-manual`, { cantidad, nota });
    if (!res.data.success) throw new Error(res.data.error || 'Error al registrar salida');
  },

  async altaInicial(bibliotecaArteId: number, cantidad: number): Promise<void> {
    const res = await api.post<ApiResponse<void>>(`/almacen-artes/${bibliotecaArteId}/alta-inicial`, { cantidad });
    if (!res.data.success) throw new Error(res.data.error || 'Error al registrar alta inicial');
  },
};
