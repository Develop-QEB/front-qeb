import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, Bot, Trash2, ExternalLink } from 'lucide-react';
import { chatbotService } from '../../services/chatbot.service';
import { useThemeStore } from '../../store/themeStore';
import { useModalStore } from '../../store/modalStore';
import { useAuthStore } from '../../store/authStore';
import { getPermissions, RolePermissions } from '../../lib/permissions';

// Map of module keywords to routes for inline links
const MODULE_LINKS: { keyword: RegExp; route: string }[] = [
  { keyword: /\bDashboard\b/gi, route: '/dashboard' },
  { keyword: /\bSolicitudes\b/gi, route: '/solicitudes' },
  { keyword: /\bPropuestas\b/gi, route: '/propuestas' },
  { keyword: /\bCampa[ñn]as?\b/gi, route: '/campanas' },
  { keyword: /\bInventarios?\b/gi, route: '/inventarios' },
  { keyword: /\bClientes\b/gi, route: '/clientes' },
  { keyword: /\bProveedores\b/gi, route: '/proveedores' },
  { keyword: /\bNotificaciones\b/gi, route: '/notificaciones' },
  { keyword: /\bCorreos\b/gi, route: '/correos' },
  { keyword: /\bPerfil\b/gi, route: '/perfil' },
  { keyword: /\bGesti[oó]n de Artes\b/gi, route: '/campanas' },
];

// Contextual suggestions per screen
const SCREEN_SUGGESTIONS: Record<string, string[]> = {
  '/dashboard': [
    'Que significan las metricas del dashboard?',
    'Como accedo rapido a mis campanas activas?',
    'Donde veo las solicitudes pendientes?',
  ],
  '/solicitudes': [
    'Como creo una nueva solicitud?',
    'Como edito una solicitud existente?',
    'Que significan los estados de solicitud?',
  ],
  '/propuestas': [
    'Como asigno inventario a una propuesta?',
    'Como comparto una propuesta con el cliente?',
    'Como apruebo una propuesta?',
  ],
  '/campanas': [
    'Como veo el detalle de una campana?',
    'Como asigno APS a los espacios?',
    'Donde esta la gestion de artes?',
  ],
  '/campanas/detail': [
    'Como asigno APS a los espacios?',
    'Como accedo al gestor de tareas?',
    'Como veo el inventario reservado?',
  ],
  '/campanas/tareas': [
    'Como subo artes a los espacios?',
    'Como apruebo o rechazo un arte?',
    'Como creo una orden de programacion?',
  ],
  '/inventarios': [
    'Como filtro los inventarios por plaza?',
    'Como bloqueo o desbloqueo un espacio?',
    'Como veo el historial de un inventario?',
  ],
  '/clientes': [
    'Como creo un nuevo cliente?',
    'Como busco un cliente existente?',
    'Como edito la informacion de un cliente?',
  ],
  '/proveedores': [
    'Como agrego un nuevo proveedor?',
    'Como edito un proveedor?',
    'Que tipos de proveedores hay?',
  ],
  '/notificaciones': [
    'Como marco una notificacion como leida?',
    'Como filtro mis tareas pendientes?',
    'Como cambio la vista a Kanban?',
  ],
  '/perfil': [
    'Como cambio mi contrasena?',
    'Como actualizo mi foto de perfil?',
    'Como edito mis datos personales?',
  ],
};

function getScreenName(pathname: string): string {
  if (pathname.includes('/tareas')) return 'Gestion de Artes';
  if (pathname.includes('/campanas/detail')) return 'Detalle de Campana';
  if (pathname.includes('/campanas')) return 'Campanas';
  if (pathname.includes('/solicitudes')) return 'Solicitudes';
  if (pathname.includes('/propuestas')) return 'Propuestas';
  if (pathname.includes('/inventarios')) return 'Inventarios';
  if (pathname.includes('/clientes')) return 'Clientes';
  if (pathname.includes('/proveedores')) return 'Proveedores';
  if (pathname.includes('/notificaciones')) return 'Notificaciones';
  if (pathname.includes('/correos')) return 'Correos';
  if (pathname.includes('/perfil')) return 'Perfil';
  if (pathname.includes('/admin')) return 'Admin';
  return 'Dashboard';
}

