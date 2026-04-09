import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ticket, Search, Filter, Loader2, MessageSquare, Clock, CheckCircle2,
  X, AlertTriangle, Image, FileText, Send, Paperclip, Eye, User,
  ChevronDown, Circle, Info,
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { ticketsService, TicketHistorial, TicketMensaje, TicketChatMessage } from '../../services/tickets.service';
import { uploadsService } from '../../services/uploads.service';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useSocketTicketsHistorial, useSocketTicketChat, useSocketTicketChatSoporte } from '../../hooks/useSocket';

const STATUS_OPTIONS = ['Nuevo', 'En Progreso', 'Validación', 'Resuelto', 'Cerrado'];
const PRIORIDAD_OPTIONS = ['Baja', 'Normal', 'Alta', 'Urgente'];
const TEAM_MEMBERS = ['Jos', 'Akary', 'Mario', 'Bladi'];
const TEAM_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  'Jos': { text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  'Akary': { text: 'text-pink-400', bg: 'bg-pink-500/15', border: 'border-pink-500/30' },
  'Mario': { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'Bladi': { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
};

const statusStyles: Record<string, { text: string; bg: string; border: string }> = {
  'Nuevo': { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  'En Progreso': { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  'Validación': { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  'Resuelto': { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  'Cerrado': { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30' },
};

const prioridadStyles: Record<string, { text: string; bg: string; border: string }> = {
  'Baja': { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30' },
  'Normal': { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  'Alta': { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  'Urgente': { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

function getTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ===================== CHAT PANEL (reusable) =====================
function ChatPanel({
  messages,
  userId,
  ticketCreatorId,
  isDark,
  onSend,
  isPending,
  onFileUpload,
  uploading,
  emptyText,
  chatEndRef,
}: {
  messages: (TicketMensaje | TicketChatMessage)[];
  userId: number | undefined;
  ticketCreatorId?: number;
  isDark: boolean;
  onSend: (msg: string) => void;
  isPending: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  emptyText: string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [mensaje, setMensaje] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!mensaje.trim()) return;
    onSend(mensaje.trim());
    setMensaje('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className={`rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'} p-3 min-h-[200px] max-h-[300px] overflow-y-auto space-y-3`}>
        {messages.length === 0 && (
          <p className={`text-center text-sm py-8 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            {emptyText}
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.usuario_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isMe
                ? isDark ? 'bg-purple-600/30 border border-purple-500/30' : 'bg-purple-100 border border-purple-200'
                : isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-gray-200'
              }`}>
                <p className={`text-xs font-medium mb-1 ${isMe ? (isDark ? 'text-purple-300' : 'text-purple-700') : (isDark ? 'text-zinc-400' : 'text-gray-500')}`}>
                  {ticketCreatorId && msg.usuario_id !== ticketCreatorId ? 'Técnico de QEB' : msg.usuario_nombre}
                </p>
                {msg.mensaje && (
                  <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{msg.mensaje}</p>
                )}
                {msg.archivo_url && msg.archivo_tipo === 'image' && (
                  <a href={msg.archivo_url} target="_blank" rel="noopener noreferrer">
                    <img src={msg.archivo_url} alt={msg.archivo_nombre || 'Imagen'} className="max-h-40 rounded-lg mt-1 object-contain" />
                  </a>
                )}
                {msg.archivo_url && msg.archivo_tipo === 'file' && (
                  <a
                    href={msg.archivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 mt-1 px-2 py-1.5 rounded-lg text-xs ${isDark ? 'bg-zinc-700/50 text-purple-300 hover:bg-zinc-700' : 'bg-gray-100 text-purple-600 hover:bg-gray-200'} transition-colors`}
                  >
                    <FileText className="h-4 w-4" />
                    {msg.archivo_nombre || 'Archivo'}
                  </a>
                )}
                <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex items-end gap-2">
        <input type="file" ref={fileInputRef} className="hidden" onChange={onFileUpload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`p-2.5 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-800 text-purple-400 hover:bg-purple-500/10' : 'border-purple-200 bg-gray-50 text-purple-600 hover:bg-purple-50'} transition-colors flex-shrink-0`}
          title="Adjuntar archivo"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </button>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Escribe un mensaje..."
          className={`flex-1 px-3 py-2.5 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-800/80 text-white placeholder:text-zinc-500' : 'border-purple-200 bg-gray-50 text-gray-900 placeholder:text-gray-400'} text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none`}
        />
        <button
          onClick={handleSend}
          disabled={!mensaje.trim() || isPending}
          className="p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 transition-all flex-shrink-0"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </>
  );
}

// ===================== TICKET DETAIL MODAL =====================
function TicketDetailModal({
  ticket,
  onClose,
  onStatusChange,
  onAssigneeChange,
}: {
  ticket: TicketHistorial;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onAssigneeChange: (assignee: string) => void;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const notasChatEndRef = useRef<HTMLDivElement>(null);
  const soporteChatEndRef = useRef<HTMLDivElement>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [uploadingNotas, setUploadingNotas] = useState(false);
  const [uploadingSoporte, setUploadingSoporte] = useState(false);
  const [activeChat, setActiveChat] = useState<'notas' | 'soporte'>('notas');

  // Mark as opened
  useEffect(() => {
    ticketsService.markOpened(ticket.id);
  }, [ticket.id]);

  // ---- Notas y conversacion (internal) ----
  const { data: mensajes = [], refetch: refetchMensajes } = useQuery({
    queryKey: ['ticket-mensajes', ticket.id],
    queryFn: () => ticketsService.getMensajes(ticket.id),
    refetchInterval: 10000,
  });

  const handleNuevoMensaje = useCallback(() => {
    refetchMensajes();
    queryClient.invalidateQueries({ queryKey: ['tickets-historial'] });
    queryClient.invalidateQueries({ queryKey: ['tickets-unread-count'] });
  }, [refetchMensajes, queryClient]);
  useSocketTicketChat(ticket.id, handleNuevoMensaje);

  useEffect(() => {
    if (mensajes.length > 0) {
      const lastId = mensajes[mensajes.length - 1].id;
      ticketsService.markMensajesRead(ticket.id, lastId);
      queryClient.invalidateQueries({ queryKey: ['tickets-historial'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-unread-count'] });
    }
  }, [mensajes, ticket.id, queryClient]);

  useEffect(() => {
    if (activeChat === 'notas') notasChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, activeChat]);

  const sendNotaMutation = useMutation({
    mutationFn: (data: { mensaje?: string; archivo_url?: string; archivo_nombre?: string; archivo_tipo?: string }) =>
      ticketsService.createMensaje(ticket.id, data),
    onSuccess: () => refetchMensajes(),
  });

  const handleNotaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 20 * 1024 * 1024) return;
    setUploadingNotas(true);
    try {
      const uploaded = await uploadsService.uploadFile(file, 'ticket-chat');
      sendNotaMutation.mutate({
        archivo_url: uploaded.url,
        archivo_nombre: uploaded.originalName,
        archivo_tipo: file.type.startsWith('image/') ? 'image' : 'file',
      });
    } catch {} finally {
      setUploadingNotas(false);
      const input = e.target; input.value = '';
    }
  };

  // ---- Chat de soporte (with ticket creator) ----
  const { data: chatMessages = [], refetch: refetchChat } = useQuery({
    queryKey: ['ticket-chat', ticket.id],
    queryFn: () => ticketsService.getChatMessages(ticket.id),
    refetchInterval: 10000,
  });

  const handleNuevoChat = useCallback(() => {
    refetchChat();
    queryClient.invalidateQueries({ queryKey: ['tickets-historial'] });
  }, [refetchChat, queryClient]);
  useSocketTicketChatSoporte(ticket.id, handleNuevoChat);

  useEffect(() => {
    if (chatMessages.length > 0) {
      const lastId = chatMessages[chatMessages.length - 1].id;
      ticketsService.markChatRead(ticket.id, lastId);
      queryClient.invalidateQueries({ queryKey: ['tickets-historial'] });
    }
  }, [chatMessages, ticket.id, queryClient]);

  useEffect(() => {
    if (activeChat === 'soporte') soporteChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeChat]);

  const sendChatMutation = useMutation({
    mutationFn: (data: { mensaje?: string; archivo_url?: string; archivo_nombre?: string; archivo_tipo?: string }) =>
      ticketsService.createChatMessage(ticket.id, data),
    onSuccess: () => refetchChat(),
  });

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 20 * 1024 * 1024) return;
    setUploadingSoporte(true);
    try {
      const uploaded = await uploadsService.uploadFile(file, 'ticket-chat');
      sendChatMutation.mutate({
        archivo_url: uploaded.url,
        archivo_nombre: uploaded.originalName,
        archivo_tipo: file.type.startsWith('image/') ? 'image' : 'file',
      });
    } catch {} finally {
      setUploadingSoporte(false);
      const input = e.target; input.value = '';
    }
  };

  const ss = statusStyles[ticket.status] || statusStyles['Nuevo'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-50 w-full max-w-3xl max-h-[90vh] flex flex-col ${isDark ? 'bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900' : 'bg-white'} border ${isDark ? 'border-purple-500/30' : 'border-purple-200'} rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40' : 'bg-purple-50'} flex-shrink-0`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <Ticket className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
            </div>
            <div className="min-w-0">
              <h2 className={`text-lg font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                #{ticket.id} — {ticket.titulo}
              </h2>
              <p className={`text-xs ${isDark ? 'text-purple-300/70' : 'text-gray-500'}`}>
                {ticket.usuario_nombre} · {new Date(ticket.created_at).toLocaleString('es-MX')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${isDark ? 'hover:bg-purple-500/20' : 'hover:bg-purple-50'} rounded-xl transition-colors`}>
            <X className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-gray-500'}`} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Ticket info */}
          <div className={`p-5 border-b ${isDark ? 'border-purple-500/10' : 'border-gray-100'}`}>
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="relative">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${ss.text} ${ss.bg} ${ss.border} hover:opacity-80 transition-opacity`}
                >
                  {ticket.status}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showStatusDropdown && (
                  <div className={`absolute top-full left-0 mt-1 z-10 rounded-xl border ${isDark ? 'bg-zinc-900 border-purple-500/30' : 'bg-white border-gray-200'} shadow-xl py-1 min-w-[140px]`}>
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => { onStatusChange(s); setShowStatusDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium ${isDark ? 'hover:bg-purple-500/10 text-zinc-300' : 'hover:bg-gray-50 text-gray-700'} transition-colors ${s === ticket.status ? (isDark ? 'bg-purple-500/20' : 'bg-purple-50') : ''}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select
                value={ticket.status_cambiado_por?.trim() || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  onAssigneeChange(value);
                }}
                onClick={(e) => e.stopPropagation()}
                className={`px-2 py-1 rounded-full text-xs font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${
                  ticket.status_cambiado_por?.trim()
                    ? `${TEAM_COLORS[ticket.status_cambiado_por.trim()]?.text || 'text-zinc-400'} ${TEAM_COLORS[ticket.status_cambiado_por.trim()]?.bg || 'bg-zinc-800'} ${TEAM_COLORS[ticket.status_cambiado_por.trim()]?.border || 'border-zinc-700'}`
                    : isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-600 border-amber-200'
                }`}
              >
                <option value="">Sin atender</option>
                {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${prioridadStyles[ticket.prioridad]?.text} ${prioridadStyles[ticket.prioridad]?.bg} ${prioridadStyles[ticket.prioridad]?.border}`}>
                {ticket.prioridad}
              </span>
            </div>

            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>
              {ticket.descripcion}
            </p>

            {ticket.imagen && (
              <div className="mt-3">
                <a href={ticket.imagen} target="_blank" rel="noopener noreferrer">
                  <img src={ticket.imagen} alt="Captura" className={`max-h-48 rounded-xl border ${isDark ? 'border-purple-500/20' : 'border-gray-200'} object-contain`} />
                </a>
              </div>
            )}

            <div className={`mt-3 flex items-center gap-4 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{ticket.usuario_email}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(ticket.created_at).toLocaleString('es-MX')}</span>
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{ticket.total_mensajes} notas</span>
            </div>
          </div>

          {/* Chat tabs */}
          <div className={`px-5 pt-4 border-b ${isDark ? 'border-purple-500/10' : 'border-gray-100'}`}>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveChat('notas')}
                className={`px-4 py-2 rounded-t-xl text-xs font-medium transition-all flex items-center gap-2 ${
                  activeChat === 'notas'
                    ? isDark ? 'bg-purple-500/20 text-purple-300 border border-b-0 border-purple-500/30' : 'bg-purple-50 text-purple-700 border border-b-0 border-purple-200'
                    : isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Notas internas
                {mensajes.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-purple-500/30 text-purple-200' : 'bg-purple-200 text-purple-700'}`}>
                    {mensajes.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveChat('soporte')}
                className={`px-4 py-2 rounded-t-xl text-xs font-medium transition-all flex items-center gap-2 ${
                  activeChat === 'soporte'
                    ? isDark ? 'bg-cyan-500/20 text-cyan-300 border border-b-0 border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border border-b-0 border-cyan-200'
                    : isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                Chat con {ticket.usuario_nombre.split(' ')[0]}
                {chatMessages.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-cyan-500/30 text-cyan-200' : 'bg-cyan-200 text-cyan-700'}`}>
                    {chatMessages.length}
                  </span>
                )}
                {ticket.has_chat_unread && activeChat !== 'soporte' && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Active chat panel */}
          <div className="p-5">
            {activeChat === 'notas' ? (
              <ChatPanel
                messages={mensajes}
                userId={user?.id}
                isDark={isDark}
                onSend={(msg) => sendNotaMutation.mutate({ mensaje: msg })}
                isPending={sendNotaMutation.isPending}
                onFileUpload={handleNotaFileUpload}
                uploading={uploadingNotas}
                emptyText="No hay notas internas aun. Inicia la conversacion."
                chatEndRef={notasChatEndRef}
              />
            ) : (
              <ChatPanel
                messages={chatMessages}
                userId={user?.id}
                ticketCreatorId={ticket.usuario_id}
                isDark={isDark}
                onSend={(msg) => sendChatMutation.mutate({ mensaje: msg })}
                isPending={sendChatMutation.isPending}
                onFileUpload={handleChatFileUpload}
                uploading={uploadingSoporte}
                emptyText="No hay mensajes en el chat de soporte. Escribe para comunicarte con el creador del ticket."
                chatEndRef={soporteChatEndRef}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== MAIN PAGE =====================
export function HistorialTicketsPage() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterPrioridad, setFilterPrioridad] = useState('Todos');
  const [filterTecnico, setFilterTecnico] = useState('Todos');
  const [selectedTicket, setSelectedTicket] = useState<TicketHistorial | null>(null);
  const [activeTab, setActiveTab] = useState<'Nuevo' | 'En Progreso' | 'Validación' | 'Resuelto' | 'Cerrado'>('Nuevo');

  useSocketTicketsHistorial();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets-historial', filterStatus, filterPrioridad, debouncedSearch],
    queryFn: () => ticketsService.getHistorial({
      status: filterStatus !== 'Todos' ? filterStatus : undefined,
      prioridad: filterPrioridad !== 'Todos' ? filterPrioridad : undefined,
      search: debouncedSearch || undefined,
    }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, status_cambiado_por }: { id: number; status: string; status_cambiado_por?: string }) =>
      ticketsService.updateStatus(id, { status: status as any, status_cambiado_por }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-historial'] });
      if (selectedTicket) {
        // Refresh the selected ticket data
        ticketsService.getHistorial().then((all) => {
          const updated = all.find((t) => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        });
      }
    },
  });

  const tecnicos = [...new Set(tickets.map(t => t.status_cambiado_por).filter(Boolean))] as string[];

  const displayTickets = tickets.filter((t) => {
    if (t.status !== activeTab) return false;
    if (filterTecnico !== 'Todos' && t.status_cambiado_por !== filterTecnico) return false;
    return true;
  });

  const adminTabs: Array<{ key: typeof activeTab; label: string; showCount: boolean }> = [
    { key: 'Nuevo', label: 'Pendientes', showCount: true },
    { key: 'En Progreso', label: 'En Proceso', showCount: true },
    { key: 'Validación', label: 'Validación', showCount: true },
    { key: 'Resuelto', label: 'Resueltos', showCount: false },
    { key: 'Cerrado', label: 'Cerrados', showCount: false },
  ];

  const filteredByTecnico = filterTecnico !== 'Todos' ? tickets.filter(t => t.status_cambiado_por === filterTecnico) : tickets;
  const stats = {
    total: filteredByTecnico.length,
    nuevo: filteredByTecnico.filter((t) => t.status === 'Nuevo').length,
    enProgreso: filteredByTecnico.filter((t) => t.status === 'En Progreso').length,
    validacion: filteredByTecnico.filter((t) => t.status === 'Validación').length,
    resuelto: filteredByTecnico.filter((t) => t.status === 'Resuelto').length,
    cerrado: filteredByTecnico.filter((t) => t.status === 'Cerrado').length,
    unread: filteredByTecnico.filter((t) => t.has_unread || t.has_chat_unread).length,
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0f0a1a]' : 'bg-gray-50'}`}>
      <Header title="Historial de Tickets" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Title */}
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Historial de Tickets
          </h1>
          <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
            Gestion y seguimiento de todos los tickets de soporte
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: stats.total, tooltip: 'Cantidad total de tickets registrados en el sistema', dark: 'border-purple-500/20 bg-purple-500/5', light: 'border-purple-200 bg-purple-50' },
            { label: 'Nuevos', value: stats.nuevo, tooltip: 'Tickets recien creados que aun no han sido atendidos por nadie', dark: 'border-blue-500/20 bg-blue-500/5', light: 'border-blue-200 bg-blue-50' },
            { label: 'En Progreso', value: stats.enProgreso, tooltip: 'Tickets que alguien ya esta revisando o trabajando en ellos', dark: 'border-yellow-500/20 bg-yellow-500/5', light: 'border-yellow-200 bg-yellow-50' },
            { label: 'Resueltos', value: stats.resuelto, tooltip: 'Tickets cuyo problema fue solucionado y estan listos para cerrarse', dark: 'border-green-500/20 bg-green-500/5', light: 'border-green-200 bg-green-50' },
            { label: 'Cerrados', value: stats.cerrado, tooltip: 'Tickets finalizados que ya no requieren atencion', dark: 'border-zinc-500/20 bg-zinc-500/5', light: 'border-gray-200 bg-gray-50' },
            { label: 'No leidos', value: stats.unread, tooltip: 'Tickets con mensajes nuevos en el chat que aun no has leido', dark: 'border-red-500/20 bg-red-500/5', light: 'border-red-200 bg-red-50' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 relative group ${isDark ? s.dark : s.light}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{s.label}</p>
                </div>
                <div className="relative">
                  <Info className={`h-3.5 w-3.5 ${isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-300 hover:text-gray-500'} transition-colors cursor-help`} />
                  <div className={`absolute right-0 top-full mt-1 w-48 p-2 rounded-lg text-xs leading-relaxed shadow-xl z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-gray-900 text-gray-100'}`}>
                    {s.tooltip}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'bg-white'} backdrop-blur-xl p-4`}>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-purple-400' : 'text-gray-400'}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por titulo, descripcion o usuario..."
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900/80 text-white placeholder:text-zinc-500' : 'border-purple-200 bg-gray-50 text-gray-900 placeholder:text-gray-400'} text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30`}
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`px-3 py-2.5 rounded-xl border text-sm ${isDark ? 'border-purple-500/20 bg-zinc-900/80 text-white' : 'border-purple-200 bg-gray-50 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-purple-500/30`}
            >
              <option value="Todos">Status: Todos</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filterPrioridad}
              onChange={(e) => setFilterPrioridad(e.target.value)}
              className={`px-3 py-2.5 rounded-xl border text-sm ${isDark ? 'border-purple-500/20 bg-zinc-900/80 text-white' : 'border-purple-200 bg-gray-50 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-purple-500/30`}
            >
              <option value="Todos">Prioridad: Todos</option>
              {PRIORIDAD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={filterTecnico}
              onChange={(e) => setFilterTecnico(e.target.value)}
              className={`px-3 py-2.5 rounded-xl border text-sm ${isDark ? 'border-purple-500/20 bg-zinc-900/80 text-white' : 'border-purple-200 bg-gray-50 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-purple-500/30`}
            >
              <option value="Todos">Técnico: Todos</option>
              {tecnicos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 p-1 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-gray-100'}`}>
          {adminTabs.map((tab) => {
            const count = filteredByTecnico.filter(t => t.status === tab.key).length;
            const hasUnread = filteredByTecnico.some(t => t.status === tab.key && (t.has_unread || t.has_chat_unread));
            const isActive = activeTab === tab.key;
            const style = statusStyles[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? (isDark ? 'bg-zinc-700 text-white shadow' : 'bg-white text-gray-900 shadow') : (isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-700')}`}
              >
                {tab.label}
                {tab.showCount && count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? (style?.bg || 'bg-purple-500/10') + ' ' + (style?.text || 'text-purple-400') : (isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-200 text-gray-500')}`}>
                    {count}
                  </span>
                )}
                {hasUnread && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              </button>
            );
          })}
        </div>

        {/* Tickets List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className={`h-10 w-10 ${isDark ? 'text-purple-400' : 'text-purple-600'} animate-spin`} />
          </div>
        ) : displayTickets.length === 0 ? (
          <div className="text-center py-16">
            <Ticket className={`h-16 w-16 mx-auto mb-4 ${isDark ? 'text-purple-400/50' : 'text-purple-300'}`} />
            <p className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              No hay tickets en {adminTabs.find(t => t.key === activeTab)?.label || activeTab}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayTickets.map((t) => {
              const ss = statusStyles[t.status] || statusStyles['Nuevo'];
              const ps = prioridadStyles[t.prioridad] || prioridadStyles['Normal'];
              const isNew = !t.is_opened;

              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                    isNew
                      ? isDark
                        ? 'border-purple-500/40 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30 hover:border-purple-400/60 shadow-lg shadow-purple-500/10'
                        : 'border-purple-300 bg-gradient-to-r from-purple-50 to-fuchsia-50 hover:border-purple-400 shadow-md shadow-purple-100'
                      : isDark
                        ? 'border-purple-500/10 bg-zinc-900/50 hover:border-purple-500/30 hover:bg-zinc-900/80'
                        : 'border-gray-200 bg-white hover:border-purple-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread / new indicators */}
                    <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                      {isNew && (
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" title="No abierto" />
                      )}
                      {!isNew && (t.has_unread || t.has_chat_unread) && (
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" title="Mensajes no leidos" />
                      )}
                      {!isNew && !t.has_unread && !t.has_chat_unread && (
                        <div className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>#{t.id}</span>
                        <h3 className={`text-sm font-semibold truncate ${isNew ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-200' : 'text-gray-700')}`}>
                          {t.titulo}
                        </h3>
                      </div>
                      <p className={`text-xs truncate mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                        {t.descripcion}
                      </p>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${ss.text} ${ss.bg} ${ss.border}`}>
                          {t.status}
                        </span>
                        {(() => {
                          const assignee = t.status_cambiado_por?.trim();
                          const colors = assignee ? TEAM_COLORS[assignee] : null;
                          return (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                              assignee
                                ? `${colors?.text || 'text-zinc-400'} ${colors?.bg || 'bg-zinc-800'} ${colors?.border || 'border-zinc-700'}`
                                : isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>
                              <User className="h-2.5 w-2.5" /> {assignee || 'Sin atender'}
                            </span>
                          );
                        })()}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${ps.text} ${ps.bg} ${ps.border}`}>
                          {t.prioridad}
                        </span>
                        {t.usuario_area && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${isDark ? 'text-teal-400 bg-teal-500/10 border-teal-500/30' : 'text-teal-600 bg-teal-50 border-teal-200'}`}>
                            {t.usuario_area}
                          </span>
                        )}
                        {t.usuario_role && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${isDark ? 'text-violet-400 bg-violet-500/10 border-violet-500/30' : 'text-violet-600 bg-violet-50 border-violet-200'}`}>
                            {t.usuario_role}
                          </span>
                        )}
                        {t.imagen && <Image className={`h-3 w-3 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />}
                        {t.total_mensajes > 0 && (
                          <span className={`inline-flex items-center gap-1 text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                            <MessageSquare className="h-3 w-3" /> {t.total_mensajes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                        {getTimeAgo(t.created_at)}
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                        {t.usuario_nombre}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => {
            setSelectedTicket(null);
            queryClient.invalidateQueries({ queryKey: ['tickets-historial'] });
            queryClient.invalidateQueries({ queryKey: ['tickets-unread-count'] });
          }}
          onStatusChange={(status) => statusMutation.mutate({ id: selectedTicket.id, status })}
          onAssigneeChange={(assignee) => statusMutation.mutate({ id: selectedTicket.id, status: selectedTicket.status, status_cambiado_por: assignee || undefined })}
        />
      )}
    </div>
  );
}
