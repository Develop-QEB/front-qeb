// Busqueda de puntos de interes (Google Places) en el AREA VISIBLE del mapa.
//
// Es la misma busqueda del Buscador de Formatos ("Buscar en area visible"):
// se parte el viewport en un grid 3x3 (o 1x1 si es chico), se hace un
// textSearch por zona con paginacion y se deduplica por place_id. Asi "oxxo"
// devuelve TODOS los OXXO del area y no solo el primero que sugiere el
// Autocomplete. Vive aqui para que el buscador y los dos mapas de compartir
// (interno y publico) usen exactamente la misma logica.

export interface POIEncontrado {
  id: string;
  position: { lat: number; lng: number };
  name: string;
  range: number;
  type: 'poi';
}

/** Radios disponibles en los selectores (metros). */
export const RANGOS_POI = [100, 200, 300, 500, 1000, 2000] as const;

/**
 * Busca `query` en el area visible de `map`. Resuelve cuando terminan todas
 * las zonas (puede tardar unos segundos: hay stagger de 400 ms entre zonas y
 * 300 ms entre paginas para no pegar contra el rate limit de Places).
 */
export function buscarPOIsEnArea(map: google.maps.Map, query: string, range: number): Promise<POIEncontrado[]> {
  return new Promise((resolve) => {
    const q = query.trim();
    const bounds = map.getBounds();
    if (!q || !bounds) { resolve([]); return; }

    const service = new google.maps.places.PlacesService(map);
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latRange = ne.lat() - sw.lat();
    const lngRange = ne.lng() - sw.lng();

    // Split visible area into sub-zones (3x3 grid = 9 zones for large areas, 1 for small)
    const gridSize = (latRange > 0.05 || lngRange > 0.05) ? 3 : 1;
    const latStep = latRange / gridSize;
    const lngStep = lngRange / gridSize;

    const subBounds: google.maps.LatLngBounds[] = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        subBounds.push(new google.maps.LatLngBounds(
          { lat: sw.lat() + r * latStep, lng: sw.lng() + c * lngStep },
          { lat: sw.lat() + (r + 1) * latStep, lng: sw.lng() + (c + 1) * lngStep }
        ));
      }
    }

    const allResults: google.maps.places.PlaceResult[] = [];
    const seenPlaceIds = new Set<string>();
    let completedZones = 0;
    const totalZones = subBounds.length;

    const finalize = () => {
      const timestamp = Date.now();
      resolve(allResults.map((place, idx) => ({
        id: `poi-${timestamp}-${idx}`,
        position: {
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
        },
        name: place.name || 'POI',
        range,
        type: 'poi' as const,
      })));
    };

    const searchZone = (zoneBounds: google.maps.LatLngBounds) => {
      const request: google.maps.places.TextSearchRequest = { query: q, bounds: zoneBounds };

      const processResults = (
        results: google.maps.places.PlaceResult[] | null,
        status: google.maps.places.PlacesServiceStatus,
        pagination: google.maps.places.PlaceSearchPagination | null
      ) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          results.forEach(place => {
            const placeId = place.place_id || `${place.geometry?.location?.lat()}-${place.geometry?.location?.lng()}`;
            if (!seenPlaceIds.has(placeId)) {
              seenPlaceIds.add(placeId);
              allResults.push(place);
            }
          });
          if (pagination?.hasNextPage) {
            setTimeout(() => pagination.nextPage(), 300);
            return;
          }
        }
        completedZones++;
        if (completedZones >= totalZones) finalize();
      };

      service.textSearch(request, processResults);
    };

    // Stagger requests to avoid rate limiting
    subBounds.forEach((zb, i) => {
      setTimeout(() => searchZone(zb), i * 400);
    });
  });
}

/** Un solo lugar elegido en el Autocomplete, como POI con radio. */
export function poiDesdePlace(place: google.maps.places.PlaceResult, range: number): POIEncontrado | null {
  const loc = place.geometry?.location;
  if (!loc) return null;
  return {
    id: `poi-${Date.now()}`,
    position: { lat: loc.lat(), lng: loc.lng() },
    name: place.name || place.formatted_address?.split(',')[0] || 'POI',
    range,
    type: 'poi',
  };
}
