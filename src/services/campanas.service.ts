import api from '../lib/api';
import { Campana, CampanaStats, PaginatedResponse, ApiResponse, ComentarioTarea, CampanaWithComments } from '../types';

export type { CampanaWithComments };

// SAP Configuration
const SAP_BASE_URL = 'https://binding-convinced-ride-foto.trycloudflare.com';

// Interfaces para SAP Delivery Note
export interface SAPDocumentLine {
  LineNum: string;
  ItemCode: string;
  Quantity: string;
  TaxCode: string;
  UnitPrice: string;
  CostingCode: string;
  CostingCode2: string;
  U_Cod_Sitio: number;
  U_dscSitio: string;
  U_CodTAsig: number;
  U_dscTAsig: string;
  U_CodPer: number;
  U_dscPeriod: string;
  U_FechInPer: string;
  U_FechFinPer: string;
}

export interface SAPDeliveryNote {
  CardCode: string;
  NumAtCard: string;
  Comments: string;
  DocDueDate: string;
  SalesPersonCode: number | string;
  U_CIC: number | string;
  U_CRM_Asesor: string;
  U_CRM_Producto: string;
  U_CRM_Marca: string;
  U_CRM_Categoria: string;
  U_CRM_Cliente: string;
  U_CRM_Agencia: string;
  U_CRM_SAP: string;
  U_CRM_R_S: string;
  U_CRM_Camp: string;
  U_TIPO_VENTA: string;
  DocumentLines: SAPDocumentLine[];
}

export interface SAPPostResponse {
  success: boolean;
  data?: {
    DocEntry?: number;
    DocNum?: number;
    [key: string]: unknown;
  };
  error?: string;
}

export interface InventarioReservado {
  rsv_ids: string;
  id: number;
  codigo_unico: string;
  solicitud_caras_id: number | null;
  mueble: string | null;
  estado: string | null;
  tipo_de_cara: string | null;
  caras_totales: number;
  latitud: number;
  longitud: number;
  plaza: string | null;
  estatus_reserva: string | null;
  articulo: string | null;
  tipo_medio: string | null;
  inicio_periodo: string | null;
  fin_periodo: string | null;
  tradicional_digital: string | null;
  grupo_completo_id: number | null;
  numero_catorcena?: number | null;
  anio_catorcena?: number | null;
  tarifa_publica?: number | null;
}

export interface InventarioConAPS extends InventarioReservado {
  aps: number;
}

// Función para construir el payload de DeliveryNote para SAP
export function buildDeliveryNote(
  campana: CampanaWithComments,
  inventarioAPS: InventarioConAPS[]
): SAPDeliveryNote {
  // Obtener valores únicos de APS
  const uniqueAPS = [...new Set(inventarioAPS.map(item => item.aps))];

  // Crear DocumentLines - una línea por cada APS único
  const documentLines: SAPDocumentLine[] = uniqueAPS.map((apsValue, index) => {
    // Encontrar todos los items con este APS
    const itemsWithThisAPS = inventarioAPS.filter(item => item.aps === apsValue);
    const firstItem = itemsWithThisAPS[0];

    // Calcular UnitPrice sumando tarifa_publica de todos los items con este APS
    const totalPrice = itemsWithThisAPS.reduce((total, item) => {
      return total + (item.tarifa_publica || 0);
    }, 0);

    // Construir U_dscPeriod desde numero_catorcena y anio_catorcena
    const dscPeriod = firstItem.numero_catorcena && firstItem.anio_catorcena
      ? `CATORCENA ${firstItem.numero_catorcena}-${firstItem.anio_catorcena}`
      : 'CATORCENA —-—';

    return {
      LineNum: index.toString(),
      ItemCode: firstItem.articulo || '',
      Quantity: itemsWithThisAPS.length.toString(),
      TaxCode: 'A4',
      UnitPrice: totalPrice.toString(),
      CostingCode: '02-03-04',
      CostingCode2: '1',
      U_Cod_Sitio: 11,
      U_dscSitio: firstItem.estado || '',
      U_CodTAsig: 204,
      U_dscTAsig: firstItem.estatus_reserva || '',
      U_CodPer: 1746,
      U_dscPeriod: dscPeriod,
      U_FechInPer: firstItem.inicio_periodo?.split('T')[0] || '',
      U_FechFinPer: firstItem.fin_periodo?.split('T')[0] || '',
    };
  });

  // Construir el objeto DeliveryNote completo
  const deliveryNote: SAPDeliveryNote = {
    CardCode: campana.articulo || 'IMU00351',
    NumAtCard: campana.id?.toString() || '',
    Comments: campana.comentario_cambio_status || '',
    DocDueDate: campana.fecha_fin || new Date().toISOString().split('T')[0],
    SalesPersonCode: campana.T0_U_IDAsesor || '',
    U_CIC: campana.cuic || '',
    U_CRM_Asesor: campana.T0_U_Asesor || '',
    U_CRM_Producto: campana.T2_U_Producto || '',
    U_CRM_Marca: campana.T2_U_Marca || '',
    U_CRM_Categoria: campana.T2_U_Categoria || '',
    U_CRM_Cliente: campana.T0_U_Cliente || '',
    U_CRM_Agencia: campana.T0_U_Agencia || '',
    U_CRM_SAP: campana.articulo || 'IMU00351',
    U_CRM_R_S: campana.T0_U_RazonSocial || '',
    U_CRM_Camp: campana.nombre || campana.nombre_campania || '',
    U_TIPO_VENTA: 'Comercial',
    DocumentLines: documentLines,
  };

  return deliveryNote;
}

