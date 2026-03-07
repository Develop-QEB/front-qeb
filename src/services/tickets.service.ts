import api from '../lib/api';

export interface Ticket {
  id: number;
  titulo: string;
  descripcion: string;
  imagen?: string | null;
  status: 'Nuevo' | 'En Progreso' | 'Resuelto' | 'Cerrado';
  prioridad: 'Baja' | 'Normal' | 'Alta' | 'Urgente';
  usuario_id: number;
  usuario_nombre: string;
  usuario_email: string;
  respuesta?: string | null;
  respondido_por?: string | null;
  respondido_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketInput {
  titulo: string;
  descripcion: string;
  imagen?: string | null;
  prioridad?: 'Baja' | 'Normal' | 'Alta' | 'Urgente';
}

export interface UpdateTicketStatusInput {
  status: 'Nuevo' | 'En Progreso' | 'Resuelto' | 'Cerrado';
  respuesta?: string;
}

export interface TicketStats {
  total: number;
  nuevo: number;
  enProgreso: number;
  resuelto: number;
  cerrado: number;
}

export interface TicketsResponse {
  data: Ticket[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const ticketsService = {
  // Obtener todos los tickets (para programadores)
  getAll: async (params?: {
    status?: string;
    prioridad?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<TicketsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.prioridad) queryParams.append('prioridad', params.prioridad);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await api.get(`/tickets?${queryParams.toString()}`);
    return response.data;
  },

  // Obtener mis tickets
  getMyTickets: async (): Promise<{ data: Ticket[] }> => {
    const response = await api.get('/tickets/my');
    return response.data;
  },

  // Obtener un ticket por ID
  getById: async (id: number): Promise<Ticket> => {
    const response = await api.get(`/tickets/${id}`);
    return response.data;
  },

  // Crear un nuevo ticket
  create: async (data: CreateTicketInput): Promise<Ticket> => {
    const response = await api.post('/tickets', data);
    return response.data;
  },

  // Actualizar status del ticket
  updateStatus: async (id: number, data: UpdateTicketStatusInput): Promise<Ticket> => {
    const response = await api.patch(`/tickets/${id}/status`, data);
    return response.data;
  },

  // Obtener estadisticas
  getStats: async (): Promise<TicketStats> => {
    const response = await api.get('/tickets/stats');
    return response.data;
  },
};