function getSuggestions(pathname: string): string[] {
  // Check specific routes first
  if (pathname.includes('/tareas')) return SCREEN_SUGGESTIONS['/campanas/tareas'];
  if (pathname.includes('/campanas/detail')) return SCREEN_SUGGESTIONS['/campanas/detail'];
  // Then check general routes
  for (const [route, suggestions] of Object.entries(SCREEN_SUGGESTIONS)) {
    if (pathname.startsWith(route)) return suggestions;
  }
  return SCREEN_SUGGESTIONS['/dashboard'];
}

interface NavAction { route: string; label: string; }
interface ParsedMessage { text: string; navActions: NavAction[]; }

function parseResponse(raw: string): ParsedMessage {
  const navActions: NavAction[] = [];
  const navRegex = /\[NAV:([^\]|]+)\|([^\]]+)\]/g;
  const text = raw.replace(navRegex, (_, route, label) => {
    navActions.push({ route: route.trim(), label: label.trim() });
    return '';
  }).trim();
  return { text, navActions };
}

function buildPermsSummary(perms: RolePermissions): string {
  const noAccess: string[] = [];
  if (!perms.canSeeDashboard) noAccess.push('Dashboard');
  if (!perms.canSeeClientes) noAccess.push('Clientes');
  if (!perms.canSeeProveedores) noAccess.push('Proveedores');
  if (!perms.canSeeSolicitudes) noAccess.push('Solicitudes');
  if (!perms.canSeePropuestas) noAccess.push('Propuestas');
  if (!perms.canSeeCampanas) noAccess.push('Campanas');
  if (!perms.canSeeInventarios) noAccess.push('Inventarios');
  if (!perms.canSeeAdminUsuarios) noAccess.push('Admin Usuarios');

  const restrictions: string[] = [];
  if (noAccess.length > 0) restrictions.push(`No puede ver los modulos: ${noAccess.join(', ')}`);
  if (!perms.canCreateSolicitudes) restrictions.push('No puede crear solicitudes');
  if (!perms.canEditSolicitudes) restrictions.push('No puede editar solicitudes');
  if (!perms.canAtenderSolicitudes) restrictions.push('No puede atender solicitudes');
  if (!perms.canCreateClientes) restrictions.push('No puede crear clientes');
  if (!perms.canEditClientes) restrictions.push('No puede editar clientes');
  if (!perms.canCreateProveedores) restrictions.push('No puede crear proveedores');
  if (!perms.canAsignarInventario) restrictions.push('No puede asignar inventario en propuestas');
  if (!perms.canAprobarPropuesta) restrictions.push('No puede aprobar propuestas');
  if (!perms.canEditCampanas) restrictions.push('No puede editar campanas');
  if (!perms.canCreateInventarios) restrictions.push('No puede crear inventarios');
  if (!perms.canEditInventarios) restrictions.push('No puede editar inventarios');
  if (!perms.canOpenTasks) restrictions.push('No puede abrir tareas en Gestion de Artes (solo lectura)');
  if (!perms.canEditGestionArtes) restrictions.push('No puede editar Gestion de Artes');

  return restrictions.length > 0 ? restrictions.join('. ') : 'Acceso completo a la plataforma';
}

interface Message { role: 'user' | 'assistant'; content: string; }

function RichText({ text, onNavigate, isDark }: { text: string; onNavigate: (route: string) => void; isDark: boolean }) {
  const matches: { index: number; length: number; route: string; original: string }[] = [];
  for (const mod of MODULE_LINKS) {
    let m;
    const regex = new RegExp(mod.keyword.source, mod.keyword.flags);
    while ((m = regex.exec(text)) !== null) {
      matches.push({ index: m.index, length: m[0].length, route: mod.route, original: m[0] });
    }
  }
  matches.sort((a, b) => a.index - b.index);
  const filtered: typeof matches = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.index >= lastEnd) { filtered.push(m); lastEnd = m.index + m.length; }
  }
  const segments: { type: 'text' | 'link'; content: string; route?: string }[] = [];
  let cursor = 0;
  for (const m of filtered) {
    if (m.index > cursor) segments.push({ type: 'text', content: text.slice(cursor, m.index) });
    segments.push({ type: 'link', content: m.original, route: m.route });
    cursor = m.index + m.length;
  }
  if (cursor < text.length) segments.push({ type: 'text', content: text.slice(cursor) });
  if (segments.length === 0) return <>{text}</>;
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'link' ? (
          <button key={i} onClick={() => onNavigate(seg.route!)}
            className={`inline font-medium underline decoration-dotted underline-offset-2 transition-colors ${
              isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'
            }`}>{seg.content}</button>
        ) : <span key={i}>{seg.content}</span>
      )}
    </>
  );
}

