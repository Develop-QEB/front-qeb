import api from '../lib/api';
import { Campana, CampanaStats, PaginatedResponse, ApiResponse, ComentarioTarea, CampanaWithComments } from '../types';

import { useEnvironmentStore, getEndpoints, getDeliveryNotesEndpoint, getSeriesForSapDatabase, usaSapPruebas } from '../store/environmentStore';
import type { SapDatabase } from '../store/environmentStore';
export type { CampanaWithComments };

// SAP Configuration
const SAP_BASE_URL = 'https://workflow-namely-changes-nothing.trycloudflare.com';

// Interfaces para SAP Delivery Note
/** Pieza que el backend NO pudo reservar, con su motivo. Permite decirle al
 *  usuario exactamente qué falló en vez de solo un contador. */
export interface ReservaOmitida {
  inventario_id: number;
  codigo_unico: string | null;
  motivo: string;
}

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
  Series?: number;
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

export interface SAPDocumentLineMigrated extends SAPDocumentLine {
  BaseType: number;
  BaseEntry: number;
  BaseLine: number;
}

export interface SAPDeliveryNoteMigrated extends Omit<SAPDeliveryNote, 'DocumentLines'> {
  DocumentLines: SAPDocumentLineMigrated[];
}

// --- Bitácora de POSTs a SAP (campania_post_log) ---
// Snapshot de a quién se mandó cada APS. Necesario porque el Delivery Note se
// arma con el cliente que tiene la campaña EN ESE MOMENTO: si después le cambian
// el cliente (ej. SABA -> Chevrolet), se perdía el rastro de lo ya posteado.
export interface PostLogEntryInput {
  aps: number;
  card_code?: string | null;
  cuic?: number | null;
  razon_social?: string | null;
  marca?: string | null;
  cliente_nombre?: string | null;
  sap_database?: string | null;
  salesperson_code?: number | string | null;
  solicitud_caras_ids?: number[] | string | null;
  success: boolean;
  doc_entry?: number | null;
  doc_num?: number | null;
  error_msg?: string | null;
  payload_json?: string | null;
}

export interface PostLogItem {
  id: number;
  campania_id: number;
  aps: number;
  card_code: string | null;
  cuic: number | null;
  razon_social: string | null;
  marca: string | null;
  cliente_nombre: string | null;
  sap_database: string | null;
  salesperson_code: number | null;
  solicitud_caras_ids: string | null;
  success: boolean;
  doc_entry: number | null;
  doc_num: number | null;
  error_msg: string | null;
  usuario_id: number | null;
  usuario_nombre: string | null;
  posted_at: string;
  catorcena_numero?: number | null; // derivada en getPostLog desde el periodo de la 1ª cara
  catorcena_anio?: number | null;
  accion?: string | null; // 'POST' | 'CANCELACION'
}

export interface SAPPostResponse {
  success: boolean;
  data?: {
    BaseEntry?: number;
    DocNum?: number;
    [key: string]: unknown;
  };
  error?: string;
  // Detalles para el modal cuando algo falla — para que la asesora sepa qué show.
  endpoint?: string;
  status?: number;
  errorType?: 'network' | 'cors' | 'parse' | 'sap-rejected' | 'http-error' | 'timeout';
  rawResponse?: string;
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
  nombre_arte?: string | null; // Nombre manual capturado en la carga (reemplaza al slug del archivo)
  estatus_operaciones?: string | null; // Texto manual de Estatus Operaciones (ficha)
  nombre_generico?: string | null; // Valor único compartido por todos los artes del batch (modo Genérico)
}

export interface DigitalFileSummary {
  idReserva: number;
  totalArchivos: number;
  countImagenes: number;
  countVideos: number;
}

export interface ArteTradicional {
  id: number;
  idReserva: number;
  archivo: string;
  nota: string;
  spot: number;
  createdAt: string | null;
  nombre_arte?: string | null; // Nombre manual capturado en la carga (reemplaza al slug del archivo)
  estatus_operaciones?: string | null; // Texto manual de Estatus Operaciones (ficha)
  nombre_generico?: string | null; // Valor único compartido por todos los artes del batch (modo Genérico)
}

export interface TradicionalFileSummary {
  idReserva: number;
  totalArchivos: number;
  firstNota: string;
}

export interface FichasTecnicasNode {
  name: string;
  type: 'folder' | 'file';
  path?: string;
  ext?: string;
  children?: FichasTecnicasNode[];
}

export interface InventarioReservado {
  rsv_ids: string;
  id: number;
  codigo_unico: string;
  solicitud_caras_id: number | null;
  mueble: string | null;
  tipo_de_mueble: string | null;
  estado: string | null;
  tipo_de_cara: string | null;
  caras_totales: number;
  caras_bonificadas: number;
  caras_renta: number;
  latitud: number;
  longitud: number;
  plaza: string | null;
  estatus_reserva: string | null;
  estatus_inventario: string | null;
  articulo: string | null;
  tipo_medio: string | null;
  inicio_periodo: string | null;
  fin_periodo: string | null;
  tradicional_digital: string | null;
  grupo_completo_id: number | null;
  numero_catorcena?: number | null;
  anio_catorcena?: number | null;
  tarifa_publica?: number | null;
  tarifa_publica_sc?: number | null;
  tarifa_bruta_sc?: number | null; // tarifa publica SIN descuento (costo/caras) — para inversion
  formato?: string | null;
  bonificacion_sc?: number | null;
  renta?: number | null;
  ancho?: number | null;
  alto?: number | null;
  cortesia?: number | null; // 1 = cortesía (de solicitudCaras.cortesia), 0 = normal
}

