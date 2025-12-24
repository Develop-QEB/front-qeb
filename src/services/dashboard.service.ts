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
  ciudades: string[];
  formatos: string[];
  nses: string[];
  catorcenas: Catorcena[];
  catorcenaActual: Catorcena | null;
}

export interface DashboardFilters {
  estado?: string;
  ciudad?: string;
  formato?: string;
  nse?: string;
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

class DashboardService {
  async getStats(filters?: DashboardFilters): Promise<DashboardStats> {
    const params = new URLSearchParams();

    if (filters?.estado) params.append('estado', filters.estado);
    if (filters?.ciudad) params.append('ciudad', filters.ciudad);
    if (filters?.formato) params.append('formato', filters.formato);
    if (filters?.nse) params.append('nse', filters.nse);
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

    if (filters?.estado) params.append('estado', filters.estado);
    if (filters?.ciudad) params.append('ciudad', filters.ciudad);
    if (filters?.formato) params.append('formato', filters.formato);
    if (filters?.nse) params.append('nse', filters.nse);
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

  async getInventoryDetail(filters?: DashboardFilters & { estatus?: string; page?: number; limit?: number }): Promise<InventoryDetailResponse> {
    const params = new URLSearchParams();

    if (filters?.estado) params.append('estado', filters.estado);
    if (filters?.ciudad) params.append('ciudad', filters.ciudad);
    if (filters?.formato) params.append('formato', filters.formato);
    if (filters?.nse) params.append('nse', filters.nse);
    if (filters?.catorcena_id) params.append('catorcena_id', filters.catorcena_id.toString());
    if (filters?.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
    if (filters?.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
    if (filters?.estatus) params.append('estatus', filters.estatus);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

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
