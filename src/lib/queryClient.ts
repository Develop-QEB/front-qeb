import { QueryClient } from '@tanstack/react-query';

// Crear el QueryClient con configuración optimizada para caché en memoria
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Datos se consideran frescos por 5 minutos
      staleTime: 5 * 60 * 1000,
      // Mantener datos en caché por 30 minutos
      gcTime: 30 * 60 * 1000,
      // Solo 1 retry
      retry: 1,
      // No refetch en focus (WebSocket se encarga de actualizar datos)
      refetchOnWindowFocus: false,
      // No refetch al reconectar
      refetchOnReconnect: false,
    },
  },
});

export default queryClient;