export interface InventarioConAPS extends InventarioReservado {
  aps: number;
  arte_aprobado?: string | null;
  instalado?: boolean | null;
  estatus_arte?: 'Carga Artes' | 'Revision Artes' | 'Artes Aprobados' | 'En Impresion' | 'Artes Recibidos' | 'Instalado' | null;
  formato?: string | null;
  tarifa_publica_sc?: number | null;
  bonificacion_sc?: number | null;
  renta?: number | null;
  indicaciones_programacion?: string | null;
  indicaciones_instalacion?: string | null;
  archivo?: string | null;
  // true si el APS de este item ya se posteó a SAP (campaña posteada o APS en posted_aps).
  posted?: boolean;
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
  artes_multiples: string | null;
  // JSON string con [{archivo, nota, spot}] por reserva. Permite mostrar
  // varios artes (spots) por reserva con sus notas en la galería del Versionario.
  artes_detalle?: string | null;
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
  // true si la cara tiene una tarea de eliminación abierta (Filtro GC o DG).
  pendiente_eliminacion?: boolean;
  grupo_rt_bf?: number | null;
  cortesia?: number | null;
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
  asignados?: string;
  id_asignado?: string;
  IMU?: boolean;
  cliente_id?: number;
  cuic?: number;
  razon_social?: string;
  marca_nombre?: string;
  asesor?: string;
  sap_database?: string;
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
  nombre: string;     // nombre del archivo (slug del URL)
  url: string;
  usos: number;
  // Campos opcionales para artes ya usados en el flujo (artes_tradicionales / imagenes_digitales).
  // Para artes recien subidos via addedArtes (sin guardar aun), vienen null/undefined.
  nombre_arte?: string | null; // nombre manual capturado en el modal de carga
  nota?: string | null;        // nota asociada (artes_tradicionales.nota o imagenes_digitales.comentario)
  estatus_operaciones?: string | null; // texto manual de Estatus Operaciones (ficha)
  nombre_generico?: string | null;     // valor único compartido por el batch (modo Genérico)
  estatus?: string | null;     // estatus del arte (Aprobado / Rechazado / Pendiente / etc.)
  tiene_instalado?: boolean;   // true si alguna reserva que usa este arte ya esta instalada
}

// Órdenes de Montaje
export interface OrdenMontajeCAT {
  plaza: string | null;
  tipo: string | null; // formato
  asesor: string | null;
  aps_especifico: string | null;
  aps_global: number | null;
  tipo_periodo?: string | null;
  sap_database?: string | null;
  bd_sap_post?: string | null; // BD SAP congelada del POST (por circuito); null si sin post
  cuic: number | null;
  fecha_inicio_periodo: string | null;
  fecha_fin_periodo: string | null;
  cliente: string | null;
  marca: string | null;
  unidad_negocio: string | null;
  campania: string | null;
  numero_articulo: string | null;
  negociacion: 'BONIFICACION' | 'RENTA' | 'CORTESIA' | 'INTERCAMBIO' | 'IMPRESION' | 'RESERVADO' | 'DISPONIBLE';
  caras: number;
  tarifa: number | null;
  monto_total: number | null;
  delta_caras: number;
  campania_id: number | null;
  grupo_id: number | null;
  tipo_fila: string | null;
  catorcena_numero: number | null;
  catorcena_year: number | null;
  tradicional_digital: string | null;
  posted?: boolean;
  // Ocupación de la pieza en el período: 'vendido' (fila de campaña), 'reservado'
  // (hold de propuesta) o 'disponible' (libre). Presente en modos disponible/todo.
  ocupacion_estado?: 'vendido' | 'reservado' | 'disponible' | null;
}

export interface OrdenMontajeINVIAN {
  Campania: string | null;
  Anunciante: string | null;
  Operacion: string | null;
  CodigoContrato: number | null;
  // idquote (APS Global) y campania_id — no se renderizan en la tabla, pero
  // entran al haystack del buscador para poder filtrar por id de campania.
  idquote?: number | null;
  campania_id?: number | null;
  PrecioPorCara: number | null;
  Vendedor: string | null;
  Descripcion: string | null;
  InicioPeriodo: string | null;
  FinSegmento: string | null;
  Arte: string | null;
  CodigoArte: number | null;
  ArteUrl: string | null;
  ArteFileName: string | null;
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
  rsv_id?: number | null;
  tradicional_digital?: string | null;
  indicaciones?: string | null;
  num_artes_digitales?: number | null;
  nombres_artes_digitales?: string | null;
  nombres_archivo_data?: string | null;
  // Orden de Montaje: nombre_arte MANUAL, notas y URL de DO (separados por coma
  // cuando hay varios artes). Aplica a digital y tradicional.
  nombre_arte_manual?: string | null;
  notas_artes?: string | null;
  urls_artes_do?: string | null;
  cortesia?: number | null;
  numero_articulo?: string | null;
  cto?: string | null;
  sap_database?: string | null;
  bd_sap_post?: string | null; // BD SAP congelada del POST (por circuito); null si sin post
  posted?: boolean;
  // Para "Inventario UN+": formato (mueble) y tipo de periodo (mensual/catorcena).
  formato?: string | null;
  tipo_periodo?: string | null;
  // Ocupación de la pieza en el período: 'vendido' (fila de campaña), 'reservado'
  // (hold de propuesta) o 'disponible' (libre). Presente en modos disponible/todo.
  ocupacion_estado?: 'vendido' | 'reservado' | 'disponible' | null;
}

export interface ComentarioRevisionArte {
  id: number;
  tarea_id: number;
  autor_id: number;
  autor_nombre: string;
  contenido: string;
  fecha: string;
}

// Detectar si es campaña migrada desde INVIAN
export function isMigratedCampaign(campana: CampanaWithComments): boolean {
  return campana.comentario_cambio_status === 'Migrado desde INVIAN';
}

