// Helpers compartidos de las CAPAS de puntos de interes / poligonos KML
// (Buscador de Formatos -> Vista Compartir interna -> visor publico).
//
// Trafico arma un circuito con pines (POI de Google, direcciones, coordenadas,
// KML de puntos) y poligonos KML: "Conservar con POIs" deja SOLO lo cercano /
// dentro (modo 'incluir'); "Conservar sin POIs" deja SOLO lo lejano / fuera
// (modo 'excluir'). Al apretar cualquiera de los dos, la capa se guarda por
// circuito (solicitud_caras_id) y la Vista Compartir la muestra como capa
// activable para que el cliente entienda por que el circuito quedo donde
// quedo. Como la Vista Compartir de una campaña es la misma pagina que la de
// la propuesta, las capas aplican a ambas sin copiar nada.
//
// La geometria viaja YA en el formato de @react-google-maps/api ({lat,lng}):
// lo que hay en el useState del buscador es lo que se guarda y lo que se pinta.

export type ModoCapa = 'incluir' | 'excluir';
export type OrigenCapa = 'poi' | 'custom' | 'address' | 'kml' | 'mixto';

export interface PinCapa { lat: number; lng: number; name: string; range: number }
export interface PoligonoCapa { name: string; paths: { lat: number; lng: number }[] }
export interface GeometriaCapa { pines: PinCapa[]; poligonos: PoligonoCapa[] }

export interface CapaMapa {
  id: number;
  solicitud_caras_id: number;
  idquote: string;
  nombre: string;
  modo: ModoCapa;
  origen: OrigenCapa;
  geometria: GeometriaCapa;
  archivo_url: string | null;
  visible_cliente: boolean;
  total_pines: number;
  total_poligonos: number;
  creado_por: number | null;
  creado_por_nombre: string | null;
  created_at: string;
}

/** Payload de POST /capas-mapa. El back deriva idquote (propuesta) del circuito. */
export interface NuevaCapa {
  solicitudCarasId: number;
  nombre: string;
  modo: ModoCapa;
  origen: OrigenCapa;
  geometria: GeometriaCapa;
  visibleCliente?: boolean;
  /** KML original (texto). Solo respaldo en Spaces; lo que se pinta es `geometria`. */
  kmlTexto?: string | null;
  kmlNombre?: string | null;
}

// ---------- Textos / colores ----------

export const MODO_LABEL: Record<ModoCapa, string> = {
  incluir: 'Cerca de',
  excluir: 'Lejos de',
};

export const MODO_DESCRIPCION: Record<ModoCapa, string> = {
  incluir: 'Se conservó solo el inventario dentro del radio o del polígono',
  excluir: 'Se conservó solo el inventario fuera del radio o del polígono',
};

// Azul = incluir (cerca de), rojo IMU = excluir (lejos de). Ninguno choca con
// los colores de pines ya usados en compartir (verde seleccionado, gris no
// vigente, azul/verde origen).
export const MODO_COLOR: Record<ModoCapa, string> = {
  incluir: '#0EA5E9',
  excluir: '#E4002B',
};

export const ORIGEN_CAPA_LABEL: Record<OrigenCapa, string> = {
  poi: 'POI de Google',
  custom: 'Coordenadas',
  address: 'Dirección',
  kml: 'Archivo KML',
  mixto: 'Varios',
};

export const CAPAS_LEYENDA =
  'Capas: pines y polígonos con los que Tráfico armó cada circuito. Azul: se conservó lo cercano. Rojo: se conservó lo lejano.';

export function colorCapa(capa: Pick<CapaMapa, 'modo'>): string {
  return MODO_COLOR[capa.modo] ?? MODO_COLOR.incluir;
}

/** "3 pines · 2 polígonos" para chips y listas. */
export function resumenCapa(capa: Pick<CapaMapa, 'total_pines' | 'total_poligonos'>): string {
  const partes: string[] = [];
  if (capa.total_pines > 0) partes.push(`${capa.total_pines} ${capa.total_pines === 1 ? 'pin' : 'pines'}`);
  if (capa.total_poligonos > 0) partes.push(`${capa.total_poligonos} ${capa.total_poligonos === 1 ? 'polígono' : 'polígonos'}`);
  return partes.join(' · ');
}

/**
 * Nombre sugerido al guardar: "Cerca de Starbucks, OXXO (+3)" / "Lejos de
 * Zona Centro". Editable por el usuario antes de guardar.
 */