export function QEBbooh() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDark = useThemeStore(s => s.theme === 'dark');

  const activeModal = useModalStore((s) => s.activeModal);
  const user = useAuthStore((s) => s.user);
  const permsSummary = useMemo(() => buildPermsSummary(getPermissions(user?.rol)), [user?.rol]);

  const currentScreen = useMemo(() => getScreenName(location.pathname), [location.pathname]);
  const suggestions = useMemo(() => getSuggestions(location.pathname), [location.pathname]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);

  const handleNavigate = (route: string) => { navigate(route); setIsOpen(false); };

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    const userMessage: Message = { role: 'user', content: msg };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await chatbotService.send(newMessages, location.pathname, activeModal, permsSummary);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ups, tuve un problema al responder. Intenta de nuevo en un momento.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const renderAssistantMessage = (content: string) => {
    const { text, navActions } = parseResponse(content);
    return (
      <>
        <RichText text={text} onNavigate={handleNavigate} isDark={isDark} />
        {navActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-purple-500/20">
            {navActions.map((nav, i) => (
              <button key={i} onClick={() => handleNavigate(nav.route)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95 ${
                  isDark
                    ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30'
                    : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'
                }`}>
                <ExternalLink className="h-3 w-3" />
                {nav.label}
              </button>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
          isOpen ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500'
        }`} title="QEBbooh">
        {isOpen ? <X className="h-6 w-6 text-white" /> : <MessageCircle className="h-6 w-6 text-white" />}
      </button>

      {isOpen && (
        <div className={`fixed bottom-24 right-6 z-50 w-[520px] max-h-[700px] rounded-2xl shadow-2xl border flex flex-col overflow-hidden ${
          isDark ? 'bg-zinc-900 border-purple-500/20' : 'bg-white border-gray-200'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-white" />
              <div>
                <span className="text-sm font-bold text-white">QEBbooh</span>
                <span className="text-xs text-purple-200 ml-2">
                  {activeModal ? `${currentScreen} › ${activeModal}` : currentScreen}
                </span>
              </div>
            </div>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" title="Limpiar conversacion">
                <Trash2 className="h-3.5 w-3.5 text-white/70" />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[380px]">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Bot className={`h-12 w-12 mb-3 ${isDark ? 'text-purple-400/30' : 'text-purple-300'}`} />
                <p className={`text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                  Hola! Soy QEBbooh
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                  Estas en {currentScreen} - preguntame lo que necesites
                </p>
                <div className="mt-4 space-y-1.5 w-full">
                  {suggestions.map((q) => (
                    <button key={q} onClick={() => handleSend(q)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        isDark
                          ? 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20'
                          : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'
                      }`}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-md'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-bl-md'
                      : 'bg-gray-100 text-gray-800 border border-gray-200 rounded-bl-md'
                }`}>
                  {msg.role === 'assistant' ? renderAssistantMessage(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className={`px-4 py-3 rounded-2xl rounded-bl-md ${
                  isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-100 border border-gray-200'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`flex items-center gap-2 p-3 border-t flex-shrink-0 ${
            isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'
          }`}>
            <input ref={inputRef} type="text" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..." disabled={isLoading}
              className={`flex-1 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 ${
                isDark ? 'bg-zinc-800 text-white placeholder:text-zinc-500 border border-zinc-700' : 'bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300'
              }`} />
            <button onClick={() => handleSend()} disabled={!input.trim() || isLoading}
              className="p-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