// Función para hacer POST a SAP
export async function postDeliveryNoteToSAP(deliveryNote: SAPDeliveryNote): Promise<SAPPostResponse> {
  try {
    const response = await fetch(`${SAP_BASE_URL}/delivery-notes-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deliveryNote),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `Error ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error('Error posting to SAP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión con SAP',
    };
  }
}

export interface CampanasParams {
  page?: number;
  limit?: number;
  status?: string;
  yearInicio?: number;
  yearFin?: number;
  catorcenaInicio?: number;
  catorcenaFin?: number;
}

export const campanasService = {
  async getAll(params: CampanasParams = {}): Promise<PaginatedResponse<Campana>> {
    const response = await api.get<PaginatedResponse<Campana>>('/campanas', { params });
    return response.data;
  },

  async getById(id: number): Promise<CampanaWithComments> {
    const response = await api.get<ApiResponse<CampanaWithComments>>(`/campanas/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener campana');
    }
    return response.data.data;
  },

  async updateStatus(id: number, status: string): Promise<Campana> {
    const response = await api.patch<ApiResponse<Campana>>(`/campanas/${id}/status`, { status });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar status');
    }
    return response.data.data;
  },

  async getStats(): Promise<CampanaStats> {
    const response = await api.get<ApiResponse<CampanaStats>>('/campanas/stats');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadisticas');
    }
    return response.data.data;
  },

  async addComment(id: number, contenido: string): Promise<ComentarioTarea> {
    const response = await api.post<ApiResponse<ComentarioTarea>>(`/campanas/${id}/comentarios`, { contenido });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al agregar comentario');
    }
    return response.data.data;
  },

  async getInventarioReservado(id: number): Promise<InventarioReservado[]> {
    const response = await api.get<ApiResponse<InventarioReservado[]>>(`/campanas/${id}/inventario`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario reservado');
    }
    return response.data.data;
  },

  async getInventarioConAPS(id: number): Promise<InventarioConAPS[]> {
    const response = await api.get<ApiResponse<InventarioConAPS[]>>(`/campanas/${id}/inventario-aps`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario con APS');
    }
    return response.data.data;
  },

  async assignAPS(id: number, inventarioIds: number[]): Promise<{ aps: number; message: string }> {
    const response = await api.post<ApiResponse<{ aps: number; message: string }>>(`/campanas/${id}/assign-aps`, { inventarioIds });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al asignar APS');
    }
    return response.data.data;
  },

  async sendAuthorizationPIN(codigo: string, solicitante: string, campana: string): Promise<void> {
    const response = await api.post<{ success: boolean; message: string }>('/correos/send-pin', {
      codigo,
      solicitante,
      campana,
    });
    if (!response.data.success) {
      throw new Error('Error al enviar código de autorización');
    }
  },

  async removeAPS(id: number, reservaIds: number[]): Promise<{ message: string; affected: number }> {
    const response = await api.post<ApiResponse<{ message: string; affected: number }>>(`/campanas/${id}/remove-aps`, { reservaIds });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al quitar APS');
    }
    return response.data.data;
  },
};
