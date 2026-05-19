import api from '../lib/api';
import { ApiResponse } from '../types';

export interface CatorcenaRefRO {
  numero: number;
  anio: number;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface CampanaRO {
  id: number;
  nombre: string;
  cotizacion_id?: number | null;
  cliente_id?: number;
}

export interface InventarioRO {
  reserva_id: number;
  espacio_id: number;
  inventario_id: number;
  codigo_unico: string | null;
  mueble: string | null;
  plaza: string | null;
  tipo_de_cara: string | null;
  tradicional_digital: string | null;
  ubicacion: string | null;
  estatus?: string | null;
}

export interface CircuitoFormatoRO {
  solicitud_caras_id: number;
  articulo: string | null;
  formato: string | null;
  tipo: string | null;
  caras_totales: number;
  inicio_periodo: string;
  fin_periodo: string;
  inventarios_actuales: number;
  inventarios: InventarioRO[];
}

export interface OcupacionExterna {
  reserva_id: number;
  solicitud_caras_id: number;
  articulo: string | null;
  formato: string | null;
  inicio_periodo: string;
  fin_periodo: string;
  campana_id: number | null;
  campana_nombre: string | null;
  cliente_id: number | null;
  cliente_nombre: string | null;
  propuesta_id: number | null;
}

export type EstadoCodigo = 'en_circuito' | 'disponible' | 'ocupado_en_otra';

export interface ItemComparacion {
  codigo_unico: string;
  existe: boolean;
  inventario?: {
    id: number;
    codigo_unico: string | null;
    plaza: string | null;
    mueble: string | null;
    tipo_de_cara: string | null;
    tradicional_digital: string | null;
    ubicacion: string | null;
  };
  estado?: EstadoCodigo;
  ocupaciones?: OcupacionExterna[];
}

export interface InventarioCircuitoSinCsv {
  reserva_id: number;
  espacio_id: number;
  inventario_id: number;
  codigo_unico: string | null;
  plaza: string | null;
  mueble: string | null;
  tipo_de_cara: string | null;
  ubicacion: string | null;
}

export interface ComparacionResult {
  circuito: {
    solicitud_caras_id: number;
    articulo: string | null;
    formato: string | null;
    caras_totales: number;
    inicio_periodo: string;
    fin_periodo: string;
  };
  csv: { total: number; no_encontrados: string[] };
  items: ItemComparacion[];
  en_circuito_sin_csv: InventarioCircuitoSinCsv[];
}

export interface AgregarItemInput {
  inventario_id: number;
  reserva_origen_id: number | null;
  sustituye_reserva_id: number;
}

export interface AplicarResult {
  reservas_creadas: number;
  reservas_sustituidas: number;
  reservas_liberadas: number;
}

export const reorganizarOcupacionService = {
  async getCatorcenasDeCampana(campanaId: number) {
    const r = await api.get<ApiResponse<{ campana: CampanaRO; catorcenas: CatorcenaRefRO[] }>>(
      `/reorganizar-ocupacion/campanas/${campanaId}/catorcenas`,
    );
    if (!r.data.success || !r.data.data) throw new Error(r.data.error || 'Error');
    return r.data.data;
  },

  async getCircuitosPorCatorcena(campanaId: number, numero: number, anio: number) {
    const r = await api.get<ApiResponse<{ campana: CampanaRO; catorcena: CatorcenaRefRO; circuitos: CircuitoFormatoRO[] }>>(
      `/reorganizar-ocupacion/campanas/${campanaId}/circuitos`,
      { params: { numero, anio } },
    );
    if (!r.data.success || !r.data.data) throw new Error(r.data.error || 'Error');
    return r.data.data;
  },

  async comparar(solicitudCarasId: number, codigos: string[]) {
    const r = await api.post<ApiResponse<ComparacionResult>>(
      `/reorganizar-ocupacion/comparar`,
      { solicitudCarasId, codigos },
    );
    if (!r.data.success || !r.data.data) throw new Error(r.data.error || 'Error');
    return r.data.data;
  },

  async aplicar(solicitudCarasId: number, agregar: AgregarItemInput[]) {
    const r = await api.post<ApiResponse<AplicarResult>>(`/reorganizar-ocupacion/aplicar`, {
      solicitudCarasId,
      agregar,
    });
    if (!r.data.success || !r.data.data) throw new Error(r.data.error || 'Error');
    return r.data.data;
  },
};
