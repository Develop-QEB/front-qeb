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
  has_chat_unread?: boolean;
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

// Historial types
export interface TicketHistorial {
  id: number;
  titulo: string;
  descripcion: string;
  imagen?: string | null;
  status: string;
  prioridad: string;
  usuario_id: number;
  usuario_nombre: string;
  usuario_email: string;
  status_cambiado_por?: string | null;
  total_mensajes: number;
  total_chat: number;
  has_unread: boolean;
  has_chat_unread: boolean;
  is_opened: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketChatMessage {
  id: number;
  ticket_id: number;
  usuario_id: number;
  usuario_nombre: string;
  mensaje?: string | null;
  archivo_url?: string | null;
  archivo_nombre?: string | null;
  archivo_tipo?: string | null;
  created_at: string;
}

export interface TicketMensaje {
  id: number;
  ticket_id: number;
  usuario_id: number;
  usuario_nombre: string;
  mensaje?: string | null;
  archivo_url?: string | null;
  archivo_nombre?: string | null;
  archivo_tipo?: string | null;
  created_at: string;
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

  // ---- Historial ----
  getHistorial: async (params?: { status?: string; prioridad?: string; search?: string }): Promise<TicketHistorial[]> => {
    const qp = new URLSearchParams();
    if (params?.status) qp.append('status', params.status);
    if (params?.prioridad) qp.append('prioridad', params.prioridad);
    if (params?.search) qp.append('search', params.search);
    const response = await api.get(`/tickets/historial?${qp.toString()}`);
    return response.data.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await api.get('/tickets/unread-count');
    return response.data.data.unreadCount;
  },

  markOpened: async (ticketId: number): Promise<void> => {
    await api.post(`/tickets/${ticketId}/opened`);
  },

  getMensajes: async (ticketId: number): Promise<TicketMensaje[]> => {
    const response = await api.get(`/tickets/${ticketId}/mensajes`);
    return response.data.data;
  },

  createMensaje: async (ticketId: number, data: { mensaje?: string; archivo_url?: string; archivo_nombre?: string; archivo_tipo?: string }): Promise<TicketMensaje> => {
    const response = await api.post(`/tickets/${ticketId}/mensajes`, data);
    return response.data.data;
  },

  markMensajesRead: async (ticketId: number, ultimoMensajeId: number): Promise<void> => {
    await api.post(`/tickets/${ticketId}/mensajes/read`, { ultimo_mensaje_id: ultimoMensajeId });
  },

  // ---- Chat de soporte ----
  getChatMessages: async (ticketId: number): Promise<TicketChatMessage[]> => {
    const response = await api.get(`/tickets/${ticketId}/chat`);
    return response.data.data;
  },

  createChatMessage: async (ticketId: number, data: { mensaje?: string; archivo_url?: string; archivo_nombre?: string; archivo_tipo?: string }): Promise<TicketChatMessage> => {
    const response = await api.post(`/tickets/${ticketId}/chat`, data);
    return response.data.data;
  },

  markChatRead: async (ticketId: number, ultimoMensajeId: number): Promise<void> => {
    await api.post(`/tickets/${ticketId}/chat/read`, { ultimo_mensaje_id: ultimoMensajeId });
  },

  getChatUnreadCount: async (): Promise<number> => {
    const response = await api.get('/tickets/chat/unread-count');
    return response.data.data.unreadCount;
  },
};
