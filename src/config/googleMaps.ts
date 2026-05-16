// Configuracion UNICA del loader de Google Maps.
//
// IMPORTANTE: @react-google-maps/api inyecta un <script> cuyo URL depende de
// `id`, `googleMapsApiKey` y `libraries`. El loader solo deduplica cuando el
// URL es identico. Si dos componentes montados a la vez (p.ej.
// CampanaDetailPage + AssignInventarioCampanaModal) piden configuraciones
// distintas (uno sin libraries y otro con ['places','geometry']), la API se
// carga DOS veces: "You have included the Google Maps JavaScript API multiple
// times", se rompe window.google.maps (Cannot read properties of undefined
// reading 'QE'), todos los Marker fallan con setMap y la pantalla se queda
// trabada/morada.
//
// Por eso TODOS los useLoadScript del proyecto deben usar exactamente estas
// constantes (mismo id, misma key, misma referencia de libraries).
import type { Libraries } from '@react-google-maps/api';

export const GOOGLE_MAPS_API_KEY = 'AIzaSyB7Bzwydh91xZPdR8mGgqAV2hO72W1EVaw';

// Referencia estable y compartida. No recrear este arreglo en cada componente.
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places', 'geometry'];

// id fijo para que el loader reuse el mismo <script> en toda la app.
export const GOOGLE_MAPS_LOADER_ID = 'qeb-google-maps-loader';

// Opciones completas listas para usar:
//   const { isLoaded } = useLoadScript(GOOGLE_MAPS_LOADER_OPTIONS);
export const GOOGLE_MAPS_LOADER_OPTIONS = {
  id: GOOGLE_MAPS_LOADER_ID,
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  libraries: GOOGLE_MAPS_LIBRARIES,
} as const;
