import api from '../lib/api';

export interface DashboardKPIs {
  total: number;
  disponibles: number;
  reservados: number;
  vendidos: number;
  bloqueados: number;
}

export interface ChartData {
  nombre: string;
  cantidad: number;
}

export interface DashboardGraficas {
  porMueble: ChartData[];
  porTipo: ChartData[];
  porMunicipio: ChartData[];
  porPlaza: ChartData[];
  porNSE: ChartData[];
}

export interface DashboardStats {
  kpis: DashboardKPIs;
  graficas: DashboardGraficas;
}

export interface Catorcena {
  id: number;
  label: string;
  numero: number;
  ano: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface FilterOptions {
  estados: string[];
  ciudades: Array<{ ciudad: string; estado: string }>;
  formatos: Array<{ formato: string; estado: string; ciudad: string }>;
  nses: Array<{ nse: string; estado: string; ciudad: string }>;
  tipos: string[];
  catorcenas: Catorcena[];
  catorcenaActual: Catorcena | null;
}

export interface DashboardFilters {
  estado?: string[];
  ciudad?: string[];
  formato?: string[];
  nse?: string[];
  tipo?: string[];
  catorcena_id?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface Solicitud {
  id: number;
  descripcion: string;
  status: string;
  fecha: string;
  razon_social: string | null;
}

export interface Reserva {
  id: number;
  estatus: string;
  fecha_reserva: string;
  inventario_id: number;
}

export interface Campana {
  id: number;
  nombre: string;
  status: string;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface RecentActivity {
  solicitudes: Solicitud[];
  reservas: Reserva[];
  campanas: Campana[];
}

export interface CatorcenaProxima {
  id: number;
  numero: number;
  ano: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface TopCliente {
  id: number;
  nombre: string;
  totalReservas: number;
}

export interface PosteoBucket {
  count: number;
  monto: number;
}

export interface PosteoStats {
  pendientes: PosteoBucket;
  posteadas: PosteoBucket;
  total: PosteoBucket;
}

// Catorcena "actual" efectiva a partir de filter-options.
// OJO: las fechas de la tabla `catorcenas` estan corridas +1 dia respecto a la
// operacion real (la catorcena inicia en lunes, pero la tabla guarda el martes
// como fecha_inicio). Por eso la catorcena vigente es la que contiene MANANA
// en terminos de la tabla: p. ej. el lunes 3-ago ya corre la Cat 16 aunque su
// fecha_inicio en tabla sea 4-ago. Comparacion por fecha YYYY-MM-DD (las
// fechas vienen como ISO a medianoche UTC).
export function resolveCatorcenaActual(opts?: FilterOptions): Catorcena | null {
  if (!opts) return null;
  const cats = opts.catorcenas || [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // "manana": compensa el corrimiento de la tabla
  const ref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dia = (iso: string) => String(iso).slice(0, 10);
  const vigente = cats.find(c => dia(c.fecha_inicio) <= ref && dia(c.fecha_fin) >= ref);
  if (vigente) return vigente;
  // Fallbacks: lo que haya calculado el back, o la mas reciente ya iniciada.
  if (opts.catorcenaActual) return opts.catorcenaActual;
  const pasadas = cats.filter(c => dia(c.fecha_inicio) <= ref);
  if (pasadas.length === 0) return null;
  return pasadas.reduce((a, b) => (dia(a.fecha_inicio) >= dia(b.fecha_inicio) ? a : b));
}

function appendMulti(params: URLSearchParams, key: string, value?: string[]): void {
  if (!value || value.length === 0) return;
  params.append(key, value.join(','));
}

class DashboardService {
  async getStats(filters?: DashboardFilters): Promise<DashboardStats> {
    const params = new URLSearchParams();

    appendMulti(params, 'estado', filters?.estado);
    appendMulti(params, 'ciudad', filters?.ciudad);
    appendMulti(params, 'formato', filters?.formato);
    appendMulti(params, 'nse', filters?.nse);
    appendMulti(params, 'tipo', filters?.tipo);
    if (filters?.catorcena_id) params.append('catorcena_id', filters.catorcena_id.toString());
    if (filters?.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
    if (filters?.fecha_fin) params.append('fecha_fin', filters.fecha_fin);

    const queryString = params.toString();
    const url = `/dashboard/stats${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data.data;
  }

  async getStatsByEstatus(estatus: string, filters?: DashboardFilters): Promise<{
    total: number;
    estatus: string;
    graficas: DashboardGraficas;
  }> {
    const params = new URLSearchParams();

    appendMulti(params, 'estado', filters?.estado);
    appendMulti(params, 'ciudad', filters?.ciudad);
    appendMulti(params, 'formato', filters?.formato);
    appendMulti(params, 'nse', filters?.nse);
    appendMulti(params, 'tipo', filters?.tipo);
    if (filters?.catorcena_id) params.append('catorcena_id', filters.catorcena_id.toString());
    if (filters?.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
    if (filters?.fecha_fin) params.append('fecha_fin', filters.fecha_fin);

    const queryString = params.toString();
    const url = `/dashboard/stats/${estatus}${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data.data;
  }

  async getFilterOptions(): Promise<FilterOptions> {
    const response = await api.get('/dashboard/filter-options');
    return response.data.data;
  }

  async getRecentActivity(): Promise<RecentActivity> {
    const response = await api.get('/dashboard/activity');
    return response.data.data;
  }

  async getUpcomingCatorcenas(): Promise<CatorcenaProxima[]> {
    const response = await api.get('/dashboard/catorcenas');
    return response.data.data;
  }

  async getTopClientes(): Promise<TopCliente[]> {
    const response = await api.get('/dashboard/top-clientes');
    return response.data.data;
  }

  async getPosteoStats(filters?: Pick<DashboardFilters, 'catorcena_id' | 'fecha_inicio' | 'fecha_fin'>): Promise<PosteoStats> {
    const params = new URLSearchParams();
    if (filters?.catorcena_id) params.append('catorcena_id', filters.catorcena_id.toString());
    if (filters?.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
    if (filters?.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
    const queryString = params.toString();
    const response = await api.get(`/dashboard/posteo-stats${queryString ? `?${queryString}` : ''}`);
    return response.data.data;
  }

  async getInventoryDetail(filters?: DashboardFilters & { estatus?: string; page?: number; limit?: number; includeCoords?: boolean }): Promise<InventoryDetailResponse> {
    const params = new URLSearchParams();

    appendMulti(params, 'estado', filters?.estado);
    appendMulti(params, 'ciudad', filters?.ciudad);
    appendMulti(params, 'formato', filters?.formato);
    appendMulti(params, 'nse', filters?.nse);
    appendMulti(params, 'tipo', filters?.tipo);
    if (filters?.catorcena_id) params.append('catorcena_id', filters.catorcena_id.toString());
    if (filters?.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
    if (filters?.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
    if (filters?.estatus) params.append('estatus', filters.estatus);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.includeCoords) params.append('includeCoords', 'true');

    const queryString = params.toString();
    const url = `/dashboard/inventory-detail${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data.data;
  }
}

export interface InventoryDetailItem {
  id: number;
  codigo_unico: string;
  plaza: string;
  mueble: string;
  tipo_de_mueble: string;
  tradicional_digital: string;
  municipio: string;
  estado: string;
  latitud: number | null;
  longitud: number | null;
  estatus: string;
  cliente_nombre: string | null;
  agencia: string | null;
  propuesta_id: number | null;
  nombre_campania: string | null;
  APS?: number | null;
  campana_id?: number | null;
}

export interface PlazaMapData {
  plaza: string;
  count: number;
  lat: number | null;
  lng: number | null;
}

export interface InventoryCoord {
  id: number;
  lat: number;
  lng: number;
  plaza: string;
  estatus: string;
}

export interface InventoryDetailResponse {
  items: InventoryDetailItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  byPlaza: PlazaMapData[];
  allCoords: InventoryCoord[];
}

export const dashboardService = new DashboardService();
