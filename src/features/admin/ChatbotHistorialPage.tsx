import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, ChevronDown, ChevronRight, User, Monitor, Layers, Clock, MessageSquare, Search } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { useThemeStore } from '../../store/themeStore';
import { useSocketChatbotAdmin } from '../../hooks/useSocket';
import api from '../../lib/api';

interface ChatMessage {
  id: number;
  pantalla: string | null;
  modal: string | null;
  pregunta: string;
  respuesta: string;
  categoria: string | null;
  off_topic: boolean;
  created_at: string;
}

interface Session {
  session_id: string;
  user_id: number;
  user_nombre: string;
  user_email: string;
  rol: string;
  started_at: string;
  ended_at: string;
  messages: ChatMessage[];
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function duration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return '< 1 min';
  return `${mins} min`;
}

export function ChatbotHistorialPage() {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const queryClient = useQueryClient();
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [newLogs, setNewLogs] = useState(0);

  const handleNuevoLog = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chatbot-logs'] });
    setNewLogs(prev => prev + 1);
    setTimeout(() => setNewLogs(0), 3000);
  }, [queryClient]);

  useSocketChatbotAdmin(handleNuevoLog);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['chatbot-logs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Session[] }>('/chatbot/logs');
      return res.data.data;
    },
  });

  const toggleSession = (id: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = (data || []).filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.user_nombre.toLowerCase().includes(q) ||
      s.user_email.toLowerCase().includes(q) ||
      s.rol.toLowerCase().includes(q) ||
      s.messages.some(m => m.pregunta.toLowerCase().includes(q) || m.respuesta.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header title="Historial QEBooh" />
      <div className="flex-1 overflow-y-auto p-6">

        {/* Stats bar */}
        {data && (
          <div className="flex gap-4 mb-6">
            {[
              { label: 'Conversaciones', value: data.length },
              { label: 'Mensajes totales', value: data.reduce((a, s) => a + s.messages.length, 0) },
              { label: 'Usuarios únicos', value: new Set(data.map(s => s.user_id)).size },
              { label: 'Off-topic', value: data.reduce((a, s) => a + s.messages.filter(m => m.off_topic).length, 0) },
            ].map(({ label, value }) => (
              <div key={label} className={`flex-1 rounded-xl px-4 py-3 border ${isDark ? 'bg-zinc-900 border-purple-500/20' : 'bg-white border-gray-200'}`}>
                <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex flex-1 items-center gap-2 px-3 py-2 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'}`}>
            <Search className={`h-4 w-4 flex-shrink-0 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Buscar por usuario, rol o contenido..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`flex-1 bg-transparent text-sm outline-none ${isDark ? 'text-white placeholder:text-zinc-600' : 'text-gray-900 placeholder:text-gray-400'}`}
            />
          </div>
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${newLogs > 0 ? 'bg-green-500/20 border-green-500/40 text-green-400' : isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-500' : 'bg-white border-gray-200 text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${newLogs > 0 ? 'bg-green-400 animate-pulse' : isDark ? 'bg-zinc-600' : 'bg-gray-300'}`} />
            En vivo
          </div>
        </div>

        {/* Sessions list */}
        {isLoading && (
          <div className={`text-center py-16 text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Cargando historial...</div>
        )}
        {isError && (
          <div className="text-center py-16 text-sm text-red-400">Error al cargar el historial.</div>
        )}

        <div className="space-y-3">
          {filtered.map(session => {
            const isExpanded = expandedSessions.has(session.session_id);
            return (
              <div key={session.session_id} className={`rounded-xl border overflow-hidden ${isDark ? 'bg-zinc-900 border-purple-500/20' : 'bg-white border-gray-200'}`}>
                {/* Session header */}
                <button
                  onClick={() => toggleSession(session.session_id)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                      <User className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{session.user_nombre}</p>
                      <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{session.user_email}</p>
                    </div>
                    <span className={`hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${isDark ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                      {session.rol || 'Sin rol'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 ml-3 flex-shrink-0">
                    <div className={`hidden md:flex items-center gap-1 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                      <Clock className="h-3 w-3" />
                      {formatDateTime(session.started_at)} · {duration(session.started_at, session.ended_at)}
                    </div>
                    <div className={`flex items-center gap-1 text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                      <MessageSquare className="h-3 w-3" />
                      {session.messages.length}
                    </div>
                    {isExpanded
                      ? <ChevronDown className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-400'}`} />
                      : <ChevronRight className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-400'}`} />
                    }
                  </div>
                </button>

                {/* Messages */}
                {isExpanded && (
                  <div className={`border-t px-4 py-3 space-y-4 ${isDark ? 'border-zinc-800 bg-zinc-950/50' : 'border-gray-100 bg-gray-50/50'}`}>
                    {session.messages.map((msg, i) => (
                      <div key={msg.id} className="space-y-2">
                        {/* Meta */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{formatTime(msg.created_at)}</span>
                          {msg.pantalla && (
                            <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-200 text-gray-500'}`}>
                              <Monitor className="h-2.5 w-2.5" />{msg.pantalla}
                            </span>
                          )}
                          {msg.modal && (
                            <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-purple-50 text-purple-500 border border-purple-200'}`}>
                              <Layers className="h-2.5 w-2.5" />{msg.modal}
                            </span>
                          )}
                          {msg.off_topic && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">off-topic</span>
                          )}
                          {msg.categoria && !msg.off_topic && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-400'}`}>{msg.categoria}</span>
                          )}
                        </div>
                        {/* User message */}
                        <div className="flex justify-end">
                          <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-sm bg-purple-600 text-white text-sm whitespace-pre-wrap">
                            {msg.pregunta}
                          </div>
                        </div>
                        {/* Bot response */}
                        <div className="flex justify-start">
                          <div className={`max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-sm text-sm whitespace-pre-wrap ${isDark ? 'bg-zinc-800 text-zinc-200 border border-zinc-700' : 'bg-white text-gray-800 border border-gray-200'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <Bot className={`h-3 w-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                              <span className={`text-[10px] font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>QEBooh</span>
                            </div>
                            {msg.respuesta}
                          </div>
                        </div>
                        {i < session.messages.length - 1 && (
                          <hr className={isDark ? 'border-zinc-800' : 'border-gray-100'} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {!isLoading && filtered.length === 0 && (
            <div className={`text-center py-16 text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              {search ? 'No se encontraron resultados.' : 'No hay conversaciones registradas aún.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
