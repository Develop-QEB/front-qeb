import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Ticket, Search, Filter, Clock, CheckCircle2, XCircle, AlertTriangle,
  MessageSquare, User, Mail, Calendar, ChevronDown, ChevronUp, Image,
  Loader2, Send, ArrowLeft, RefreshCw
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { ticketsService, Ticket as TicketType, UpdateTicketStatusInput } from '../../services/tickets.service';
import { UserAvatar } from '../../components/ui/user-avatar';

const STATUS_CONFIG = {
  'Nuevo': { color: 'bg-blue-500', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: Ticket },
  'En Progreso': { color: 'bg-yellow-500', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: Clock },
  'Resuelto': { color: 'bg-green-500', textColor: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', icon: CheckCircle2 },
  'Cerrado': { color: 'bg-zinc-500', textColor: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30', icon: XCircle },
};

const PRIORIDAD_CONFIG = {
  'Baja': { color: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30' },
  'Normal': { color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  'Alta': { color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  'Urgente': { color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
};

function TicketCard({
  ticket,
  onSelect,
  isSelected,
}: {
  ticket: TicketType;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['Nuevo'];
  const prioridadConfig = PRIORIDAD_CONFIG[ticket.prioridad] || PRIORIDAD_CONFIG['Normal'];
  const StatusIcon = statusConfig.icon;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? 'bg-purple-500/20 border-purple-500/50'
          : 'bg-zinc-800/50 border-purple-500/10 hover:border-purple-500/30 hover:bg-zinc-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-zinc-500">#{ticket.id}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
              <StatusIcon className="h-3 w-3" />
              {ticket.status}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${prioridadConfig.bgColor} ${prioridadConfig.color} ${prioridadConfig.borderColor}`}>
              {ticket.prioridad}
            </span>
          </div>
          <h3 className="font-medium text-white truncate">{ticket.titulo}</h3>
          <p className="text-sm text-zinc-400 truncate mt-1">{ticket.descripcion}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {ticket.usuario_nombre}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(ticket.created_at).toLocaleDateString('es-MX')}
            </span>
            {ticket.imagen && (
              <span className="flex items-center gap-1 text-purple-400">
                <Image className="h-3 w-3" />
                Imagen
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function TicketDetail({
  ticket,
  onClose,
  onStatusUpdate,
  isUpdating,
}: {
  ticket: TicketType;
  onClose: () => void;
  onStatusUpdate: (data: UpdateTicketStatusInput) => void;
  isUpdating: boolean;
}) {
  const [newStatus, setNewStatus] = useState(ticket.status);
  const [respuesta, setRespuesta] = useState('');
  const [showImage, setShowImage] = useState(false);

  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['Nuevo'];
  const prioridadConfig = PRIORIDAD_CONFIG[ticket.prioridad] || PRIORIDAD_CONFIG['Normal'];

  const handleSubmit = () => {
    onStatusUpdate({
      status: newStatus as UpdateTicketStatusInput['status'],
      respuesta: respuesta.trim() || undefined,
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors lg:hidden"
          >
            <ArrowLeft className="h-5 w-5 text-purple-300" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-zinc-500">Ticket #{ticket.id}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
                {ticket.status}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${prioridadConfig.bgColor} ${prioridadConfig.color} ${prioridadConfig.borderColor}`}>
                {ticket.prioridad}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">{ticket.titulo}</h2>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Info del usuario */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-purple-500/10">
          <UserAvatar nombre={ticket.usuario_nombre} size="md" />
          <div>
            <p className="font-medium text-white">{ticket.usuario_nombre}</p>
            <p className="text-sm text-zinc-400 flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {ticket.usuario_email}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-zinc-500">Creado</p>
            <p className="text-sm text-zinc-300">
              {new Date(ticket.created_at).toLocaleString('es-MX')}
            </p>
          </div>
        </div>

        {/* Descripcion */}
        <div className="p-4 rounded-xl bg-zinc-800/50 border border-purple-500/10">
          <h3 className="text-sm font-medium text-purple-300 mb-2">Descripcion</h3>
          <p className="text-zinc-300 whitespace-pre-wrap">{ticket.descripcion}</p>
        </div>

        {/* Imagen */}
        {ticket.imagen && (
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-purple-500/10">
            <button
              onClick={() => setShowImage(!showImage)}
              className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
            >
              <Image className="h-4 w-4" />
              <span className="text-sm font-medium">
                {showImage ? 'Ocultar imagen' : 'Ver imagen adjunta'}
              </span>
              {showImage ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showImage && (
              <div className="mt-3">
                <img
                  src={ticket.imagen}
                  alt="Imagen del ticket"
                  className="max-w-full rounded-lg border border-purple-500/20"
                />
              </div>
            )}
          </div>
        )}

        {/* Respuesta anterior */}
        {ticket.respuesta && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-green-400" />
              <h3 className="text-sm font-medium text-green-400">Respuesta</h3>
            </div>
            <p className="text-zinc-300 whitespace-pre-wrap">{ticket.respuesta}</p>
            {ticket.respondido_por && (
              <p className="text-xs text-zinc-500 mt-2">
                Por {ticket.respondido_por} - {ticket.respondido_at && new Date(ticket.respondido_at).toLocaleString('es-MX')}
              </p>
            )}
          </div>
        )}

        {/* Actualizar status */}
        <div className="p-4 rounded-xl bg-zinc-800/50 border border-purple-500/10">
          <h3 className="text-sm font-medium text-purple-300 mb-3">Actualizar Ticket</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as typeof newStatus)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-purple-500/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              >
                <option value="Nuevo">Nuevo</option>
                <option value="En Progreso">En Progreso</option>
                <option value="Resuelto">Resuelto</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">Respuesta (opcional)</label>
              <textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                placeholder="Escribe una respuesta para el usuario..."
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-purple-500/20 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
                rows={4}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={isUpdating || (newStatus === ticket.status && !respuesta.trim())}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 transition-all"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Actualizar Ticket
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DevTicketsPage() {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [prioridadFilter, setPrioridadFilter] = useState('Todos');

  const { data: ticketsData, isLoading, refetch } = useQuery({
    queryKey: ['dev-tickets', statusFilter, prioridadFilter, search],
    queryFn: () => ticketsService.getAll({
      status: statusFilter !== 'Todos' ? statusFilter : undefined,
      prioridad: prioridadFilter !== 'Todos' ? prioridadFilter : undefined,
      search: search || undefined,
      limit: 100,
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['ticket-stats'],
    queryFn: () => ticketsService.getStats(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTicketStatusInput }) =>
      ticketsService.updateStatus(id, data),
    onSuccess: (updatedTicket) => {
      queryClient.invalidateQueries({ queryKey: ['dev-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-stats'] });
      setSelectedTicket(updatedTicket);
    },
  });

  const tickets = ticketsData?.data || [];

  return (
    <div className="min-h-screen">
      <Header title="Tickets de Soporte" />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: stats?.total || 0, color: 'purple' },
            { label: 'Nuevos', value: stats?.nuevo || 0, color: 'blue' },
            { label: 'En Progreso', value: stats?.enProgreso || 0, color: 'yellow' },
            { label: 'Resueltos', value: stats?.resuelto || 0, color: 'green' },
            { label: 'Cerrados', value: stats?.cerrado || 0, color: 'zinc' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`p-4 rounded-xl border border-${stat.color}-500/20 bg-${stat.color}-500/10`}
            >
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-zinc-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
              <input
                type="search"
                placeholder="Buscar tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-purple-500/20 bg-zinc-900/80 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-purple-500/20 bg-zinc-900/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            >
              <option value="Todos">Todos los status</option>
              <option value="Nuevo">Nuevo</option>
              <option value="En Progreso">En Progreso</option>
              <option value="Resuelto">Resuelto</option>
              <option value="Cerrado">Cerrado</option>
            </select>

            <select
              value={prioridadFilter}
              onChange={(e) => setPrioridadFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-purple-500/20 bg-zinc-900/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            >
              <option value="Todos">Todas las prioridades</option>
              <option value="Urgente">Urgente</option>
              <option value="Alta">Alta</option>
              <option value="Normal">Normal</option>
              <option value="Baja">Baja</option>
            </select>

            <button
              onClick={() => refetch()}
              className="p-2.5 rounded-xl border border-purple-500/20 bg-zinc-900/80 text-purple-400 hover:bg-purple-500/20 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tickets List */}
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 overflow-hidden">
            <div className="p-4 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Ticket className="h-5 w-5 text-purple-400" />
                Tickets ({tickets.length})
              </h2>
            </div>

            <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-10">
                  <Ticket className="h-12 w-12 text-purple-400/50 mx-auto mb-3" />
                  <p className="text-zinc-400">No hay tickets</p>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onSelect={() => setSelectedTicket(ticket)}
                    isSelected={selectedTicket?.id === ticket.id}
                  />
                ))
              )}
            </div>
          </div>

          {/* Ticket Detail */}
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 overflow-hidden">
            {selectedTicket ? (
              <TicketDetail
                ticket={selectedTicket}
                onClose={() => setSelectedTicket(null)}
                onStatusUpdate={(data) =>
                  updateMutation.mutate({ id: selectedTicket.id, data })
                }
                isUpdating={updateMutation.isPending}
              />
            ) : (
              <div className="h-full flex items-center justify-center p-10">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 text-purple-400/30 mx-auto mb-4" />
                  <p className="text-zinc-400">Selecciona un ticket para ver los detalles</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
