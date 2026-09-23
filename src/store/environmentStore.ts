import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SapDatabase = 'CIMU' | 'TEST' | 'TRADE' | 'UDC';
export type Environment = SapDatabase;

export const SAP_BASE_URL = 'https://workflow-namely-changes-nothing.trycloudflare.com';

// SERIES por BD SAP (CIMU=164, TRADE=95, UDC=91). UDC ya trae su serie real
// confirmada por IMU (91, misma en PB_SBOUDC pruebas y SBOUDC producción), así
// que ya NO se bloquea el POST. Se conserva el centinela por compatibilidad.
export const SERIES_PENDIENTE = -1;
export const SERIES_UDC = 91;

// Endpoint del proxy para la SAP de PRUEBAS de UDC (compañía PB_SBOUDC).
// En dev/local los POST de UDC se mandan aquí para NO tocar la SBOUDC productiva.
// OJO: este nombre debe coincidir con la ruta que expone el proxy para PB_SBOUDC.
// Si en el VPS lo llamaste distinto, cámbialo aquí en una sola línea.
export const UDC_DELIVERY_PRUEBAS = `${SAP_BASE_URL}/delivery-notes-udc-test`;
export const UDC_CUIC_PRUEBAS = `${SAP_BASE_URL}/cuic-udc-test`;

// Configuracion por BD SAP
const ENDPOINT_CONFIG: Record<SapDatabase, { cuic: string; deliveryNotes: string; series: number }> = {
  CIMU:  { cuic: `${SAP_BASE_URL}/cuic`,       deliveryNotes: `${SAP_BASE_URL}/delivery-notes`,       series: 164 },
  TEST:  { cuic: `${SAP_BASE_URL}/cuic-test`,   deliveryNotes: `${SAP_BASE_URL}/delivery-notes-test`,  series: 4   },
  TRADE: { cuic: `${SAP_BASE_URL}/cuic-trade`,  deliveryNotes: `${SAP_BASE_URL}/delivery-notes-trade`, series: 95  },
  UDC:   { cuic: `${SAP_BASE_URL}/cuic-udc`,    deliveryNotes: `${SAP_BASE_URL}/delivery-notes-udc`,   series: SERIES_UDC },
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

// En dev/stage (NO prod) los POST se mandan a la SAP de PRUEBAS para no tocar la
// SAP productiva. Prod (app.qeb.mx) se comporta normal.
//  - CIMU  -> PB_SBOCIMU (endpoint/serie de TEST)
//  - UDC   -> PB_SBOUDC  (endpoint UDC_DELIVERY_PRUEBAS, misma serie 91)
// TRADE aún no tiene BD de prueba, así que sigue siempre productivo.
const IS_PROD = typeof window !== 'undefined' && window.location.hostname === 'app.qeb.mx';
export const usaSapPruebas = (sapDb: SapDatabase): boolean =>
  !IS_PROD && (sapDb === 'CIMU' || sapDb === 'UDC');
// resolveSapEnv solo re-mapea CIMU->TEST (misma serie/endpoint TEST). UDC conserva
// su clave 'UDC' (serie 91) y solo se le cambia el endpoint/compañía a pruebas.
const resolveSapEnv = (sapDb: SapDatabase): SapDatabase =>
  (usaSapPruebas(sapDb) && sapDb === 'CIMU') ? 'TEST' : sapDb;

// Nombre real de la compañía SAP (para buscar/actualizar delivery notes por NumAtCard).
// Respeta el desvío a pruebas: PB_SBOCIMU / PB_SBOUDC cuando aplica.
const SAP_COMPANY_PROD: Record<SapDatabase, string> = {
  CIMU: 'SBOCIMU', TEST: 'PB_SBOCIMU', TRADE: 'SBOIMUTRADE', UDC: 'SBOUDC',
};
export const getSapCompanyDb = (sapDb: SapDatabase): string => {
  if (usaSapPruebas(sapDb)) return sapDb === 'UDC' ? 'PB_SBOUDC' : 'PB_SBOCIMU';
  return SAP_COMPANY_PROD[sapDb] || 'PB_SBOCIMU';
};

// Helpers para SAP POST
export const getDeliveryNotesEndpoint = (sapDb: SapDatabase): string => {
  if (sapDb === 'UDC' && usaSapPruebas('UDC')) return UDC_DELIVERY_PRUEBAS;
  return ENDPOINT_CONFIG[resolveSapEnv(sapDb)].deliveryNotes;
};
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
