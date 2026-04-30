import api from '../lib/api';
import { ApiResponse } from '../types';
import { inventariosService } from './inventarios.service';

export interface CatorcenaRef {
  numero: number;
  anio: number;
}

export interface InventarioResumen {
  id: number;
  codigo_unico: string | null;
  ubicacion?: string | null;
  mueble?: string | null;
  plaza?: string | null;
  estado?: string | null;
  tipo_de_cara?: string | null;
  tradicional_digital?: string | null;
}

export interface AnalisisOcupacion {
  id: number;
  usuario_id: number;
  nombre: string;
  inventarios: InventarioResumen[];
  catorcenas: CatorcenaRef[];
  codigosNoEncontrados: string[];
  fecha_creacion: string;
  fecha_actualizacion: string | null;
  is_owner?: boolean;
}

export interface AnalisisOcupacionInput {
  nombre: string;
  inventarios: InventarioResumen[];
  catorcenas: CatorcenaRef[];
  codigosNoEncontrados: string[];
}

export interface CampanaEnCelda {
  reserva_id: number;
  reserva_estatus: string;
  campana_id: number;
  campana_nombre: string;
  cliente_nombre: string;
  propuesta_id: number;
  inicio_periodo: string;
  fin_periodo: string;
  numero_catorcena: number;
  anio_catorcena: number;
}

export interface CeldaOcupacion {
  ocupado: boolean;
  campanas: CampanaEnCelda[];
}

export interface MatrizOcupacion {
  inventarios: InventarioResumen[];
  catorcenas: CatorcenaRef[];
  // celdas[inventarioId][`${anio}-${numero}`] = CeldaOcupacion
  celdas: Record<number, Record<string, CeldaOcupacion>>;
}

export const cellKeyOf = (c: CatorcenaRef) => `${c.anio}-${c.numero}`;

export const analisisOcupacionService = {
  async list(): Promise<AnalisisOcupacion[]> {
    const response = await api.get<ApiResponse<AnalisisOcupacion[]>>('/analisis-ocupacion');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener análisis');
    }
    return response.data.data;
  },

  async get(id: number): Promise<AnalisisOcupacion> {
    const response = await api.get<ApiResponse<AnalisisOcupacion>>(`/analisis-ocupacion/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener análisis');
    }
    return response.data.data;
  },

  async create(input: AnalisisOcupacionInput): Promise<AnalisisOcupacion> {
    const response = await api.post<ApiResponse<AnalisisOcupacion>>('/analisis-ocupacion', input);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear análisis');
    }
    return response.data.data;
  },

  async update(id: number, input: Partial<AnalisisOcupacionInput>): Promise<AnalisisOcupacion> {
    const response = await api.put<ApiResponse<AnalisisOcupacion>>(`/analisis-ocupacion/${id}`, input);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar análisis');
    }
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<unknown>>(`/analisis-ocupacion/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar análisis');
    }
  },

  async buildMatriz(inventarios: InventarioResumen[], catorcenas: CatorcenaRef[]): Promise<MatrizOcupacion> {
    const celdas: Record<number, Record<string, CeldaOcupacion>> = {};
    const seleccionadas = new Set(catorcenas.map(cellKeyOf));

    await Promise.all(
      inventarios.map(async inv => {
        celdas[inv.id] = {};
        catorcenas.forEach(c => {
          celdas[inv.id][cellKeyOf(c)] = { ocupado: false, campanas: [] };
        });
        try {
          const data = await inventariosService.getHistorial(inv.id);
          for (const h of data.historial) {
            const k = `${h.anio_catorcena}-${h.numero_catorcena}`;
            if (!seleccionadas.has(k)) continue;
            const celda = celdas[inv.id][k];
            celda.ocupado = true;
            celda.campanas.push({
              reserva_id: h.reserva_id,
              reserva_estatus: h.reserva_estatus,
              campana_id: h.campana_id,
              campana_nombre: h.campana_nombre,
              cliente_nombre: h.cliente_nombre,
              propuesta_id: h.propuesta_id,
              inicio_periodo: h.inicio_periodo,
              fin_periodo: h.fin_periodo,
              numero_catorcena: h.numero_catorcena,
              anio_catorcena: h.anio_catorcena,
            });
          }
        } catch {
          // Si falla la carga del historial, dejamos la fila como no ocupada
        }
      })
    );

    return { inventarios, catorcenas, celdas };
  },
};
