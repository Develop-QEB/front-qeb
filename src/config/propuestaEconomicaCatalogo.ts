// Catálogos de la Propuesta Económica ("GRUPO IMU - Propuesta de Servicio").
//
// Copia EXACTA de la hoja oculta "Catálogo" del Excel que usaban los asesores
// (PROPUESTA ... .xlsx): mismas plazas, medios, formatos y periodos, con la misma
// ortografía, para que el documento generado sea idéntico al original. No se
// derivan de SAP ni de inventarios a propósito: los nombres comerciales de la
// propuesta ("CDMX y A.M.", "Parabuses") no coinciden 1:1 con artículos/muebles.

// ───────────────────────── Vía Pública ─────────────────────────

/** Rango VP_Plazas (Catálogo!B4:B24). */
export const VP_PLAZAS = [
  'Acapulco', 'Aguascalientes', 'CDMX y A.M.', 'Celaya', 'Culiacán', 'Guadalajara',
  'Irapuato', 'León', 'Mazatlán', 'Mérida', 'Monterrey', 'Oaxaca', 'Pachuca', 'Puebla',
  'Puerto Vallarta', 'Queretaro', 'Salamanca', 'San Luis', 'Tijuana', 'Toluca', 'Veracruz',
] as const;

const GDL_MEDIOS = [
  'Camión Mi Macro Aeropuerto',
  'Columnas',
  'Kioscos',
  'Macro Valla Mi Macro Periferico Módulo A (15 paneles)',
  'Macro Valla Mi Macro Periferico Módulo B ( 11 paneles)',
  'Mi Macro Parabus Aeropuerto',
  'Mi Macro Parabus Externo',
  'Mupi Interno Mi Macro Aeropuerto',
  'Mupi Interno Mi Macro Periferico',
  'Parabús largo/copete',
  'Parabuses',
  'Puentes Peatonales',
  'Vitral Externo Mi Macro Aeropuerto',
  'Vitral Externo Mi Marco Periférico',
  'Vitral Interno Mi Macro Aeropuerto',
  'Vitral Interno Mi Macro Periférico',
];

/** Medio/Soporte permitido por plaza (rangos VP_ACAPULCO … VP_VERACRUZ). */
export const VP_MEDIOS_POR_PLAZA: Record<string, string[]> = {
  'Acapulco': ['Parabuses'],
  'Aguascalientes': ['Kioscos'],
  'CDMX y A.M.': [
    'Bajo Puente Av. Fuentes',
    'Bajo Puente Colorines',
    'Bajo Puente Géografos',
    'Bajo Puente Gran Terraza',
    'Bajo Puente Toreo Norte-Sur',
    'Bajo Puente Toreo Sur-Norte',
    'Boleros',
    'Cartelera Digital',
    'Columnas',
    'Kioscos',
    'Parabuses',
    'Puentes Peatonales',
  ],
  'Celaya': ['Parabuses'],
  'Culiacán': ['Parabuses'],
  'Guadalajara': GDL_MEDIOS,
  'Irapuato': ['Parabuses'],
  'León': ['Kioscos', 'Parabuses'],
  'Mazatlán': ['Parabuses'],
  'Mérida': ['Parabuses'],
  'Monterrey': ['Kioscos', 'Parabuses'],
  'Oaxaca': ['Parabuses'],
  'Pachuca': ['Columnas', 'Kioscos', 'Parabuses'],
  'Puebla': ['Columnas', 'Parabuses'],
  'Puerto Vallarta': ['Parabuses'],
  'Queretaro': ['Parabuses'],
  'Salamanca': ['Parabuses'],
  'San Luis': ['Kioscos'],
  'Tijuana': ['Columnas', 'Parabuses'],
  'Toluca': ['Cartelera Digital', 'Parabuses'],
  'Veracruz': ['Kioscos', 'Parabuses'],
};

/** Rango VP_Plazas_Digital: plazas donde Parabuses/Columnas también se venden en digital. */
export const VP_PLAZAS_DIGITAL = ['CDMX y A.M.', 'Guadalajara', 'Mérida', 'Monterrey', 'Puebla'];

