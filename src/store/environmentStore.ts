import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SapDatabase = 'CIMU' | 'TEST' | 'TRADE';
export type Environment = SapDatabase;

export const SAP_BASE_URL = 'https://workflow-namely-changes-nothing.trycloudflare.com';

// Configuracion por BD SAP
const ENDPOINT_CONFIG: Record<SapDatabase, { cuic: string; deliveryNotes: string; series: number }> = {
  CIMU:  { cuic: `${SAP_BASE_URL}/cuic`,       deliveryNotes: `${SAP_BASE_URL}/delivery-notes`,       series: 164 },
  TEST:  { cuic: `${SAP_BASE_URL}/cuic-test`,   deliveryNotes: `${SAP_BASE_URL}/delivery-notes-test`,  series: 4   },
  TRADE: { cuic: `${SAP_BASE_URL}/cuic-trade`,  deliveryNotes: `${SAP_BASE_URL}/delivery-notes-trade`, series: 95  },
};

// Endpoints segun ambiente
export const getEndpoints = (env: Environment) => ({
  cuic: ENDPOINT_CONFIG[env].cuic,
  articulos: env === 'TRADE' ? `${SAP_BASE_URL}/articulos-trade` : `${SAP_BASE_URL}/articulos`,
  deliveryNotes: ENDPOINT_CONFIG[env].deliveryNotes,
});

// En dev/stage (NO prod) los POST de CIMU se mandan a la SAP de PRUEBAS
// (PB_SBOCIMU) usando el endpoint/serie de TEST, para no tocar la CIMU real de
// producción. Prod (app.qeb.mx) se comporta normal. TRADE aún no tiene BD de
// prueba en SAP, así que por ahora solo aplica a CIMU.
const IS_PROD = typeof window !== 'undefined' && window.location.hostname === 'app.qeb.mx';
export const usaSapPruebas = (sapDb: SapDatabase): boolean => !IS_PROD && sapDb === 'CIMU';
const resolveSapEnv = (sapDb: SapDatabase): SapDatabase => usaSapPruebas(sapDb) ? 'TEST' : sapDb;

// Helpers para SAP POST
export const getDeliveryNotesEndpoint = (sapDb: SapDatabase): string => ENDPOINT_CONFIG[resolveSapEnv(sapDb)].deliveryNotes;
export const getSeriesForSapDatabase = (sapDb: SapDatabase): number => ENDPOINT_CONFIG[resolveSapEnv(sapDb)].series;

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
