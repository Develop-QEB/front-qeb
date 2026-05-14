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
      return Promise.reject(error);
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