export const FORMATO_FIJO = 'Fijo';
export const FORMATOS_DIGITALES = ['Digital Segmentado', 'Digital Tradicional'];
export const FORMATOS_MIXTOS = ['Digital Segmentado', 'Digital Tradicional', 'Fijo'];

/** Rango VP_Periodos (Catálogo!E4:E7). */
export const VP_PERIODOS = ['Catorcenal', 'Días', 'Mensual', 'Semanal'];

/** Misma regla que la validación de la columna Formato del Excel. */
export function formatosViaPublica(plaza: string, medio: string): string[] {
  if (!medio) return [];
  if (medio === 'Cartelera Digital') return FORMATOS_DIGITALES;
  if (VP_PLAZAS_DIGITAL.includes(plaza) && (medio === 'Parabuses' || medio === 'Columnas')) {
    return FORMATOS_MIXTOS;
  }
  return [FORMATO_FIJO];
}

/**
 * Nota del Excel (comentario de la celda Periodo): "Parabuses y Columnas son
 * catorcenales; los demás medios son mensuales". Se usa solo como sugerencia al
 * elegir el medio — el asesor puede cambiarlo.
 */
export function periodoSugerido(medio: string): string {
  if (!medio) return '';
  return medio === 'Parabuses' || medio === 'Columnas' ? 'Catorcenal' : 'Mensual';
}

// ───────────────────────── Aeropuertos ─────────────────────────

/** Rango AER_Plazas (Catálogo!J4:J16). */
export const AER_PLAZAS = [
  'Aguascalientes', 'AICM - CDMX', 'Bajío', 'Guadalajara', 'Hermosillo', 'La Paz', 'Los Cabos',
  'Los Mochis', 'Manzanillo', 'Mexicalli', 'Morelia', 'Puerto Vallarta', 'Tijuana',
];

/** Rango AER_AICM_Plaza: única plaza con lista cerrada de espacios. */
export const AER_PLAZA_AICM = 'AICM - CDMX';

/** Rango AER_Pantallas_AICM (Catálogo!K4:K21). En las demás plazas el espacio se escribe a mano. */
export const AER_PANTALLAS_AICM = [
  'Circuito * Pantallas Salas de Última Espera- T2',
  'Circuito de 5 Pantallas Salas de Última Espera Internacional - T1',
  'Circuito de 8 Pantallas Llegadas Internacional - T1',
  'Dupla de Pantallas Sincronizadas hacia Baggage Internacional - T1',
  'Estaciones y Carritos equipajeros - T1',
  'Estaciones y Carritos Equipajeros - T2',
  'Gran Pantalla Llegadas Nacionales - T1',
  'Implementación Especial',
  'Pantalla a Migración - T1',
  'Pantalla Acesso Salas VIP - T1',
  'Pantalla Ambulatorio Acceso - T1',
  'Pantalla Filtro Internacional - T1',
  'Pantalla Llegadas Internacionales - T1',
  'Pantalla Pasillo Salas VIP - T1',
  'Pantalla Puerta 10 Pasillo Salas Última Espera Nacional - T1',
  'Pantalla Sala Última Espera Internacional - T2',
  'Pantalla Sala Última Espera Nacional - T1',
  'Pantalla Sala Última Espera Nacional - T2',
];

/** Rango AER_Formatos (Catálogo!M4:M6). */
export const AER_FORMATOS = FORMATOS_MIXTOS;
/** Rango AER_Periodos (Catálogo!N4:N6). */
export const AER_PERIODOS = ['Días', 'Mensual', 'Semanal'];

// ───────────────────────── WiFi ─────────────────────────

