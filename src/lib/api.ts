import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---- Errores entendibles (Fase 1) ----
// Normaliza el error ANTES de que llegue a las pantallas. Casi todos los
// call-sites muestran `err.response?.data?.error || err.message`, así que aquí
// se sobreescriben AMBOS con un mensaje humano y con sugerencia de qué hacer:
// se acabó el "Request failed with status code 504". Los 400/409 del back ya
// vienen redactados para el usuario y se respetan tal cual; solo se tapan los
// mensajes técnicos (Prisma, stacks, errores de red del server).

const MENSAJE_POR_STATUS: Record<number, string> = {
  408: 'La operación tardó demasiado y se canceló. Intenta de nuevo.',
  429: 'Se enviaron demasiadas solicitudes en poco tiempo. Espera un momento e intenta de nuevo.',
  502: 'El servidor se está reiniciando o está saturado. Es probable que tus cambios NO se guardaran — espera unos segundos y vuelve a intentar.',
  503: 'El servidor no está disponible en este momento. Espera unos segundos y vuelve a intentar.',
  504: 'El servidor está saturado y tardó demasiado en responder. Es probable que tus cambios NO se guardaran — espera unos segundos y vuelve a intentar.',
};

// Mensajes que delatan un error interno y no le dicen nada al usuario.
const PATRON_TECNICO = /prisma|invocation|ECONN|ETIMEDOUT|EPIPE|getaddrinfo|socket hang up|cannot read|undefined|unexpected token|internal server error|request failed|jwt|token/i;

function normalizarErrorApi(error: AxiosError): AxiosError {
  const status = error.response?.status;
  const data = error.response?.data as { error?: unknown; message?: unknown } | undefined;
  const esBlob = typeof Blob !== 'undefined' && error.response?.data instanceof Blob;
  const dataError = !esBlob && typeof data?.error === 'string' && data.error.trim()
    ? data.error
    : (!esBlob && typeof data?.message === 'string' && data.message.trim() ? data.message : '');
  const dataErrorUsable = dataError && !PATRON_TECNICO.test(dataError) ? dataError : '';

  let mensaje = '';
  if (!error.response) {
    mensaje = typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'Sin conexión a internet. Revisa tu red e intenta de nuevo.'
      : 'No se pudo contactar al servidor. Revisa tu conexión e intenta de nuevo en unos segundos.';
  } else if (status && MENSAJE_POR_STATUS[status]) {
    mensaje = MENSAJE_POR_STATUS[status];
  } else if (status === 403) {
    mensaje = dataErrorUsable || 'No tienes permiso para realizar esta acción. Si crees que deberías poder hacerlo, pide a sistemas que revisen tu rol.';
  } else if (status === 404) {
    mensaje = dataErrorUsable || 'No se encontró la información solicitada. Puede que haya sido eliminada — recarga la página e intenta de nuevo.';
  } else if (status && status >= 500) {
    mensaje = dataErrorUsable || 'Ocurrió un error inesperado en el servidor al procesar la operación. Intenta de nuevo; si persiste, repórtalo a sistemas.';
  } else if (status && status >= 400) {
    // 400/409/422: mensajes de validación del back (ya humanos). Solo se cubre
    // el caso en que vengan vacíos o técnicos.
    mensaje = dataErrorUsable || 'La operación no pudo procesarse con los datos enviados. Revisa la información e intenta de nuevo.';
  }

  if (mensaje) {
    error.message = mensaje;
    if (!esBlob && data && typeof data === 'object') {
      (data as Record<string, unknown>).error = mensaje;
      if ('message' in data) (data as Record<string, unknown>).message = mensaje;
    }
  }
  return error;
}

// Refresh lock - prevents multiple simultaneous refresh calls
let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (error: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

// Response interceptor - auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Modo mantenimiento programado: el back devuelve 503 con code=MAINTENANCE
    // para roles no permitidos. Forzamos navegacion full a /mantenimiento
    // para cortar la sesion de uso (queries en vuelo, polling, etc.).
    const data = error.response?.data as { code?: string } | undefined;
    if (
      error.response?.status === 503 &&
      data?.code === 'MAINTENANCE' &&
      window.location.pathname !== '/mantenimiento'
    ) {
      window.location.href = '/mantenimiento';
      return Promise.reject(error);
    }

    // Skip auth pages
    const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
    if (isAuthPage) return Promise.reject(error);

    // Only handle 401 and don't retry the refresh call itself
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(normalizarErrorApi(error));
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      isRefreshing = false;
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    try {
      // Call refresh endpoint directly with axios (not the api instance, to avoid interceptor loop)
      const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

      // Update tokens in store and localStorage
      useAuthStore.getState().updateTokens(newAccessToken, newRefreshToken);

      // Process queued requests with new token
      processQueue(null, newAccessToken);

      // Retry original request with new token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed - session truly expired, logout
      processQueue(refreshError, null);
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
