import api from '../lib/api';

interface UploadResponse {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Resultado del proxy bulk: por cada URL pedida devuelve el buffer en base64
// + contentType (success), o `error` (failed). Pensado para que el exporter
// del Versionario embeba cientos de miniaturas con pocas requests al backend.
export interface ProxyBulkResult {
  url: string;
  buffer?: string;        // base64 del binario
  contentType?: string;
  error?: string;
}

export const uploadsService = {
  async uploadFile(file: File, folder: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<UploadResponse>>(
      `/uploads/general?folder=${encodeURIComponent(folder)}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al subir archivo');
    }
    return response.data.data;
  },

  // Descarga en paralelo desde el backend (server-side, sin el limite de 6
  // conexiones/host del browser) las URLs de Spaces dadas, devolviendo buffers
  // base64. El backend acepta máximo 100 URLs por request, asi que el caller
  // debe chunkear listas mas grandes.
  async proxyImagesBulk(
    urls: string[],
    opts?: { signal?: AbortSignal; timeout?: number }
  ): Promise<ProxyBulkResult[]> {
    if (urls.length === 0) return [];
    const response = await api.post<ApiResponse<ProxyBulkResult[]>>(
      `/uploads/proxy-images-bulk`,
      { urls },
      { signal: opts?.signal, timeout: opts?.timeout },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error en proxy bulk');
    }
    return response.data.data;
  },
};
