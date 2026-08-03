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

// Catorcena "actual" efectiva a partir de filter-options. El back puede
// regresar catorcenaActual null (hueco en la tabla o cache viejo); en ese caso
// se deriva de la lista: la que contiene la fecha de hoy o, si no hay, la mas
// reciente que ya inicio. Comparacion por fecha YYYY-MM-DD (las fechas vienen
// como ISO a medianoche).
export function resolveCatorcenaActual(opts?: FilterOptions): Catorcena | null {
  if (!opts) return null;
  if (opts.catorcenaActual) return opts.catorcenaActual;
  const cats = opts.catorcenas || [];
  if (cats.length === 0) return null;
  const d = new Date();
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dia = (iso: string) => String(iso).slice(0, 10);
  const contieneHoy = cats.find(c => dia(c.fecha_inicio) <= hoy && dia(c.fecha_fin) >= hoy);
  if (contieneHoy) return contieneHoy;
  const pasadas = cats.filter(c => dia(c.fecha_inicio) <= hoy);
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
