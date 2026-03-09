import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

// Services
import { clientesService } from '../services/clientes.service';
import { solicitudesService } from '../services/solicitudes.service';
import { proveedoresService } from '../services/proveedores.service';
import { inventariosService } from '../services/inventarios.service';
import { campanasService } from '../services/campanas.service';
import { propuestasService } from '../services/propuestas.service';
import { dashboardService } from '../services/dashboard.service';
import { getSapCache, setSapCache, SAP_CACHE_KEYS } from '../lib/sapCache';
import { filterAllowedArticulos } from '../config/allowedDigitalArticles';

// SAP API URL
const SAP_BASE_URL = 'https://binding-convinced-ride-foto.trycloudflare.com';

// Interfaces para SAP
interface SAPCuicItem {
  U_CIC: string | number;
  U_RazonSocial?: string;
  U_UnidadNeg?: string;
  U_Asesor?: string;
  U_Agencia?: string;
  U_Producto?: string;
  U_Marca?: string;
  U_Categoria?: string;
  U_Cliente?: string;
  CardCode?: string;
}

interface SAPArticulo {
  ItemCode: string;
  ItemName: string;
}

// Hook para prefetching de datos
export function usePrefetch() {
  const queryClient = useQueryClient();

  // Prefetch clientes
  const prefetchClientes = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['clientes', { page: 1, limit: 20 }],
      queryFn: () => clientesService.getAll({ page: 1, limit: 20 }),
      staleTime: 10 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: ['clientes', 'stats'],
      queryFn: () => clientesService.getStats(),
      staleTime: 10 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: ['clientes', 'filter-options'],
      queryFn: () => clientesService.getFilterOptions(),
      staleTime: 30 * 60 * 1000,
    });
  }, [queryClient]);

  // Prefetch SAP CUIC data
  const prefetchSapCuic = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['sap-cuic-all', 0],
      queryFn: async () => {
        // Try cache first
        const cached = getSapCache<SAPCuicItem[]>(SAP_CACHE_KEYS.CUIC);
        if (cached && cached.length > 0) {
          return cached;
        }
        // Fetch from SAP
        const response = await fetch(`${SAP_BASE_URL}/cuic`);
        if (!response.ok) throw new Error('Error fetching CUIC');
        const data = await response.json();
        const items = (data.value || data) as SAPCuicItem[];
        if (items && items.length > 0) {
          setSapCache(SAP_CACHE_KEYS.CUIC, items);
        }
        return items;
      },
      staleTime: 30 * 60 * 1000, // 30 minutos
    });
  }, [queryClient]);

  // Prefetch SAP Articulos data
  const prefetchSapArticulos = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['sap-articulos-all', 0],
      queryFn: async () => {
        // Try cache first
        const cached = getSapCache<SAPArticulo[]>(SAP_CACHE_KEYS.ARTICULOS);
        if (cached && cached.length > 0) {
          return cached;
        }
        // Fetch from SAP
        const response = await fetch(`${SAP_BASE_URL}/articulos`);
        if (!response.ok) throw new Error('Error fetching Articulos');
        const data = await response.json();
        const raw = (data.value || data) as SAPArticulo[];
        const items = filterAllowedArticulos(raw);
        if (items && items.length > 0) {
          setSapCache(SAP_CACHE_KEYS.ARTICULOS, items);
        }
        return items;
      },
      staleTime: 30 * 60 * 1000, // 30 minutos
    });
  }, [queryClient]);

  // Prefetch solicitudes (incluye SAP data)
  const prefetchSolicitudes = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['solicitudes', { page: 1, limit: 20 }],
      queryFn: () => solicitudesService.getAll({ page: 1, limit: 20 }),
      staleTime: 10 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: ['solicitudes', 'stats'],
      queryFn: () => solicitudesService.getStats(),
      staleTime: 10 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: ['solicitudes', 'catorcenas'],
      queryFn: () => solicitudesService.getCatorcenas(),
      staleTime: 30 * 60 * 1000,
    });
    // También precargar SAP data para cuando abran el modal
    prefetchSapCuic();
    prefetchSapArticulos();
  }, [queryClient, prefetchSapCuic, prefetchSapArticulos]);

  // Prefetch proveedores
  const prefetchProveedores = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['proveedores', { page: 1, limit: 20 }],
      queryFn: () => proveedoresService.getAll({ page: 1, limit: 20 }),
      staleTime: 10 * 60 * 1000,
    });
  }, [queryClient]);

  // Prefetch inventarios
  const prefetchInventarios = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['inventarios', { page: 1, limit: 50 }],
      queryFn: () => inventariosService.getAll({ page: 1, limit: 50 }),
      staleTime: 10 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: ['inventarios', 'stats'],
      queryFn: () => inventariosService.getStats(),
      staleTime: 10 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: ['inventarios', 'plazas'],
      queryFn: () => inventariosService.getPlazas(),
      staleTime: 30 * 60 * 1000,
    });
  }, [queryClient]);

  // Prefetch campañas
  const prefetchCampanas = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['campanas', { page: 1, limit: 20 }],
      queryFn: () => campanasService.getAll({ page: 1, limit: 20 }),
      staleTime: 10 * 60 * 1000,
    });
  }, [queryClient]);

  // Prefetch propuestas
  const prefetchPropuestas = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['propuestas', { page: 1, limit: 20 }],
      queryFn: () => propuestasService.getAll({ page: 1, limit: 20 }),
      staleTime: 10 * 60 * 1000,
    });
  }, [queryClient]);

  // Prefetch todo (para el dashboard inicial)
  const prefetchAll = useCallback(() => {
    // Ejecutar todos los prefetch en paralelo
    prefetchClientes();
    prefetchSolicitudes(); // Ya incluye SAP CUIC y Articulos
    prefetchProveedores();
    prefetchInventarios();
    prefetchCampanas();
    prefetchPropuestas();
    // SAP data extra (por si solicitudes no lo cargó aún)
    prefetchSapCuic();
    prefetchSapArticulos();
  }, [
    prefetchClientes,
    prefetchSolicitudes,
    prefetchProveedores,
    prefetchInventarios,
    prefetchCampanas,
    prefetchPropuestas,
    prefetchSapCuic,
    prefetchSapArticulos,
  ]);

  // Async version — returns promise that resolves when ALL queries finish (including dashboard)
  const prefetchAllAsync = useCallback(async () => {
    await Promise.all([
      // Page data
      queryClient.prefetchQuery({
        queryKey: ['clientes', { page: 1, limit: 20 }],
        queryFn: () => clientesService.getAll({ page: 1, limit: 20 }),
        staleTime: 10 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ['solicitudes', { page: 1, limit: 20 }],
        queryFn: () => solicitudesService.getAll({ page: 1, limit: 20 }),
        staleTime: 10 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ['campanas', { page: 1, limit: 20 }],
        queryFn: () => campanasService.getAll({ page: 1, limit: 20 }),
        staleTime: 10 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ['inventarios', { page: 1, limit: 50 }],
        queryFn: () => inventariosService.getAll({ page: 1, limit: 50 }),
        staleTime: 10 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ['propuestas', { page: 1, limit: 20 }],
        queryFn: () => propuestasService.getAll({ page: 1, limit: 20 }),
        staleTime: 10 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ['proveedores', { page: 1, limit: 20 }],
        queryFn: () => proveedoresService.getAll({ page: 1, limit: 20 }),
        staleTime: 10 * 60 * 1000,
      }),
      // Dashboard — these are the slow ones (~20s)
      queryClient.prefetchQuery({
        queryKey: ['dashboard', 'filter-options'],
        queryFn: () => dashboardService.getFilterOptions(),
        staleTime: 10 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ['dashboard', 'stats', {}],
        queryFn: () => dashboardService.getStats(),
        staleTime: 10 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ['dashboard', 'inventory-detail', {}, 'total', 1],
        queryFn: () => dashboardService.getInventoryDetail({ page: 1, limit: 50 }),
        staleTime: 10 * 60 * 1000,
      }),
    ]);
    // Fire-and-forget non-critical queries
    prefetchSapCuic();
    prefetchSapArticulos();
  }, [queryClient, prefetchSapCuic, prefetchSapArticulos]);

  return {
    prefetchClientes,
    prefetchSolicitudes,
    prefetchProveedores,
    prefetchInventarios,
    prefetchCampanas,
    prefetchPropuestas,
    prefetchSapCuic,
    prefetchSapArticulos,
    prefetchAll,
    prefetchAllAsync,
  };
}

// Mapeo de rutas a funciones de prefetch
export const routePrefetchMap: Record<string, string> = {
  '/clientes': 'prefetchClientes',
  '/solicitudes': 'prefetchSolicitudes',
  '/proveedores': 'prefetchProveedores',
  '/inventarios': 'prefetchInventarios',
  '/campanas': 'prefetchCampanas',
  '/propuestas': 'prefetchPropuestas',
};
