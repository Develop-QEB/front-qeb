import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Environment = 'production' | 'test';

interface EnvironmentState {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
  toggleEnvironment: () => void;
  isTestMode: () => boolean;
}

export const SAP_BASE_URL = 'https://binding-convinced-ride-foto.trycloudflare.com';

// Endpoints según ambiente
export const getEndpoints = (env: Environment) => ({
  cuic: env === 'test' ? `${SAP_BASE_URL}/cuic-test` : `${SAP_BASE_URL}/cuic`,
  articulos: `${SAP_BASE_URL}/articulos`,
  deliveryNotes: env === 'test' ? `${SAP_BASE_URL}/delivery-notes-test` : `${SAP_BASE_URL}/delivery-notes`,
});

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set, get) => ({
      environment: 'test' as Environment, // Default a test para desarrollo
      setEnvironment: (env) => set({ environment: env }),
      toggleEnvironment: () => set((state) => ({
        environment: state.environment === 'test' ? 'production' : 'test'
      })),
      isTestMode: () => get().environment === 'test',
    }),
    {
      name: 'environment-storage',
    }
  )
);