export function nombreSugeridoCapa(modo: ModoCapa, geometria: GeometriaCapa): string {
  const nombres = [
    ...geometria.poligonos.map(p => p.name),
    ...geometria.pines.map(p => p.name),
  ].map(n => (n || '').trim()).filter(Boolean);
  const unicos = Array.from(new Set(nombres));
  if (unicos.length === 0) return `${MODO_LABEL[modo]} puntos de interés`;
  const cabeza = unicos.slice(0, 2).join(', ');
  const resto = unicos.length - 2;
  return `${MODO_LABEL[modo]} ${cabeza}${resto > 0 ? ` (+${resto})` : ''}`.slice(0, 255);
}

/** 'poi' | 'kml' | ... si todo viene de la misma herramienta; 'mixto' si no. */
export function origenDeGeometria(tiposPines: string[], hayPoligonos: boolean): OrigenCapa {
  const set = new Set<string>(tiposPines);
  if (hayPoligonos) set.add('kml');
  if (set.size === 1) {
    const unico = Array.from(set)[0] as OrigenCapa;
    return (['poi', 'custom', 'address', 'kml'] as OrigenCapa[]).includes(unico) ? unico : 'mixto';
  }
  return 'mixto';
}

// ---------- KML ----------

export interface KMLParseado {
  pines: { lat: number; lng: number; name: string }[];
  poligonos: PoligonoCapa[];
}

/**
 * Parseo de KML en el navegador (DOMParser). Saca Placemarks con <Polygon>
 * (anillo exterior) y con <Point>. Movido aqui desde AdvancedMapComponent
 * para que el buscador y cualquier otra pantalla compartan el mismo parser.
 */
export function parseKML(texto: string): KMLParseado {
  const doc = new DOMParser().parseFromString(texto, 'text/xml');
  const placemarks = doc.getElementsByTagName('Placemark');
  const pines: KMLParseado['pines'] = [];
  const poligonos: PoligonoCapa[] = [];

  const leerCoords = (raw: string) =>
    raw.trim().split(/\s+/).map(par => {
      const partes = par.split(',');
      const lng = parseFloat(partes[0]);
      const lat = parseFloat(partes[1]);
      return Number.isNaN(lat) || Number.isNaN(lng) ? null : { lat, lng };
    }).filter((p): p is { lat: number; lng: number } => p !== null);

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const name = pm.getElementsByTagName('name')[0]?.textContent?.trim() || `KML ${i + 1}`;

    const polygonEl = pm.getElementsByTagName('Polygon')[0];
    if (polygonEl) {
      const coordsEl = polygonEl.getElementsByTagName('coordinates')[0];
      if (coordsEl) {
        const paths = leerCoords(coordsEl.textContent || '');
        if (paths.length >= 3) poligonos.push({ name, paths });
      }
      continue;
    }

    const pointEl = pm.getElementsByTagName('Point')[0];
    const coordsEl = (pointEl || pm).getElementsByTagName('coordinates')[0];
    if (coordsEl) {
      const [primero] = leerCoords(coordsEl.textContent || '');
      if (primero) pines.push({ ...primero, name });
    }
  }
  return { pines, poligonos };
}

// ---------- Ayudas para las vistas de compartir ----------

/** Capas agrupadas por circuito, respetando el orden de llegada. */
export function agruparCapasPorCircuito(capas: CapaMapa[]): Map<number, CapaMapa[]> {
  const m = new Map<number, CapaMapa[]>();
  for (const c of capas) {
    const arr = m.get(c.solicitud_caras_id);
    if (arr) arr.push(c); else m.set(c.solicitud_caras_id, [c]);
  }
  return m;
}

/**
 * Bounds de todas las capas activas, para encuadrar el mapa al prenderlas.
 * Devuelve null si no hay geometria.
 */
export function boundsDeCapas(capas: CapaMapa[]): google.maps.LatLngBounds | null {
  const b = new google.maps.LatLngBounds();
  let vacio = true;
  for (const c of capas) {
    for (const p of c.geometria.pines) { b.extend({ lat: p.lat, lng: p.lng }); vacio = false; }
    for (const po of c.geometria.poligonos) for (const v of po.paths) { b.extend(v); vacio = false; }
  }
  return vacio ? null : b;
}
