import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SapDatabase = 'CIMU' | 'TEST' | 'TRADE' | 'UDC';
export type Environment = SapDatabase;

export const SAP_BASE_URL = 'https://workflow-namely-changes-nothing.trycloudflare.com';

// UDC (aeropuerto AICM, compañía SAP SBOUDC): la SERIE de documento SAP aún no
// la tenemos (CIMU=164, TRADE=95). SERIES_PENDIENTE es un centinela que bloquea
// el POST de delivery notes UDC hasta que IMU nos pase el número real — ver el
// guard en postDeliveryNoteToSAP (campanas.service.ts).
// TODO(UDC): reemplazar por la serie real cuando IMU la confirme.
export const SERIES_PENDIENTE = -1;

// Configuracion por BD SAP
const ENDPOINT_CONFIG: Record<SapDatabase, { cuic: string; deliveryNotes: string; series: number }> = {
  CIMU:  { cuic: `${SAP_BASE_URL}/cuic`,       deliveryNotes: `${SAP_BASE_URL}/delivery-notes`,       series: 164 },
  TEST:  { cuic: `${SAP_BASE_URL}/cuic-test`,   deliveryNotes: `${SAP_BASE_URL}/delivery-notes-test`,  series: 4   },
  TRADE: { cuic: `${SAP_BASE_URL}/cuic-trade`,  deliveryNotes: `${SAP_BASE_URL}/delivery-notes-trade`, series: 95  },
  UDC:   { cuic: `${SAP_BASE_URL}/cuic-udc`,    deliveryNotes: `${SAP_BASE_URL}/delivery-notes-udc`,   series: SERIES_PENDIENTE },
};

// Endpoint de artículos por BD (UDC = /articulos-udc; CIMU/TEST = /articulos).
const ARTICULOS_ENDPOINT: Record<SapDatabase, string> = {
  CIMU:  `${SAP_BASE_URL}/articulos`,
  TEST:  `${SAP_BASE_URL}/articulos`,
  TRADE: `${SAP_BASE_URL}/articulos-trade`,
  UDC:   `${SAP_BASE_URL}/articulos-udc`,
};

// Endpoints segun ambiente
export const getEndpoints = (env: Environment) => ({
  cuic: ENDPOINT_CONFIG[env].cuic,
  articulos: ARTICULOS_ENDPOINT[env] || `${SAP_BASE_URL}/articulos`,
  deliveryNotes: ENDPOINT_CONFIG[env].deliveryNotes,
});

// En dev/stage (NO prod) los POST de CIMU se mandan a la SAP de PRUEBAS
// (PB_SBOCIMU) usando el endpoint/serie de TEST, para no tocar la CIMU real de
// producción. Prod (app.qeb.mx) se comporta normal. TRADE y UDC aún no tienen
// BD de prueba en SAP, así que por ahora solo aplica a CIMU (UDC = siempre
// productivo, igual que TRADE).
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
