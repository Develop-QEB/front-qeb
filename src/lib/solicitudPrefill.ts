import type { Cliente } from '../types';
import type { UserOption } from '../services/solicitudes.service';

/**
 * Prellenado de "Nueva solicitud" desde QEBooh.
 *
 * El back (qeb-Back/src/mcp/solicitud.ts, herramienta preparar_solicitud) valida
 * los datos y los manda como acción del chat. Aquí se convierten en el MISMO
 * borrador que el formulario guarda solo en localStorage (CreateSolicitudModal,
 * clave qeb_solicitud_draft), así que el formulario lo restaura con su lógica de
 * siempre y no hay un segundo camino de carga que mantener.
 */

export const CLAVE_BORRADOR_SOLICITUD = 'qeb_solicitud_draft';

/** Forma en que el formulario guarda el cliente elegido (selectedCuic). */
export interface CuicItem {
  id: number;
  CUIC: number;
  T0_U_RazonSocial: string;
  T0_U_Cliente: string;
  T1_U_UnidadNegocio: string;
  T0_U_Agencia: string;
  ASESOR_U_IDAsesor: string;
  ASESOR_U_Asesor: string;
  T1_U_IDMarca: number;
  T2_U_Marca: string;
  T2_U_IDProducto: number;
  T2_U_Producto: string;
  T2_U_IDCategoria: number;
  T2_U_Categoria: string;
  ACA_U_SAPCode: string;
  ASESOR_U_SAPCode_Original?: number;
  sap_database?: string | null;
}

/**
 * Fila de la tabla cliente → cliente del formulario. Única fuente de este mapeo:
 * la usan el selector de CUIC del formulario y el prellenado de QEBooh.
 */
export function clienteACuicItem(c: Cliente): CuicItem {
  return {
    id: c.id,
    CUIC: c.CUIC!,
    T0_U_RazonSocial: c.T0_U_RazonSocial || '',
    T0_U_Cliente: c.T0_U_Cliente || '',
    T1_U_UnidadNegocio: c.T1_U_UnidadNegocio || '',
    T0_U_Agencia: c.T0_U_Agencia || '',
    ASESOR_U_IDAsesor: c.ASESOR_U_IDAsesor || String(c.T0_U_IDAsesor || ''),
    ASESOR_U_Asesor: c.ASESOR_U_Asesor || c.T0_U_Asesor || '',
    T1_U_IDMarca: c.T1_U_IDMarca || 0,
    T2_U_Marca: c.T2_U_Marca || '',
    T2_U_IDProducto: c.T2_U_IDProducto || 0,
    T2_U_Producto: c.T2_U_Producto || '',
    T2_U_IDCategoria: c.T2_U_IDCategoria || 0,
    T2_U_Categoria: c.T2_U_Categoria || '',
    ACA_U_SAPCode: c.card_code || '',
    ASESOR_U_SAPCode_Original: c.salesperson_code ?? undefined,
    sap_database: c.sap_database || null,
  };
}

/** Datos que manda el back en la acción prefill_solicitud. */
export interface PrefillSolicitud {
  cliente: Cliente;
  asignados: UserOption[];
  nombreCampania: string;
  descripcion: string;
  notas: string;
  yearInicio: number;
  catorcenaInicio: number;
  yearFin: number;
  catorcenaFin: number;
}

/**
 * Orden de QEBooh para llenar el circuito en captura del formulario abierto
 * (herramienta llenar_circuito del back). Solo `articulo` es obligatorio.
 */
export interface OrdenCircuito {
  articulo: string;
  articuloBf?: string;
  anioInicio?: number;
  catorcenaInicio?: number;
  anioFin?: number;
  catorcenaFin?: number;
  renta?: number;
  bonificacion?: number;
  nse?: string[];
  /** "Todos" los NSE: se seleccionan todos los que existan en la plaza del artículo. */
  nseTodos?: boolean;
  tarifaPublica?: number;
  descripcion?: string;
}

export type AccionQEBooh =
  | { tipo: 'prefill_solicitud'; datos: PrefillSolicitud }
  | { tipo: 'llenar_circuito'; datos: OrdenCircuito };

/** ¿Hay un borrador de solicitud con datos que se perdería al prellenar? */
export function hayBorradorSolicitud(): boolean {
  try {
    const crudo = localStorage.getItem(CLAVE_BORRADOR_SOLICITUD);
    if (!crudo) return false;
    const b = JSON.parse(crudo);
    return Boolean(b?.nombreCampania || b?.selectedCuic || b?.caras?.length);
  } catch {
    return false;
  }
}

/**
 * Escribe el borrador prellenado. Abre en el paso 3 (circuitos): los pasos 1 y 2
 * quedan completos. origen='qebooh' solo cambia el aviso que muestra el formulario.
 * Devuelve false si no se pudo escribir (localStorage bloqueado o lleno).
 */
export function escribirBorradorDesdeQEBooh(p: PrefillSolicitud): boolean {
  const borrador = {
    origen: 'qebooh',
    step: 3,
    selectedCuic: clienteACuicItem(p.cliente),
    selectedAsignados: p.asignados.map(a => ({ id: a.id, nombre: a.nombre, area: a.area || '', puesto: a.puesto || '' })),
    nombreCampania: p.nombreCampania,
    descripcion: p.descripcion,
    notas: p.notas,
    yearInicio: p.yearInicio,
    yearFin: p.yearFin,
    catorcenaInicio: p.catorcenaInicio,
    catorcenaFin: p.catorcenaFin,
    caras: [],
    imu: false,
  };
  try {
    localStorage.setItem(CLAVE_BORRADOR_SOLICITUD, JSON.stringify(borrador));
    return true;
  } catch {
    return false;
  }
}