// Función para construir el payload de DeliveryNote para SAP
export function buildDeliveryNote(
  campana: CampanaWithComments,
  inventarioAPS: InventarioConAPS[],
  sapDatabase?: string | null,
  articulosMap?: Record<string, { U_IMU_OcrCode?: string; U_IMU_cod_sitio?: number; U_IMU_dscSitio?: string }>
): (SAPDeliveryNote | SAPDeliveryNoteMigrated)[] {
  // Agrupar items por APS - cada APS genera un delivery note separado
  const uniqueAPS = [...new Set(inventarioAPS.map(item => item.aps))];
  const series = sapDatabase ? getSeriesForSapDatabase(sapDatabase as SapDatabase) : 162;

  const deliveryNotes = uniqueAPS.map(apsValue => {
    const itemsForAPS = inventarioAPS.filter(item => item.aps === apsValue);
    // Dentro de cada APS, agrupar por artículo para las DocumentLines
    const uniqueArticulos = [...new Set(itemsForAPS.map(item => item.articulo))];

    // Detectar tipo de período una vez por DN. Ambos (catorcena y mensual)
    // tienen su tabla de IDs SAP — fallback a 1746 si llega un año sin mapeo.
    const tipoPeriodoCamp = (campana as { tipo_periodo?: string | null }).tipo_periodo || 'catorcena';
    const esMensual = tipoPeriodoCamp === 'mensual';

    // Mapeo CATORCENA → ID SAP (solo 2026 por ahora).
    // Patrón: cat 01-2026 = 2856, ..., cat 26-2026 = 2881.
    const CAT_ID_SAP: Record<number, Record<number, number>> = {
      2026: Object.fromEntries(Array.from({ length: 26 }, (_, i) => [i + 1, 2856 + i])),
    };

    // Mapeo MES → ID SAP (solo 2026 por ahora).
    // Patrón: mes 01-2026 = 2882, ..., mes 12-2026 = 2893.
    const MES_ID_SAP: Record<number, Record<number, number>> = {
      2026: { 1: 2882, 2: 2883, 3: 2884, 4: 2885, 5: 2886, 6: 2887, 7: 2888, 8: 2889, 9: 2890, 10: 2891, 11: 2892, 12: 2893 },
    };

    const documentLines: SAPDocumentLine[] = uniqueArticulos.map((articulo, index) => {
      const itemsWithArticulo = itemsForAPS.filter(item => item.articulo === articulo);
      const firstItem = itemsWithArticulo[0];
      // UnitPrice = tarifa BRUTA (costo/caras). El campo tarifa_publica_sc guarda
      // la tarifa DILUIDA (costo/(renta+bonificacion)) — usarla × solo las caras
      // de renta cobra de MENOS porque la bonificacion ya esta restada en la
      // tarifa Y ademas va en linea aparte a $0 (doble conteo). La bruta cobra
      // correcto: costo/caras_renta × caras_renta = costo real. Ver ticket 80531.
      const totalPrice = Number(firstItem.tarifa_bruta_sc) || Number(firstItem.tarifa_publica_sc) || Number(firstItem.tarifa_publica) || 0;

      // Período: mensual ("MES NN-YYYY" + ID por mes) vs catorcena ("CATORCENA NN-YYYY" + ID por cat).
      let dscPeriod: string;
      let codPer = 1746;
      if (esMensual && firstItem.inicio_periodo) {
        const fIni = new Date(firstItem.inicio_periodo);
        const mes = fIni.getUTCMonth() + 1;
        const anio = fIni.getUTCFullYear();
        dscPeriod = `MES ${String(mes).padStart(2, '0')}-${anio}`;
        codPer = MES_ID_SAP[anio]?.[mes] ?? 1746;
      } else if (firstItem.numero_catorcena && firstItem.anio_catorcena) {
        const cat = Number(firstItem.numero_catorcena);
        const anio = Number(firstItem.anio_catorcena);
        dscPeriod = `CATORCENA ${String(cat).padStart(2, '0')}-${anio}`;
        codPer = CAT_ID_SAP[anio]?.[cat] ?? 1746;
      } else {
        dscPeriod = 'CATORCENA —-—';
      }

      // Quantity = suma de caras_totales de cada item (no usar .length).
      // - IM (impresión): caras_totales = sc.caras del SC (total contratado).
      // - RT/BF/CT/etc: caras_totales = count de reservas en el grupo.
      //   Para grupos completos (Flujo + Contraflujo unidos en 1 fila) viene 2,
      //   para caras individuales viene 1. Antes usábamos .length que ignoraba
      //   el grupo completo y mandaba menos caras a SAP (bug campaña 80357:
      //   120 caras en QEB → 118 en SAP por 2 muebles completos).
      const articuloCode = (firstItem.articulo || '').toUpperCase();
      const quantity = itemsWithArticulo.reduce((s, i) => s + (Number(i.caras_totales) || 1), 0);

      // U_CodTAsig + U_dscTAsig deben ser un par válido en SAP:
      //   200 = "Venta"        (para RT-* o reservas vendidas)
      //   201 = "Intercambio"  (para IN-* / artículos de intercambio)
      //   204 = "Bonificado"   (para BF/CF/CT o reservas bonificadas)
      // SAP rechaza con -2028 si la descripción no coincide con un código
      // existente en su tabla — por eso NO mandamos textos custom como
      // "Vendido bonificado" o "Reservado", siempre la descripción canónica
      // del CodTAsig que está enviando.
      const isRenta = articuloCode.startsWith('RT-') || articuloCode.startsWith('RT_');
      // Intercambio se identifica por artículo IN-* (misma convención que en
      // todo el flujo: caras, KPIs, autorización). Contablemente NO es venta.
      const isIntercambio = articuloCode.startsWith('IN');
      const isBonifiedEstatus =
        firstItem.estatus_reserva === 'Bonificado' ||
        firstItem.estatus_reserva === 'Vendido bonificado';
      // Precedencia: Intercambio (201) gana sobre todo — aunque el estatus de
      // la reserva sea "Vendido", un artículo IN-* va como Intercambio.
      // Luego Renta gana sobre estatus bonificado (RT-* siempre Venta).
      // El resto bonificado → 204; lo demás → 200 Venta.
      let codTAsig: number;
      let dscTAsig: string;
      if (isIntercambio) {
        codTAsig = 201;
        dscTAsig = 'Otros'; // descripción canónica del código 201 en SAP
      } else if (!isRenta && isBonifiedEstatus) {
        codTAsig = 204;
        dscTAsig = 'Bonificado';
      } else {
        codTAsig = 200;
        dscTAsig = 'Venta';
      }

      return {
        LineNum: index.toString(),
        ItemCode: firstItem.articulo || '',
        Quantity: quantity.toString(),
        TaxCode: 'A4',
        UnitPrice: String(totalPrice || 0),
        CostingCode: articulosMap?.[firstItem.articulo || '']?.U_IMU_OcrCode || '02-03-04',
        CostingCode2: '1',
        U_Cod_Sitio: articulosMap?.[firstItem.articulo || '']?.U_IMU_cod_sitio || 11,
        U_dscSitio: articulosMap?.[firstItem.articulo || '']?.U_IMU_dscSitio || firstItem.plaza || firstItem.estado || '',
        U_CodTAsig: codTAsig,
        U_dscTAsig: dscTAsig,
        U_CodPer: codPer,
        U_dscPeriod: dscPeriod,
        U_FechInPer: firstItem.inicio_periodo?.split('T')[0] || '',
        U_FechFinPer: firstItem.fin_periodo?.split('T')[0] || '',
      };
    });

    const deliveryNote: SAPDeliveryNote = {
      Series: series,
      CardCode: campana.card_code || 'IMU00351',
      NumAtCard: campana.id?.toString() || '',
      Comments: campana.comentario_cambio_status || '',
      DocDueDate: (campana.fecha_fin || new Date().toISOString()).split('T')[0],
      // TRADE: SAP espera siempre -1 ("directo / sin asesor"), sin importar
      // el salesperson_code del cliente (regla de negocio IMU). CIMU/TEST sí
      // usan el real, fallback a -1 si null.
      SalesPersonCode: sapDatabase === 'TRADE' ? -1 : ((campana as any).salesperson_code || -1),
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
      U_IMU_ART_APS: (campana.propuesta_id || campana.id)?.toString() || '',
      U_IMU_CotNum: String(apsValue || ''),
      DocumentLines: documentLines,
    };

    return deliveryNote;
  });

  // Si es campaña migrada desde INVIAN, agregar BaseType/BaseDocNum en cada línea
  if (isMigratedCampaign(campana)) {
    return deliveryNotes.map(dn => ({
      ...dn,
      DocumentLines: dn.DocumentLines.map(line => ({
        ...line,
        BaseType: 17,
        BaseEntry: 0, // se resuelve con resolveBaseEntry()
        BaseLine: 0, // se resuelve con resolveBaseEntry()
      })),
    } as SAPDeliveryNoteMigrated));
  }

  return deliveryNotes;
}

