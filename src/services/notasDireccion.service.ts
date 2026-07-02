import api from '../lib/api';

export interface NotaDireccion {
  id: number | string;
  texto: string;
  autor_nombre: string | null;
  autor_rol: string | null;
  autor_id: number | null;
  created_at: string;
  origen: 'inicial' | 'bitacora';
}

export const notasDireccionService = {
  async getAll(idSolicitud: number): Promise<NotaDireccion[]> {
    const { data } = await api.get(`/solicitudes/${idSolicitud}/notas-direccion`);
    if (!data.success) throw new Error(data.error || 'Error al obtener notas de dirección');
    return data.data as NotaDireccion[];
  },

  async create(idSolicitud: number, texto: string): Promise<{ id: number }> {
    const { data } = await api.post(`/solicitudes/${idSolicitud}/notas-direccion`, { texto });
    if (!data.success) throw new Error(data.error || 'Error al agregar nota de dirección');
    return data.data;
  },
};
