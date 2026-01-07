import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Crear el QueryClient con configuración optimizada para caché
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Datos se consideran frescos por 10 minutos
      staleTime: 10 * 60 * 1000,
      // Mantener datos en caché por 30 minutos
      gcTime: 30 * 60 * 1000,
      // Solo 1 retry
      retry: 1,
      // No refetch en focus (los datos ya están cacheados)
      refetchOnWindowFocus: false,
      // No refetch al reconectar
      refetchOnReconnect: false,
    },
  },
});

// Crear persister para localStorage
const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'qeb-query-cache',
  // Serializar/deserializar
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

// Persistir el caché en localStorage
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
  // Máximo 24 horas de caché persistido
  maxAge: 24 * 60 * 60 * 1000,
  // Solo persistir queries que no están en error
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      return query.state.status === 'success';
    },
  },
});

export default queryClient;
