import { Fragment, useRef, useState } from 'react';
import { Autocomplete, Circle, Marker, InfoWindow } from '@react-google-maps/api';
import { Search, Loader2, X } from 'lucide-react';
import { POIEncontrado, RANGOS_POI, buscarPOIsEnArea, poiDesdePlace } from './poiBusqueda';

// Buscador de POI para los mapas de compartir (interno y publico). Mismo
// comportamiento que el Buscador de Formatos: escribir "oxxo" + Enter (o el
// boton) busca en TODA el area visible y pinta cada resultado con su radio;
// elegir una sugerencia del Autocomplete agrega solo ese lugar. Es una
// herramienta libre y efimera: no tiene nada que ver con las capas guardadas
// de Trafico (CapasMapaPanel), que se muestran aparte.

const PIN_PATH = 'M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7-7.75 7-13C19,5.13 15.87,2 12,2z';

interface Props {
  /** Se lee al momento de buscar: el mapa puede montarse despues que el buscador. */
  getMap: () => google.maps.Map | null;
  isLoaded: boolean;
  pois: POIEncontrado[];
  onChange: (pois: POIEncontrado[]) => void;
  range: number;
  onRangeChange: (range: number) => void;
  isDark?: boolean;
  /** Color de acento: azul IMU (visor publico) o morado (compartir interna). */
  acento?: 'imu' | 'purple';
}

export function PoiBuscadorMapa({ getMap, isLoaded, pois, onChange, range, onRangeChange, isDark = false, acento = 'purple' }: Props) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [texto, setTexto] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);

  const ring = acento === 'imu' ? 'focus:ring-[#0054A6]' : 'focus:ring-purple-500';
  const btn = acento === 'imu'
    ? 'bg-[#0054A6] hover:bg-[#003B71] text-white'
    : 'bg-purple-600 hover:bg-purple-700 text-white';
  const input = isDark
    ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
    : 'bg-white border-gray-300 text-gray-700 placeholder:text-gray-400';

  const buscarEnArea = async () => {
    const map = getMap();
    const q = texto.trim();
    if (!q || !map || buscando) return;
    setBuscando(true);
    setSinResultados(false);
    try {
      const encontrados = await buscarPOIsEnArea(map, q, range);
      if (encontrados.length === 0) setSinResultados(true);
      else onChange([...pois, ...encontrados]);
    } finally {
      setBuscando(false);
    }
  };

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;
    const poi = poiDesdePlace(place, range);
    // Sin geometria = el usuario dio Enter sin elegir sugerencia -> busqueda por area.
    if (!poi) { void buscarEnArea(); return; }
    onChange([...pois, poi]);
    getMap()?.setCenter(poi.position);
    getMap()?.setZoom(15);
    setTexto('');
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={range}
        onChange={(e) => onRangeChange(parseInt(e.target.value, 10))}
        className={`px-2 py-1.5 border rounded-lg text-xs ${input}`}
        title="Radio alrededor de cada POI"
      >
        {RANGOS_POI.map(r => (
          <option key={r} value={r}>{r >= 1000 ? `${r / 1000}km` : `${r}m`}</option>
        ))}
      </select>

      {isLoaded && (
        <Autocomplete
          onLoad={(ac) => { autocompleteRef.current = ac; }}
          onPlaceChanged={handlePlaceChanged}
          options={{ componentRestrictions: { country: 'mx' }, fields: ['geometry', 'name', 'formatted_address'] }}
        >
          <input
            type="text"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setSinResultados(false); }}
            placeholder="Buscar POI: oxxo, escuelas..."
            className={`px-3 py-1.5 border rounded-lg text-sm w-32 sm:w-52 focus:outline-none focus:ring-2 ${ring} ${input}`}
          />
        </Autocomplete>
      )}

      <button
        onClick={buscarEnArea}
        disabled={buscando || !texto.trim() || !isLoaded}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors ${btn}`}
        title="Buscar todos los resultados en el área visible del mapa"
      >
        {buscando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{buscando ? 'Buscando…' : 'Buscar en área'}</span>
      </button>

      {sinResultados && (
        <span className={`text-[11px] ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>Sin resultados en el área visible</span>
      )}

      {pois.length > 0 && (
        <button
          onClick={() => onChange([])}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${isDark ? 'bg-red-600/20 text-red-300 border-red-500/30 hover:bg-red-600/30' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}
        >
          <X className="h-3 w-3" />
          Limpiar ({pois.length})
        </button>
      )}
    </div>
  );
}

// Pinta los POIs dentro de un <GoogleMap>: radio + pin; click en el pin abre
// una ventanita con el nombre y "Quitar" (como en el Buscador de Formatos).
interface OverlayProps {
  pois: POIEncontrado[];
  onChange: (pois: POIEncontrado[]) => void;
  color: string;
}

export function PoiMapaOverlay({ pois, onChange, color }: OverlayProps) {
  const [activo, setActivo] = useState<POIEncontrado | null>(null);
  return (
    <>
      {pois.map(poi => (
        <Fragment key={poi.id}>
          <Circle
            center={poi.position}
            radius={poi.range}
            options={{ strokeColor: color, strokeOpacity: 0.7, strokeWeight: 2, fillColor: color, fillOpacity: 0.15, clickable: false }}
          />
          <Marker
            position={poi.position}
            title={`${poi.name} · ${poi.range} m`}
            zIndex={600}
            onClick={() => setActivo(poi)}
            icon={{
              path: PIN_PATH,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 1.5,
              scale: 1.2,
              anchor: new google.maps.Point(12, 24),
            }}
          />
        </Fragment>
      ))}
      {activo && (
        <InfoWindow position={activo.position} onCloseClick={() => setActivo(null)}>
          <div className="p-1 min-w-[160px]" style={{ color: '#000' }}>
            <p className="font-semibold text-sm text-gray-800 mb-0.5">{activo.name}</p>
            <p className="text-xs text-gray-500 mb-2">{activo.range} m de radio</p>
            <button
              onClick={() => { onChange(pois.filter(p => p.id !== activo.id)); setActivo(null); }}
              className="w-full px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
            >
              Quitar
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
