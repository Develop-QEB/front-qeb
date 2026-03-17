import api from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  success: boolean;
  data?: { reply: string };
  error?: string;
}

export const chatbotService = {
  async send(
    messages: ChatMessage[],
    pantalla?: string,
    modal?: string | null,
    permisos?: string,
  ): Promise<string> {
    const response = await api.post<ChatResponse>('/chatbot', {
      messages,
      pantalla,
      modal: modal || null,
      permisos: permisos || null,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al enviar mensaje');
    }
    return response.data.data.reply;
  },
};