/** Rango WIFI_Plazas (Catálogo!P4:P9). */
export const WIFI_PLAZAS = ['Ciudad de México', 'Guadalajara', 'Mérida', 'Monterrey', 'Puebla', 'Tijuana'];
/** Rango WIFI_Soporte (Catálogo!Q4). */
export const WIFI_SOPORTE = 'WiFi';
/** Rango WIFI_Formatos (Catálogo!R4:R11). */
export const WIFI_FORMATOS = [
  'Call to Action: Cupón',
  'Call to Action: Encuesta',
  'Call to Action: Imagen',
  'Interactivo: Juego',
  'Interactivo: Quiz imagen/video',
  'Registros: Login Facebook',
  'Tradicional: Carrusel de imágenes',
  'Tradicional: Video',
];
/** Rango WIFI_Periodos (Catálogo!S4:S7). */
export const WIFI_PERIODOS = ['Catorcenal', 'Días', 'Mensual', 'Semanal'];

// ───────────────────────── Impresiones ─────────────────────────

/** Rango IMP_Plazas (Catálogo!W4:W33): plazas de vía pública + aeropuertos. */
export const IMP_PLAZAS = [
  'Acapulco', 'Aguascalientes', 'AICM - CDMX', 'Bajío', 'CDMX y A.M.', 'Celaya', 'Culiacán',
  'Guadalajara', 'Hermosillo', 'Irapuato', 'La Paz', 'León', 'Los Cabos', 'Los Mochis',
  'Manzanillo', 'Mazatlán', 'Mérida', 'Mexicalli', 'Monterrey', 'Morelia', 'Oaxaca', 'Pachuca',
  'Puebla', 'Puerto Vallarta', 'Queretaro', 'Salamanca', 'San Luis', 'Tijuana', 'Toluca', 'Veracruz',
];

/** Rango IMP_Materiales (Catálogo!V4:V7). */
export const IMP_MATERIALES = [
  'Estireno calibre 15',
  'Lona Front 13 oz',
  'Lona Mate 13 oz',
  'Vinil Impreso Autoadherible',
];

/** Valor que los asesores escriben en Medio/Soporte de la tabla de Impresiones. */
export const IMP_MEDIO_DEFAULT = 'IMPRESIÓN';

/**
 * Rangos IMP_<PLAZA>: los medios de vía pública de la plaza SIN Cartelera Digital
 * (lo digital no se imprime). En plazas que no son de vía pública (aeropuertos)
 * el Excel deja texto libre, por eso aquí son solo sugerencias.
 */
export function mediosImpresion(plaza: string): string[] {
  const medios = (VP_MEDIOS_POR_PLAZA[plaza] || []).filter(m => m !== 'Cartelera Digital');
  return [IMP_MEDIO_DEFAULT, ...medios];
}

/** "Se debe imprimir el 30% adicional de materiales" (Términos y Condiciones). */
export const IMP_FACTOR_ADICIONAL = 0.3;

// ───────────────────────── Textos fijos ─────────────────────────

export const IVA = 0.16;

export const TERMINOS_Y_CONDICIONES = `* No incluyen costos de producción. Se debe imprimir el 30% adicional de materiales para cubrir daños por clima o robo (Parabuses / Columnas).
* En otros medios impresos, se notificará alguna incidencia para que sea repuesta por parte del cliente.
* El limite máximo de solución a incidencias es de 48 hrs hábiles.
* Cualquier gasto adicional correrá a cuenta del cliente.
*Las cancelaciones están sujetas a la siguiente tabla de penalización:
         Entre 60 y 45 días 10%
         Entre 44 y 30 días 25%
         Entre 29 y 15 días 50 %
         Menos de 14 días 100%
* Los costos de producción son adicionales.
* El descuento sobre la tarifa on exclusivos del cliente y válidos para esta propuesta.
* Vigencia de 28 días naturales.
*La comprobación fotográfica no está obligada a entregarse al cliente con características específicas como horario en fotografía, ángulo de toma, calidad de imagen, claridad de luz, entre otras características. En las fotografías, habrá un porcentaje de tomas durante el día y otro porcentaje de tomas durante la noche.* El descuento sobre la tarifa y la bonificación son exclusivos del cliente y válidos para esta propuesta. `;

export const OBSERVACIONES_DEFAULT =
  'LOS CIRCUITOS PRESENTADOS SON MUESTRA HASTA NO TENER UNA CONFIRMACIÓN FORMAL. NO RESERVO ESPACIOS SIN ODC ';