// Busca el BaseEntry de una Order en SAP por DocNum (APS)
export async function resolveBaseEntry(
  deliveryNote: SAPDeliveryNoteMigrated,
  docNum: string,
  sapDatabase: string
): Promise<SAPDeliveryNoteMigrated> {
  const dbMap: Record<string, string> = {
    'TRADE': 'SBOIMUTRADE',
    'CIMU': 'SBOCIMU',
    'TEST': 'PB_SBOCIMU',
  };
  const db = usaSapPruebas(sapDatabase as SapDatabase) ? 'PB_SBOCIMU' : (dbMap[sapDatabase] || 'PB_SBOCIMU');

  const response = await fetch(`${SAP_BASE_URL}/order-by-docnum/${db}/${docNum}`);
  if (!response.ok) {
    throw new Error(`No se encontró la Order con DocNum ${docNum} en ${db}`);
  }

  const order = await response.json();

  return {
    ...deliveryNote,
    DocumentLines: deliveryNote.DocumentLines.map(line => {
      const matchingLines = order.DocumentLines.filter((ol: { ItemCode: string; LineNum: number }) => ol.ItemCode === line.ItemCode);
      const orderLine = matchingLines.length > 0 ? matchingLines[matchingLines.length - 1] : null;
      return {
        ...line,
        BaseEntry: order.DocEntry,
        BaseLine: orderLine ? orderLine.LineNum : 0,
      };
    }),
  };
}

