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
};
