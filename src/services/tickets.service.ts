import api from '../lib/api';

// Categorías hardcoded — deben coincidir con back CATEGORIAS_TI.
// TI => routa a equipo TI. QEB => routa a equipo QEB (default si no se elige).
export const TICKET_CATEGORIAS_TI = [
  'Desposteo SAP',
  'Posteo SAP',
  'Ajuste de Usuario',
] as const;

export const TICKET_CATEGORIAS_QEB = [
  'Autorización DG/DCM',
  'Asignación de circuitos/inventario',
  'Edición de propuesta o campaña',
  'Versionario / Reportes',
  'Otro',
] as const;

export type TicketCategoria =
  | (typeof TICKET_CATEGORIAS_TI)[number]
  | (typeof TICKET_CATEGORIAS_QEB)[number];

export type TicketArea = 'TI' | 'QEB';

export interface Ticket {
  id: number;
  titulo: string;
  descripcion: string;
  imagen?: string | null;
  status: 'Nuevo' | 'En Progreso' | 'Validación' | 'Resuelto' | 'Cerrado';
  prioridad: 'Baja' | 'Normal' | 'Alta' | 'Urgente';
  categoria?: string | null;
  area?: TicketArea;
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
  categoria?: string | null;
}

export interface UpdateTicketStatusInput {
  status: 'Nuevo' | 'En Progreso' | 'Validación' | 'Resuelto' | 'Cerrado';
  respuesta?: string;
  status_cambiado_por?: string;
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

export interface DevUser {
  id: number;
  nombre: string;
  foto_perfil?: string | null;
}

// Historial types
export interface TicketHistorial {
  id: number;
  titulo: string;
  descripcion: string;
  imagen?: string | null;
  status: string;
  prioridad: string;
  categoria?: string | null;
  area?: TicketArea;
  usuario_id: number;
  usuario_nombre: string;
  usuario_email: string;
  usuario_area?: string | null;
  usuario_role?: string | null;
  status_cambiado_por?: string | null;
  total_mensajes: number;
  total_chat: number;
  has_unread: boolean;
  has_chat_unread: boolean;
  has_mention: boolean;
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

  // Reasignar entre QEB y TI. Feedback 2026-08-15.
  updateArea: async (id: number, area: 'QEB' | 'TI'): Promise<Ticket> => {
    const response = await api.patch(`/tickets/${id}/area`, { area });
    return response.data;
  },

  // Acciones masivas. Feedback 2026-08-15.
  bulkUpdateStatus: async (ids: number[], status: string): Promise<{ updated: number; saltados: number }> => {
    const response = await api.patch('/tickets/bulk/status', { ids, status });
    return response.data;
  },
  bulkUpdateArea: async (ids: number[], area: 'QEB' | 'TI'): Promise<{ updated: number; saltados: number }> => {
    const response = await api.patch('/tickets/bulk/area', { ids, area });
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

  createMensaje: async (ticketId: number, data: { mensaje?: string; archivo_url?: string; archivo_nombre?: string; archivo_tipo?: string; menciones?: number[] }): Promise<TicketMensaje> => {
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

  deleteChatMessage: async (messageId: number): Promise<void> => {
    await api.delete(`/tickets/chat/${messageId}`);
  },

  markChatRead: async (ticketId: number, ultimoMensajeId: number): Promise<void> => {
    await api.post(`/tickets/${ticketId}/chat/read`, { ultimo_mensaje_id: ultimoMensajeId });
  },

  getChatUnreadCount: async (): Promise<number> => {
    const response = await api.get('/tickets/chat/unread-count');
    return response.data.data.unreadCount;
  },

  getDevUsers: async (): Promise<DevUser[]> => {
    const response = await api.get('/tickets/dev-users');
    return response.data.data;
  },

  getRankings: async (): Promise<TicketRankings> => {
    const response = await api.get('/tickets/rankings');
    return response.data.data;
  },
};

export interface TicketRankings {
  empleadoDelMes: { nombre: string; count: number; foto_perfil: string | null; top_usuario: string | null } | null;
  topCreadores: { nombre: string; count: number }[];
  topTecnicos: { nombre: string; count: number }[];
  topUrgentes: { nombre: string; count: number }[];
  ticketsPorHora: { hora: number; count: number }[];
  ticketsPorDia: { dia: string; count: number }[];
  velocidadTecnicos: { nombre: string; promedio_horas: number }[];
  topReincidentes: { nombre: string; count: number }[];
  topAreas: { nombre: string; count: number }[];
  topRoles: { nombre: string; count: number }[];
  totalTickets: number;
  totalResueltos: number;
}
