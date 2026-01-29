import api from '../lib/api';
import { Campana, CampanaStats, PaginatedResponse, ApiResponse, ComentarioTarea, CampanaWithComments } from '../types';

import { useEnvironmentStore, getEndpoints } from '../store/environmentStore';
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
  U_IMU_ART_APS: string;
  U_IMU_CotNum: string;
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

export interface ImagenDigital {
  id: number;
  idReserva: number;
  archivo: string;
  archivoData?: string; // URL de Cloudinary o Base64 data URL
  comentario: string;
  estado: string;
  respuesta: string;
  spot: number;
  tipo: 'image' | 'video';
}

export interface DigitalFileSummary {
  idReserva: number;
  totalArchivos: number;
  countImagenes: number;
  countVideos: number;
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
  arte_aprobado?: string | null;
  instalado?: boolean | null;
  estatus_arte?: 'Carga Artes' | 'Revision Artes' | 'Artes Aprobados' | 'En Impresion' | 'Artes Recibidos' | 'Instalado' | null;
}

export interface InventarioConArte {
  rsv_id: string;
  rsv_ids: string;
  id: number;
  codigo_unico: string;
  codigo_unico_display: string;
  ubicacion: string | null;
  tipo_de_cara: string | null;
  tipo_de_cara_display: string | null;
  cara: string | null;
  mueble: string | null;
  latitud: number;
  longitud: number;
  plaza: string | null;
  estado: string | null;
  municipio: string | null;
  tipo_de_mueble: string | null;
  ancho: number;
  alto: number;
  nivel_socioeconomico: string | null;
  tarifa_publica: number | null;
  tradicional_digital: string | null;
  archivo: string | null;
  epInId: string | null;
  estatus: string | null;
  rsvId: string | null;
  arte_aprobado: string | null;
  APS: number | null;
  inicio_periodo: string | null;
  fin_periodo: string | null;
  comentario_rechazo: string | null;
  instalado: boolean | null;
  rsvAPS: number | null;
  tarea: string | null;
  status_mostrar: string | null;
  caras_totales: number;
  IMU: number | null;
  articulo: string | null;
  tipo_medio: string | null;
  numero_catorcena: number | null;
  anio_catorcena: number | null;
  grupo_completo_id: number | null;
  grupo: number | null;
}

export interface SolicitudCara {
  id: number;
  idquote: number;
  ciudad: string | null;
  estados: string | null;
  tipo: string | null;
  flujo: string | null;
  bonificacion: number | null;
  caras: number | null;
  nivel_socioeconomico: string | null;
  formato: string | null;
  costo: number | null;
  tarifa_publica: number | null;
  inicio_periodo: string | null;
  fin_periodo: string | null;
  caras_flujo: number | null;
  caras_contraflujo: number | null;
  articulo: string | null;
  descuento: number | null;
  autorizacion_dg?: string | null;
  autorizacion_dcm?: string | null;
}

export interface CampanaUpdateData {
  nombre?: string;
  status?: string;
  descripcion?: string;
  notas?: string;
  catorcenaInicioNum?: number;
  catorcenaInicioAnio?: number;
  catorcenaFinNum?: number;
  catorcenaFinAnio?: number;
}

export interface HistorialItem {
  id: number;
  tipo: string;
  ref_id: number;
  accion: string;
  fecha_hora: string;
  detalles: string | null;
}

// Interface para tareas de campaña
export interface TareaCampana {
  id: number;
  titulo: string | null;
  descripcion: string | null;
  contenido: string | null;
  tipo: string | null;
  estatus: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  responsable: string | null;
  id_responsable: number;
  responsable_nombre: string | null;
  responsable_foto: string | null;
  correo_electronico: string | null;
  asignado: string | null;
  id_asignado: string | null;
  archivo: string | null;
  evidencia: string | null;
  ids_reservas: string | null;
  listado_inventario: string | null;
  proveedores_id: number | null;
  nombre_proveedores: string | null;
  num_impresiones: number | null;
  archivo_testigo: string | null;
  // Campos adicionales de la query con JOINs
  inventario_id?: string | null;
  APS?: string | null;
  tarea_reserva?: string | null;
  Archivo_reserva?: string | null;
}

