import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SapDatabase = 'CIMU' | 'TEST' | 'TRADE';
export type Environment = SapDatabase;

export const SAP_BASE_URL = 'https://binding-convinced-ride-foto.trycloudflare.com';

// Configuracion por BD SAP
const ENDPOINT_CONFIG: Record<SapDatabase, { cuic: string; deliveryNotes: string; series: number }> = {
  CIMU:  { cuic: `${SAP_BASE_URL}/cuic`,       deliveryNotes: `${SAP_BASE_URL}/delivery-notes`,       series: 162 },
  TEST:  { cuic: `${SAP_BASE_URL}/cuic-test`,   deliveryNotes: `${SAP_BASE_URL}/delivery-notes-test`,  series: 4   },
  TRADE: { cuic: `${SAP_BASE_URL}/cuic-trade`,  deliveryNotes: `${SAP_BASE_URL}/delivery-notes-trade`, series: 95  },
};

// Endpoints segun ambiente
export const getEndpoints = (env: Environment) => ({
  cuic: ENDPOINT_CONFIG[env].cuic,
  articulos: `${SAP_BASE_URL}/articulos`,
  deliveryNotes: ENDPOINT_CONFIG[env].deliveryNotes,
});

// Helpers para SAP POST
export const getDeliveryNotesEndpoint = (sapDb: SapDatabase): string => ENDPOINT_CONFIG[sapDb].deliveryNotes;
export const getSeriesForSapDatabase = (sapDb: SapDatabase): number => ENDPOINT_CONFIG[sapDb].series;

interface EnvironmentState {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
}

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set) => ({
      environment: 'TEST' as Environment,
      setEnvironment: (env) => set({ environment: env }),
    }),
    {
      name: 'environment-storage',
    }
  )
);