// Función para hacer POST a SAP. Maneja con cuidado los 3 modos de falla
// reales que las asesoras reportan:
//   1. Tunnel muerto / Cloudflare devolvió HTML 5xx (network o cors).
//   2. SAP procesó el POST pero la respuesta llegó malformada/vacía (parse).
//   3. SAP rechazó por validación de negocio (sap-rejected).
// Cuando se devuelve `success: false` el caller puede usar `errorType`,
// `endpoint`, `status`, `rawResponse` para mostrar info útil al usuario.
export async function postDeliveryNoteToSAP(deliveryNote: SAPDeliveryNote | SAPDeliveryNoteMigrated, sapDatabase?: string | null): Promise<SAPPostResponse> {
  const endpoint = sapDatabase
    ? getDeliveryNotesEndpoint(sapDatabase as SapDatabase)
    : `${SAP_BASE_URL}/delivery-notes-test`;
  const envLabel = sapDatabase || 'TEST';
  let response: Response;

  // Paso 1: hacer el fetch — si esto falla es problema de red / tunnel / CORS.
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deliveryNote),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error de conexión';
    console.error('[SAP POST] Error de red:', msg, 'endpoint:', endpoint);
    // 'Failed to fetch' suele ser CORS o tunnel caído. Distingo si puedo.
    const isCors = msg.toLowerCase().includes('cors') || msg.toLowerCase().includes('opaque');
    return {
      success: false,
      error: msg,
      endpoint,
      errorType: isCors ? 'cors' : 'network',
    };
  }

  // Paso 2: parsear el body como texto primero. Si SAP procesó pero el
  // proxy/tunnel cortó la respuesta, podemos al menos saber HTTP status.
  let rawText = '';
  try {
    rawText = await response.text();
  } catch (error) {
    console.error('[SAP POST] No pude leer body:', error);
    return {
      success: false,
      error: `Respuesta de SAP ilegible (HTTP ${response.status}). Verifica en SAP si el delivery note se creó antes de reintentar.`,
      endpoint,
      status: response.status,
      errorType: 'parse',
    };
  }

  // Paso 3: intentar parsear como JSON. Si falla → respuesta no es JSON
  // (probablemente HTML de error de Cloudflare).
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    console.error('[SAP POST] Body no es JSON:', rawText.slice(0, 300));
    return {
      success: false,
      error: response.ok
        ? `SAP respondió OK pero el body no es JSON. Verifica en SAP si el delivery note se creó.`
        : `Cloudflare/proxy devolvió error HTTP ${response.status} con HTML en lugar de JSON.`,
      endpoint,
      status: response.status,
      errorType: 'parse',
      rawResponse: rawText.slice(0, 500),
    };
  }

  console.log('========== SAP RESPONSE ==========');
  console.log('Status:', response.status, 'Endpoint:', endpoint);
  console.log('Series:', (deliveryNote as any).Series);
  console.log('Response data:', JSON.stringify(data, null, 2));
  console.log('==================================');

  // Paso 4: extraer mensaje útil cuando SAP rechaza por validación.
  const getDetailedError = () => {
    if (data?.details?.error?.message?.value) {
      const sapError = data.details.error.message.value;
      if (sapError.includes('Invalid BP code')) {
        const cardCode = sapError.match(/'([^']+)'/)?.[1] || '';
        return `El CardCode '${cardCode}' no existe en el ambiente ${envLabel} de SAP`;
      }
      if (sapError.includes('is inactive')) {
        return `Error SAP: ${sapError}`;
      }
      return sapError;
    }
    return data?.message || data?.error || `Error ${response.status}: ${response.statusText}`;
  };

  if (!response.ok || data?.success === false) {
    return {
      success: false,
      error: getDetailedError(),
      endpoint,
      status: response.status,
      errorType: response.ok ? 'sap-rejected' : 'http-error',
      rawResponse: rawText.slice(0, 500),
    };
  }

  return { success: true, data, endpoint, status: response.status };
}

// Mapa BD QEB → DB SAP (mismo que en resolveBaseEntry).
const SAP_DB_NAME_MAP: Record<string, string> = {
  TRADE: 'SBOIMUTRADE',
  CIMU: 'SBOCIMU',
  TEST: 'PB_SBOCIMU',
};

export interface ExistingDeliveryNote {
  exists: true;
  DocEntry: number;
  DocNum: number;
  NumAtCard: string;
  DocumentLines: Array<{ LineNum: number; ItemCode: string; Quantity: number; UnitPrice: number }>;
}

// Busca si una campaña ya tiene Delivery Note en SAP. Devuelve el DN existente
// con su DocEntry para que el caller decida POST (crear) o PATCH (actualizar).
// 404 ⇒ null. Cualquier otro error vuela como excepción.
export async function findExistingDeliveryNote(numAtCard: string | number, sapDatabase?: string | null): Promise<ExistingDeliveryNote | null> {
  const db = usaSapPruebas((sapDatabase || 'TEST') as SapDatabase) ? 'PB_SBOCIMU' : (SAP_DB_NAME_MAP[sapDatabase || 'TEST'] || 'PB_SBOCIMU');
  const url = `${SAP_BASE_URL}/delivery-note-by-numatcard/${db}/${numAtCard}`;
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`No se pudo verificar DN existente (HTTP ${response.status})`);
  }
  return await response.json();
}

// PATCH a un DN existente en SAP. Mismo manejo defensivo de errores que POST.
export async function patchDeliveryNoteToSAP(docEntry: number, deliveryNote: SAPDeliveryNote | SAPDeliveryNoteMigrated, sapDatabase?: string | null): Promise<SAPPostResponse> {
  const db = usaSapPruebas((sapDatabase || 'TEST') as SapDatabase) ? 'PB_SBOCIMU' : (SAP_DB_NAME_MAP[sapDatabase || 'TEST'] || 'PB_SBOCIMU');
  const endpoint = `${SAP_BASE_URL}/delivery-notes/${db}/${docEntry}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deliveryNote),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error de conexión';
    return { success: false, error: msg, endpoint, errorType: 'network' };
  }

  let rawText = '';
  try { rawText = await response.text(); } catch { /* ignore */ }

  let data: any = null;
  if (rawText) {
    try { data = JSON.parse(rawText); } catch {
      return {
        success: false,
        error: response.ok
          ? 'PATCH respondió OK pero el body no es JSON. Verifica en SAP.'
          : `HTTP ${response.status}: respuesta no es JSON`,
        endpoint,
        status: response.status,
        errorType: 'parse',
        rawResponse: rawText.slice(0, 500),
      };
    }
  }

  console.log('========== SAP PATCH RESPONSE ==========');
  console.log('Status:', response.status, 'Endpoint:', endpoint);
  console.log('Response data:', JSON.stringify(data, null, 2));
  console.log('========================================');

  if (!response.ok || data?.success === false) {
    return {
      success: false,
      error: data?.details?.error?.message?.value || data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`,
      endpoint,
      status: response.status,
      errorType: response.ok ? 'sap-rejected' : 'http-error',
      rawResponse: rawText.slice(0, 500),
    };
  }

  return { success: true, data: data || { DocEntry: docEntry }, endpoint, status: response.status };
}

export interface CampanasParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  yearInicio?: number;
  yearFin?: number;
  catorcenaInicio?: number;
  catorcenaFin?: number;
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

