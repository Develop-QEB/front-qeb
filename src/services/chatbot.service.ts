import api from '../lib/api';
import type { AccionQEBooh } from '../lib/solicitudPrefill';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReply {
  reply: string;
  /** Botones que QEBooh ofrece bajo su respuesta (p. ej. abrir una solicitud prellenada). */
  acciones: AccionQEBooh[];
}

interface ChatResponse {
  success: boolean;
  data?: { reply: string; acciones?: AccionQEBooh[] };
  error?: string;
}

export const chatbotService = {
  async send(
    messages: ChatMessage[],
    pantalla?: string,
    modal?: string | null,
    permisos?: string,
    contextoUI?: string | null,
    /**
     * Lo capturado en el formulario abierto. Va en un campo propio: solo lo usa
     * QEBooh con herramientas; el QEBooh normal lo ignora y recibe exactamente
     * lo mismo que antes.
     */
    contextoFormulario?: string | null,
  ): Promise<ChatReply> {
    const response = await api.post<ChatResponse>('/chatbot', {
      messages,
      pantalla,
      modal: modal || null,
      permisos: permisos || null,
      contextoUI: contextoUI || null,
      ...(contextoFormulario ? { contextoFormulario } : {}),
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al enviar mensaje');
    }
    return {
      reply: response.data.data.reply,
      acciones: Array.isArray(response.data.data.acciones) ? response.data.data.acciones : [],
    };
  },
};