export interface CreateTareaData {
  titulo: string;
  descripcion?: string;
  tipo?: string;
  fecha_fin?: string;
  id_responsable?: number;
  responsable?: string;
  asignado?: string;
  id_asignado?: string;
  ids_reservas?: string;
  proveedores_id?: number;
  nombre_proveedores?: string;
  evidencia?: string;
  // Campos para Impresión y Revisión de artes
  catorcena_entrega?: string;
  contenido?: string;
  listado_inventario?: string;
  impresiones?: Record<number, number>;
  num_impresiones?: number;
}

export interface ArteExistente {
  id: string;
  nombre: string;
  url: string;
  usos: number;
}

// Órdenes de Montaje
export interface OrdenMontajeCAT {
  plaza: string | null;
  tipo: string | null; // formato
  asesor: string | null;
  aps_especifico: number | null;
  fecha_inicio_periodo: string | null;
  fecha_fin_periodo: string | null;
  cliente: string | null;
  marca: string | null;
  unidad_negocio: string | null;
  campania: string | null;
  numero_articulo: string | null;
  negociacion: 'BONIFICACION' | 'RENTA';
  caras: number;
  tarifa: number | null;
  monto_total: number | null;
  campania_id: number | null;
  grupo_id: number | null;
  tipo_fila: string | null;
  catorcena_numero: number | null;
  catorcena_year: number | null;
}

export interface OrdenMontajeINVIAN {
  Campania: string | null;
  Anunciante: string | null;
  Operacion: string | null;
  CodigoContrato: number | null;
  PrecioPorCara: number | null;
  Vendedor: string | null;
  Descripcion: string | null;
  InicioPeriodo: string | null;
  FinSegmento: string | null;
  Arte: string | null;
  CodigoArte: number | null;
  ArteUrl: string | null;
  OrigenArte: string | null;
  Unidad: string | null;
  Cara: string | null;
  Ciudad: string | null;
  TipoDistribucion: string | null;
  Reproducciones: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  status_campania: string | null;
  catorcena_numero: number | null;
  catorcena_year: number | null;
}

export interface ComentarioRevisionArte {
  id: number;
  tarea_id: number;
  autor_id: number;
  autor_nombre: string;
  contenido: string;
  fecha: string;
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
      UnitPrice: String(campana.precio || 0),
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
    CardCode: campana.card_code || 'IMU00351',
    NumAtCard: campana.id?.toString() || '',
    Comments: campana.comentario_cambio_status || '',
    DocDueDate: (campana.fecha_fin || new Date().toISOString()).split('T')[0],
    SalesPersonCode: campana.salesperson_code || campana.T0_U_IDAsesor || '',
    U_CIC: String(campana.cuic || ''),
    U_CRM_Asesor: campana.T0_U_Asesor || '',
    U_CRM_Producto: campana.T2_U_Producto || '',
    U_CRM_Marca: campana.T2_U_Marca || '',
    U_CRM_Categoria: campana.T2_U_Categoria || '',
    U_CRM_Cliente: campana.T0_U_Cliente || '',
    U_CRM_Agencia: campana.T0_U_Agencia || '',
    U_CRM_SAP: campana.card_code || 'IMU00351',
    U_CRM_R_S: campana.T0_U_RazonSocial || '',
    U_CRM_Camp: campana.nombre || campana.nombre_campania || '',
    U_TIPO_VENTA: 'Comercial',
    U_IMU_ART_APS: campana.id?.toString() || '',
    U_IMU_CotNum: uniqueAPS.length > 0 ? String(uniqueAPS[0]) : '',
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
    console.log('========== SAP RESPONSE ==========');
    console.log('Status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    console.log('==================================');

    const environment = useEnvironmentStore.getState().environment;
    const envLabel = environment === 'test' ? 'pruebas' : 'producción';

    // Extraer mensaje de error detallado de SAP
    
    const getDetailedError = () => {
      if (data.details?.error?.message?.value) {
        const sapError = data.details.error.message.value;
        if (sapError.includes('Invalid BP code')) {
          const cardCode = sapError.match(/'([^']+)'/)?.[1] || '';
          return `El CardCode '${cardCode}' no existe en el ambiente de ${envLabel} de SAP`;
        }
        if (sapError.includes('is inactive')) {
          return `Error SAP: ${sapError}`;
        }
        return sapError;
      }
      return data.message || data.error || `Error ${response.status}: ${response.statusText}`;
    };