export const campanasService = {
  async getAll(params: CampanasParams = {}): Promise<PaginatedResponse<Campana>> {
    const response = await api.get<PaginatedResponse<Campana>>('/campanas', { params });
    return response.data;
  },

  async getExportLayout(params: Omit<CampanasParams, 'page' | 'limit'> = {}): Promise<{
    inventarios: any[];
    campaignInfo: any[];
    campaignsWithInventory: number[];
  }> {
    const response = await api.get<ApiResponse<any>>('/campanas/export-layout', { params, timeout: 120000 });
    return response.data.data;
  },

  async getBatchInversiones(ids: number[]): Promise<Record<number, Record<string, { inversion: number; circuitos: number; bonificadas: number; carasNetas: number }>>> {
    const response = await api.post<ApiResponse<Record<number, Record<string, { inversion: number; circuitos: number; bonificadas: number; carasNetas: number }>>>>('/campanas/batch-inversiones', { ids });
    return response.data.data || {};
  },

  async getBatchInversionesCostoPorCatorcena(ids: number[]): Promise<Record<number, Record<string, { inversion: number }>>> {
    const response = await api.post<ApiResponse<Record<number, Record<string, { inversion: number }>>>>('/campanas/batch-inversiones-costo', { ids });
    return response.data.data || {};
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

  async getStats(params?: Omit<CampanasParams, 'page' | 'limit'>): Promise<CampanaStats> {
    const response = await api.get<ApiResponse<CampanaStats>>('/campanas/stats', { params });
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

  async markPostedToSAP(id: number): Promise<void> {
    await api.post(`/campanas/${id}/mark-posted-sap`);
  },

  async markPostedAPS(id: number, aps: number[]): Promise<number[]> {
    const response = await api.post<{ success: boolean; posted_aps: number[] }>(`/campanas/${id}/mark-posted-aps`, { aps });
    return response.data.posted_aps;
  },

  async unmarkPostedAPS(id: number, aps?: number[]): Promise<number[]> {
    const response = await api.post<{ success: boolean; posted_aps: number[] }>(`/campanas/${id}/unmark-posted-aps`, { aps });
    return response.data.posted_aps;
  },

  // Bitácora de POSTs a SAP — guarda a QUIÉN se mandó cada APS (snapshot).
  async registrarPostLog(id: number, entries: PostLogEntryInput[]): Promise<number> {
    const response = await api.post<{ success: boolean; registradas: number }>(`/campanas/${id}/post-log`, { entries });
    return response.data.registradas;
  },

  async getPostLog(id: number): Promise<PostLogItem[]> {
    const response = await api.get<ApiResponse<PostLogItem[]>>(`/campanas/${id}/post-log`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener la bitácora de POST');
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

  async getBatchInventarios(ids: number[]): Promise<Record<number, InventarioConAPS[]>> {
    const response = await api.get<ApiResponse<Record<number, InventarioConAPS[]>>>(`/campanas/batch-inventarios`, {
      params: { ids: ids.join(',') },
      timeout: 120000,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventarios batch');
    }
    return response.data.data;
  },

  async assignAPS(id: number, inventarioIds: number[], solicitudCarasIds?: number[], rsvIds?: number[]): Promise<{ aps: number; message: string }> {
    const response = await api.post<ApiResponse<{ aps: number; message: string }>>(`/campanas/${id}/assign-aps`, { inventarioIds, campanaId: id, solicitudCarasIds, rsvIds });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al asignar APS');
    }
    return response.data.data;
  },

  // Asigna APS + lo etiqueta Pre Factura (back lo agrega a campania.prefactura_aps).
  // El badge dorado en Con APS se pinta leyendo `campana.prefactura_aps`.
  async assignAPSPrefactura(id: number, inventarioIds: number[], solicitudCarasIds?: number[], rsvIds?: number[]): Promise<{ aps: number; message: string }> {
    const response = await api.post<ApiResponse<{ aps: number; message: string }>>(`/campanas/${id}/assign-aps-prefactura`, { inventarioIds, campanaId: id, solicitudCarasIds, rsvIds });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al asignar APS Pre Factura');
    }
    return response.data.data;
  },

  // Cancela la etiqueta Pre Factura — quita los APS del JSON y regresa las
  // reservas a Sin APS (decisión: forzar reasignación con APS nuevo real).
  async cancelPrefactura(id: number, aps: number[]): Promise<number[]> {
    const response = await api.post<{ success: boolean; prefactura_aps: number[] }>(`/campanas/${id}/cancel-prefactura`, { aps });
    return response.data.prefactura_aps;
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

  async removeAPS(id: number, reservaIds: number[], solicitudCarasIds: number[] = []): Promise<{ message: string; affected: number }> {
    const response = await api.post<ApiResponse<{ message: string; affected: number }>>(`/campanas/${id}/remove-aps`, { reservaIds, solicitudCarasIds });
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

  // includeWithoutAps=true incluye tambien items que aun no tienen APS asignado
  // (usado por el preview de Versionario Artes para que se vean circuitos pendientes).
  async getInventarioSinArte(id: number, opts?: { includeWithoutAps?: boolean; grouped?: boolean }): Promise<InventarioConArte[]> {
    const params: Record<string, string> = {};
    if (opts?.includeWithoutAps) params.includeWithoutAps = 'true';
    if (opts?.grouped) params.grouped = 'true';
    const response = await api.get<ApiResponse<InventarioConArte[]>>(`/campanas/${id}/inventario-sin-arte`, { params: Object.keys(params).length ? params : undefined });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario sin arte');
    }
    return response.data.data;
  },

  // BULK: inventario (con+sin arte) de varias campañas en 1 request. Para el
  // Versionario de Artes (evita 2 llamadas por campaña).
  // Acepta `signal` (AbortController) y `timeout` para que el orquestador del
  // Versionario pueda cancelar requests en vuelo y rendirse en chunks colgados
  // en lugar de bloquear el wave completo con Promise.all.
  async getInventarioVersionarioBulk(
    ids: number[],
    opts?: { includeWithoutAps?: boolean; signal?: AbortSignal; timeout?: number }
  ): Promise<Record<string, { conArte: InventarioConArte[]; sinArte: InventarioConArte[] }>> {
    const params: Record<string, string> = { ids: ids.join(',') };
    if (opts?.includeWithoutAps) params.includeWithoutAps = 'true';
    const response = await api.get<ApiResponse<Record<string, { conArte: InventarioConArte[]; sinArte: InventarioConArte[] }>>>(
      `/campanas/inventario-versionario-bulk`,
      { params, signal: opts?.signal, timeout: opts?.timeout },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario bulk');
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

  async assignArte(id: number, reservaIds: number[], archivo: string, markInstalado: boolean = false, instalacionMode?: 'instalado' | 'rotacion', operacionesAsignados?: { ids: number[]; nombres: string[] } | null): Promise<{ message: string; affected: number; marked_instalado?: boolean }> {
    const opsPayload = (markInstalado && operacionesAsignados && operacionesAsignados.ids.length > 0)
      ? {
          idAsignadoOperaciones: operacionesAsignados.ids.join(','),
          asignadoOperaciones: operacionesAsignados.nombres.join(','),
        }
      : {};
    const response = await api.post<ApiResponse<{ message: string; affected: number; marked_instalado?: boolean }>>(`/campanas/${id}/assign-arte`, {
      reservaIds,
      archivo,
      ...(markInstalado ? { markInstalado: true, instalacionMode: instalacionMode || 'instalado' } : {}),
      ...opsPayload,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al asignar arte');
    }
    return response.data.data;
  },

  async assignArteDigital(
    id: number,
    reservaIds: number[],
    archivos: { archivo: string; spot: number; nombre: string; tipo: string; nota?: string; nombre_arte?: string | null; estatus_operaciones?: string | null; nombre_generico?: string | null }[],
    markInstalado: boolean = false,
    instalacionMode?: 'instalado' | 'rotacion',
    operacionesAsignados?: { ids: number[]; nombres: string[] } | null
  ): Promise<{ message: string; affected: number; marked_instalado?: boolean }> {
    const opsPayload = (markInstalado && operacionesAsignados && operacionesAsignados.ids.length > 0)
      ? {
          idAsignadoOperaciones: operacionesAsignados.ids.join(','),
          asignadoOperaciones: operacionesAsignados.nombres.join(','),
        }
      : {};
    const response = await api.post<ApiResponse<{ message: string; affected: number; marked_instalado?: boolean }>>(`/campanas/${id}/assign-arte-digital`, {
      reservaIds,
      archivos,
      ...(markInstalado ? { markInstalado: true, instalacionMode: instalacionMode || 'instalado' } : {}),
      ...opsPayload,
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

  // BULK: todas las imágenes digitales de la campaña en 1 request, con el
  // id_reserva REAL de cada archivo. Usado por el Versionario al descargar Excel.
  async getImagenesDigitalesBulk(
    campanaId: number,
    opts?: { signal?: AbortSignal; timeout?: number }
  ): Promise<ImagenDigital[]> {
    const response = await api.get<ApiResponse<ImagenDigital[]>>(
      `/campanas/${campanaId}/imagenes-digitales-bulk`,
      { signal: opts?.signal, timeout: opts?.timeout },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener imágenes digitales bulk');
    }
    return response.data.data;
  },

  async getReservaArchivo(campanaId: number, reservaId: number): Promise<string | null> {
    const response = await api.get<ApiResponse<{ archivo: string | null }>>(`/campanas/${campanaId}/reserva-archivo/${reservaId}`);
    if (!response.data.success || !response.data.data) {
      return null;
    }
    return response.data.data.archivo;
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

  async assignArteTradicional(
    id: number,
    reservaIds: number[],
    archivos: { archivo: string; nota: string; spot: number; nombre_arte?: string | null; estatus_operaciones?: string | null; nombre_generico?: string | null }[],
    markInstalado: boolean = false,
    instalacionMode?: 'instalado' | 'rotacion',
    operacionesAsignados?: { ids: number[]; nombres: string[] } | null
  ): Promise<{ message: string; affected: number; marked_instalado?: boolean }> {
    const opsPayload = (markInstalado && operacionesAsignados && operacionesAsignados.ids.length > 0)
      ? {
          idAsignadoOperaciones: operacionesAsignados.ids.join(','),
          asignadoOperaciones: operacionesAsignados.nombres.join(','),
        }
      : {};
    const response = await api.post<ApiResponse<{ message: string; affected: number; marked_instalado?: boolean }>>(`/campanas/${id}/assign-arte-tradicional`, {
      reservaIds,
      archivos,
      ...(markInstalado ? { markInstalado: true, instalacionMode: instalacionMode || 'instalado' } : {}),
      ...opsPayload,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al asignar arte tradicional');
    }
    return response.data.data;
  },

  async getArtesTradicionales(campanaId: number, reservaId: number | string): Promise<ArteTradicional[]> {
    const response = await api.get<ApiResponse<ArteTradicional[]>>(`/campanas/${campanaId}/artes-tradicionales/${reservaId}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener artes tradicionales');
    }
    return response.data.data;
  },

  async getTradicionalFileSummaries(campanaId: number): Promise<TradicionalFileSummary[]> {
    const response = await api.get<ApiResponse<TradicionalFileSummary[]>>(`/campanas/${campanaId}/tradicional-file-summaries`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener resumen de artes tradicionales');
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
    // Forzar filename para que multer no lo pierda. Antes al hacer append(file, file)
    // sin nombre explicito, en algunos entornos el mimetype/nombre no llegaba y
    // multer terminaba pasando 96 bytes de basura en vez del binario real.
    formData.append('file', file, file.name || `foto-${Date.now()}.jpg`);

    // NO setear Content-Type manualmente. Axios/browser lo pone con boundary=
    // ----XXX que multer necesita para parsear el multipart. Si lo hardcodeas
    // como "multipart/form-data" sin boundary el body se corrompe.
    const response = await api.post<ApiResponse<{ url: string; filename: string; originalName: string; size: number; mimetype: string }>>('/uploads/testigo', formData);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al subir archivo de testigo');
    }
    return response.data.data;
  },

  async getFichasTecnicasTree(): Promise<FichasTecnicasNode[]> {
    const response = await api.get<ApiResponse<FichasTecnicasNode[]>>('/fichas-tecnicas/tree');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener fichas técnicas');
    }
    return response.data.data;
  },

  async openFichaTecnica(filePath: string): Promise<void> {
    const response = await api.get<ApiResponse<{ url: string }>>(`/fichas-tecnicas/file`, {
      params: { path: filePath },
    });
    if (!response.data.success || !response.data.data?.url) {
      throw new Error('Error al obtener URL del archivo');
    }
    window.open(response.data.data.url, '_blank');
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

  async completarCorreccionEnviarRevision(
    id: number,
    payload: {
      correccionId: number;
      reservaIds: number[];
      asignadoNombres: string;
      asignadoIds?: string;
    }
  ): Promise<{ message: string; nuevaRevisionId?: number; affected: number; alreadyDone?: boolean }> {
    const response = await api.post<ApiResponse<{ message: string; nuevaRevisionId?: number; affected: number; alreadyDone?: boolean }>>(
      `/campanas/${id}/completar-correccion`,
      payload
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al completar la corrección');
    }
    return response.data.data;
  },

  async updateArteEstatusOperaciones(
    campanaId: number,
    archivo: string,
    estatus_operaciones: string | null
  ): Promise<{ affected: number; tradicional: number; digital: number; archivo: string; estatus_operaciones: string | null }> {
    const response = await api.patch<ApiResponse<{ affected: number; tradicional: number; digital: number; archivo: string; estatus_operaciones: string | null }>>(
      `/campanas/${campanaId}/artes/estatus-operaciones`,
      { archivo, estatus_operaciones }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar estatus de operaciones');
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

  async enviarOrdenProgramacion(campanaId: number, tareaId: number): Promise<{
    orden: { id: number; estatus: string };
    programacion: { id: number; estatus: string };
  }> {
    const response = await api.post<ApiResponse<{
      orden: { id: number; estatus: string };
      programacion: { id: number; estatus: string };
    }>>(`/campanas/${campanaId}/tareas/${tareaId}/enviar-orden-programacion`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al enviar orden de programación');
    }
    return response.data.data;
  },

  async activarOrdenInstalacion(campanaId: number, tareaId: number): Promise<{
    orden: { id: number; estatus: string };
    instalacion: { id: number; estatus: string };
  }> {
    const response = await api.post<ApiResponse<{
      orden: { id: number; estatus: string };
      instalacion: { id: number; estatus: string };
    }>>(`/campanas/${campanaId}/tareas/${tareaId}/activar-orden-instalacion`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al activar orden de instalación');
    }
    return response.data.data;
  },

  async deleteTarea(id: number, tareaId: number): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/campanas/${id}/tareas/${tareaId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar tarea');
    }
  },

  async getUsuariosOperaciones(): Promise<{ id: number; nombre: string; area: string; puesto: string; user_role: string }[]> {
    const response = await api.get<ApiResponse<{ id: number; nombre: string; area: string; puesto: string; user_role: string }[]>>(`/campanas/usuarios/operaciones`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener usuarios de Operaciones');
    }
    return response.data.data;
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
    ocupacion?: 'vendido' | 'disponible' | 'todo';
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
    ocupacion?: 'vendido' | 'disponible' | 'todo';
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
  ): Promise<{ calendarioId: number; reservasCreadas: number; reservasOmitidas?: number; omitidos?: ReservaOmitida[] }> {
    const response = await api.post<ApiResponse<{ calendarioId: number; reservasCreadas: number; reservasOmitidas?: number; omitidos?: ReservaOmitida[] }>>(
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

  async bulkUpdateCaras(campanaId: number, caras: { caraId: number; data: CaraUpdateData }[]): Promise<{ updated: SolicitudCara[]; message: string }> {
    const response = await api.patch<ApiResponse<SolicitudCara[]> & { message?: string }>(`/campanas/${campanaId}/caras/bulk`, { caras });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al actualizar caras en lote');
    }
    return { updated: response.data.data || [], message: response.data.message || '' };
  },

  async createCara(campanaId: number, data: CaraUpdateData): Promise<SolicitudCara> {
    const response = await api.post<ApiResponse<SolicitudCara>>(`/campanas/${campanaId}/caras`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear cara');
    }
    return response.data.data;
  },

  // En CAMPAÑAS, eliminar caras crea una solicitud de autorización (Filtro GC → DG)
  // en vez de borrar; la respuesta trae requiereAutorizacion + message. Se pueden
  // pasar cara-ids adicionales (ej. la pareja RT/BF) para que UNA sola solicitud
  // cubra todas y no se generen tareas separadas.
  async deleteCara(campanaId: number, caraId: number, eliminarGrupo?: boolean, caraIdsAdicionales?: number[], sinAutorizacion?: boolean): Promise<{ requiereAutorizacion?: boolean; message?: string; caras?: number }> {
    // sinAutorizacion=true: borra al momento (uso INTERNO: reemplazo de par BF en
    // edición). El borrado normal del usuario NO lo pasa → va por autorización.
    const qs = new URLSearchParams();
    if (eliminarGrupo) qs.set('eliminarGrupo', 'true');
    if (sinAutorizacion) qs.set('sinAutorizacion', 'true');
    const url = `/campanas/${campanaId}/caras/${caraId}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const body = (caraIdsAdicionales && caraIdsAdicionales.length > 0) ? { caraIdsAdicionales } : undefined;
    const response = await api.delete<ApiResponse<void> & { requiereAutorizacion?: boolean; message?: string; caras?: number }>(url, body ? { data: body } : undefined);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar cara');
    }
    return (response.data as unknown) as { requiereAutorizacion?: boolean; message?: string; caras?: number };
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
  estatus_inventario: string | null;
  grupo_completo_id: number | null;
  solicitud_cara_id: number;
  aps: number | null;
  isla?: string | null;
  articulo?: string;
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
  grupo_rt_bf?: number | null;
}