    if (!response.ok || data.success === false) {
      return {
        success: false,
        error: getDetailedError(),
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

  async getCaras(id: number): Promise<SolicitudCara[]> {
    const response = await api.get<ApiResponse<SolicitudCara[]>>(`/campanas/${id}/caras`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener caras');
    }
    return response.data.data;
  },

  async update(id: number, data: CampanaUpdateData): Promise<Campana> {
    const response = await api.patch<ApiResponse<Campana>>(`/campanas/${id}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar campaña');
    }
    return response.data.data;
  },

  async getHistorial(id: number): Promise<HistorialItem[]> {
    const response = await api.get<ApiResponse<HistorialItem[]>>(`/campanas/${id}/historial`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener historial');
    }
    return response.data.data;
  },

  async getInventarioConArte(id: number): Promise<InventarioConArte[]> {
    const response = await api.get<ApiResponse<InventarioConArte[]>>(`/campanas/${id}/inventario-arte`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario con arte');
    }
    return response.data.data;
  },

  // ============================================================================
  // NUEVOS ENDPOINTS PARA GESTION DE ARTES
  // ============================================================================

  async getInventarioSinArte(id: number): Promise<InventarioConArte[]> {
    const response = await api.get<ApiResponse<InventarioConArte[]>>(`/campanas/${id}/inventario-sin-arte`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario sin arte');
    }
    return response.data.data;
  },

  async getInventarioTestigos(id: number): Promise<InventarioConArte[]> {
    const response = await api.get<ApiResponse<InventarioConArte[]>>(`/campanas/${id}/inventario-testigos`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario para testigos');
    }
    return response.data.data;
  },

  async assignArte(id: number, reservaIds: number[], archivo: string): Promise<{ message: string; affected: number }> {
    const response = await api.post<ApiResponse<{ message: string; affected: number }>>(`/campanas/${id}/assign-arte`, {
      reservaIds,
      archivo,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al asignar arte');
    }
    return response.data.data;
  },

  async assignArteDigital(
    id: number,
    reservaIds: number[],
    archivos: { archivo: string; spot: number; nombre: string; tipo: string }[]
  ): Promise<{ message: string; affected: number }> {
    const response = await api.post<ApiResponse<{ message: string; affected: number }>>(`/campanas/${id}/assign-arte-digital`, {
      reservaIds,
      archivos,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al asignar arte digital');
    }
    return response.data.data;
  },

  async getImagenesDigitales(campanaId: number, reservaId: number | string): Promise<ImagenDigital[]> {
    const response = await api.get<ApiResponse<ImagenDigital[]>>(`/campanas/${campanaId}/imagenes-digitales/${reservaId}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener imágenes digitales');
    }
    return response.data.data;
  },

  async getDigitalFileSummaries(campanaId: number): Promise<DigitalFileSummary[]> {
    const response = await api.get<ApiResponse<DigitalFileSummary[]>>(`/campanas/${campanaId}/digital-file-summaries`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener resumen de archivos digitales');
    }
    return response.data.data;
  },

  /**
   * Eliminar archivos digitales
   * Modo 1: Por imageIds (elimina registros específicos)
   * Modo 2: Por archivos + reservaIds (elimina de múltiples reservas a la vez)
   */
  async deleteImagenesDigitales(
    campanaId: number,
    imageIds?: number[],
    archivos?: string[],
    reservaIds?: number[]
  ): Promise<void> {
    const data: { imageIds?: number[]; archivos?: string[]; reservaIds?: number[] } = {};

    if (archivos && archivos.length > 0 && reservaIds && reservaIds.length > 0) {
      // Modo 2: Eliminar por archivos + reservaIds
      data.archivos = archivos;
      data.reservaIds = reservaIds;
    } else if (imageIds && imageIds.length > 0) {
      // Modo 1: Eliminar por imageIds
      data.imageIds = imageIds;
    } else {
      throw new Error('Se requiere imageIds o (archivos + reservaIds)');
    }

    const response = await api.delete<ApiResponse<{ message: string }>>(`/campanas/${campanaId}/imagenes-digitales`, {
      data,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar archivos digitales');
    }
  },

  async addArteDigital(
    campanaId: number,
    reservaIds: number[],
    archivos: Array<{ archivo: string; spot: number; nombre: string; tipo: string }>
  ): Promise<{ message: string; affected: number; files: string[] }> {
    const response = await api.post<ApiResponse<{ message: string; affected: number; files: string[] }>>(
      `/campanas/${campanaId}/add-arte-digital`,
      { reservaIds, archivos }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al agregar arte digital');
    }
    return response.data.data;
  },

  async checkReservasTareas(id: number, reservaIds: number[]): Promise<{
    hasTareas: boolean;
    tareas: Array<{ id: number; titulo: string | null; tipo: string | null; estatus: string | null; responsable: string | null }>;
  }> {
    const response = await api.post<ApiResponse<{
      hasTareas: boolean;
      tareas: Array<{ id: number; titulo: string | null; tipo: string | null; estatus: string | null; responsable: string | null }>;
    }>>(`/campanas/${id}/check-reservas-tareas`, { reservaIds });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al verificar tareas');
    }
    return response.data.data;
  },

  async uploadArteFile(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<{ url: string; filename: string; originalName: string; size: number; mimetype: string }>>('/uploads/arte', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al subir archivo');
    }
    return response.data.data;
  },

  async uploadTestigoFile(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<{ url: string; filename: string; originalName: string; size: number; mimetype: string }>>('/uploads/testigo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al subir archivo de testigo');
    }
    return response.data.data;
  },

  async updateArteStatus(
    id: number,
    reservaIds: number[],
    status: 'Aprobado' | 'Rechazado' | 'Pendiente',
    comentarioRechazo?: string
  ): Promise<{ message: string; affected: number }> {
    const response = await api.post<ApiResponse<{ message: string; affected: number }>>(`/campanas/${id}/arte-status`, {
      reservaIds,
      status,
      comentarioRechazo,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar estado de arte');
    }
    return response.data.data;
  },

  async updateInstalado(
    id: number,
    reservaIds: number[],
    instalado: boolean,
    imagenTestigo?: string,
    fechaTestigo?: string
  ): Promise<{ message: string; affected: number }> {
    const response = await api.post<ApiResponse<{ message: string; affected: number }>>(`/campanas/${id}/instalado`, {
      reservaIds,
      instalado,
      imagenTestigo,
      fechaTestigo,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar estado de instalación');
    }
    return response.data.data;
  },

  // ============================================================================
  // TAREAS
  // ============================================================================

  async getTareas(id: number, options?: { estatus?: string; activas?: boolean }): Promise<TareaCampana[]> {
    const params: Record<string, string | boolean> = {};
    if (options?.estatus) params.estatus = options.estatus;
    if (options?.activas) params.activas = 'true';

    const response = await api.get<ApiResponse<TareaCampana[]>>(`/campanas/${id}/tareas`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener tareas');
    }
    return response.data.data;
  },

  async createTarea(id: number, data: CreateTareaData): Promise<TareaCampana> {
    const response = await api.post<ApiResponse<TareaCampana>>(`/campanas/${id}/tareas`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear tarea');
    }
    return response.data.data;
  },

  async updateTarea(id: number, tareaId: number, data: Partial<TareaCampana>): Promise<TareaCampana> {
    const response = await api.patch<ApiResponse<TareaCampana>>(`/campanas/${id}/tareas/${tareaId}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar tarea');
    }
    return response.data.data;
  },

  async deleteTarea(id: number, tareaId: number): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/campanas/${id}/tareas/${tareaId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar tarea');
    }
  },

  async getArtesExistentes(id: number): Promise<ArteExistente[]> {
    const response = await api.get<ApiResponse<ArteExistente[]>>(`/campanas/${id}/artes-existentes`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener artes existentes');
    }
    return response.data.data;
  },

  async verificarArteExistente(id: number, params: { nombre?: string; url?: string }): Promise<{ existe: boolean; nombre: string; usos: number; url: string | null }> {
    const response = await api.post<ApiResponse<{ existe: boolean; nombre: string; usos: number; url: string | null }>>(
      `/campanas/${id}/verificar-arte`,
      params
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al verificar arte');
    }
    return response.data.data;
  },

async getUsuarios(): Promise<{ id: number; nombre: string }[]> {
    const response = await api.get<ApiResponse<{ id: number; nombre: string }[]>>('/campanas/usuarios/lista');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener usuarios');
    }
    return response.data.data;
  },

  // ============================================================================
  // ÓRDENES DE MONTAJE
  // ============================================================================

  async getOrdenMontajeCAT(params: {
    status?: string;
    catorcenaInicio?: number;
    catorcenaFin?: number;
    yearInicio?: number;
    yearFin?: number;
  } = {}): Promise<OrdenMontajeCAT[]> {
    const response = await api.get<ApiResponse<OrdenMontajeCAT[]>>('/campanas/ordenes-montaje/cat', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener orden de montaje CAT');
    }
    return response.data.data;
  },

  async getOrdenMontajeINVIAN(params: {
    status?: string;
    catorcenaInicio?: number;
    catorcenaFin?: number;
    yearInicio?: number;
    yearFin?: number;
  } = {}): Promise<OrdenMontajeINVIAN[]> {
    const response = await api.get<ApiResponse<OrdenMontajeINVIAN[]>>('/campanas/ordenes-montaje/invian', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener orden de montaje INVIAN');
    }
    return response.data.data;
  },

  // Comentarios de Revisión de Artes
  async getComentariosRevisionArte(campanaId: number, tareaId: string): Promise<ComentarioRevisionArte[]> {
    const response = await api.get<ApiResponse<ComentarioRevisionArte[]>>(`/campanas/${campanaId}/tareas/${tareaId}/comentarios-arte`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al obtener comentarios');
    }
    return response.data.data || [];
  },

  async addComentarioRevisionArte(campanaId: number, tareaId: string, contenido: string): Promise<ComentarioRevisionArte> {
    const response = await api.post<ApiResponse<ComentarioRevisionArte>>(`/campanas/${campanaId}/tareas/${tareaId}/comentarios-arte`, { contenido });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al agregar comentario');
    }
    return response.data.data;
  },

  async deleteComentarioRevisionArte(campanaId: number, comentarioId: number): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/campanas/${campanaId}/comentarios-arte/${comentarioId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar comentario');
    }
  },

  // ============================================================================
  // MÉTODOS PARA GESTIÓN DE RESERVAS (copiados de propuestas)
  // ============================================================================

  async getReservasForModal(campanaId: number): Promise<ReservaModalItem[]> {
    const response = await api.get<ApiResponse<ReservaModalItem[]>>(`/campanas/${campanaId}/reservas-modal`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener reservas');
    }
    return response.data.data;
  },

  async createReservas(
    campanaId: number,
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
  ): Promise<{ calendarioId: number; reservasCreadas: number }> {
    const response = await api.post<ApiResponse<{ calendarioId: number; reservasCreadas: number }>>(
      `/campanas/${campanaId}/reservas`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear reservas');
    }
    return response.data.data;
  },

  async deleteReservas(campanaId: number, reservaIds: number[]): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/campanas/${campanaId}/reservas`, {
      data: { reservaIds },
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar reservas');
    }
  },

  async updateCara(campanaId: number, caraId: number, data: CaraUpdateData): Promise<SolicitudCara> {
    const response = await api.patch<ApiResponse<SolicitudCara>>(`/campanas/${campanaId}/caras/${caraId}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar cara');
    }
    return response.data.data;
  },

  async createCara(campanaId: number, data: CaraUpdateData): Promise<SolicitudCara> {
    const response = await api.post<ApiResponse<SolicitudCara>>(`/campanas/${campanaId}/caras`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear cara');
    }
    return response.data.data;
  },

  async deleteCara(campanaId: number, caraId: number): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/campanas/${campanaId}/caras/${caraId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar cara');
    }
  },
};

// Interfaces adicionales para reservas
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
  estatus: string;
  grupo_completo_id: number | null;
  solicitud_cara_id: number;
  aps: number | null;
}

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
}
