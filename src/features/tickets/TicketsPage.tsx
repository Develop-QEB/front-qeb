import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket, Loader2, Plus, X, Image, AlertTriangle, Clock, CheckCircle2, Send } from 'lucide-react';
import { useState, useRef } from 'react';
import { Header } from '../../components/layout/Header';
import { ticketsService, Ticket as TicketType, CreateTicketInput } from '../../services/tickets.service';
import { useThemeStore } from '../../store/themeStore';
import { uploadsService } from '../../services/uploads.service';

const getInputClasses = (isDark: boolean) =>
  `w-full px-4 py-2.5 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-800/50 text-white placeholder-zinc-500 focus:border-purple-500/50' : 'border-purple-200 bg-white text-gray-900 placeholder-gray-400 focus:border-purple-400'} focus:outline-none focus:ring-1 ${isDark ? 'focus:ring-purple-500/30' : 'focus:ring-purple-300'} transition-colors`;

const STATUS_CONFIG: Record<string, { color: string; textColor: string; bgColor: string; borderColor: string; icon: typeof Ticket }> = {
  'Nuevo': { color: 'bg-blue-500', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: Ticket },
  'En Progreso': { color: 'bg-yellow-500', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: Clock },
  'Resuelto': { color: 'bg-green-500', textColor: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', icon: CheckCircle2 },
  'Cerrado': { color: 'bg-zinc-500', textColor: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30', icon: X },
};

const PRIORIDAD_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  'Baja': { color: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30' },
  'Normal': { color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  'Alta': { color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  'Urgente': { color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
};

function CreateTicketModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const inputClasses = getInputClasses(isDark);
  const labelClasses = `block text-sm font-medium mb-1.5 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`;
  const [form, setForm] = useState<CreateTicketInput>({
    titulo: '',
    descripcion: '',
    prioridad: 'Normal',
    imagen: null,
  });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: (data: CreateTicketInput) => ticketsService.create(data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no puede ser mayor a 5MB');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setForm({ ...form, imagen: file.name });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descripcion.trim()) {
      setError('Titulo y descripcion son requeridos');
      return;
    }
    let imagenUrl: string | null = null;
    if (imageFile) {
      try {
        const uploaded = await uploadsService.uploadFile(imageFile, 'tickets');
        imagenUrl = uploaded.url;
      } catch {
        setError('Error al subir la imagen');
        return;
      }
    }
    createMutation.mutate({ ...form, imagen: imagenUrl });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-50 w-full max-w-lg ${isDark ? 'bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900' : 'bg-white'} border ${isDark ? 'border-purple-500/30' : 'border-purple-200'} rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40' : 'bg-purple-50'} sticky top-0 z-10`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <Ticket className={`h-6 w-6 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Nuevo Ticket</h2>
              <p className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-gray-500'}`}>Describe tu problema o solicitud</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${isDark ? 'hover:bg-purple-500/20' : 'hover:bg-purple-50'} rounded-xl transition-colors group`}>
            <X className={`h-5 w-5 ${isDark ? 'text-purple-300 group-hover:text-white' : 'text-gray-500 group-hover:text-gray-900'} transition-colors`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClasses}>Titulo *</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className={inputClasses}
              placeholder="Ej: Error al cargar la pagina"
              required
            />
          </div>

          <div>
            <label className={labelClasses}>Descripcion *</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className={`${inputClasses} resize-none`}
              placeholder="Describe detalladamente el problema o solicitud..."
              rows={5}
              required
            />
          </div>

          <div>
            <label className={labelClasses}>Prioridad</label>
            <select
              value={form.prioridad}
              onChange={(e) => setForm({ ...form, prioridad: e.target.value as CreateTicketInput['prioridad'] })}
              className={inputClasses}
            >
              <option value="Baja">Baja - No urgente</option>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta - Afecta mi trabajo</option>
              <option value="Urgente">Urgente - Bloquea operaciones</option>
            </select>
          </div>

          <div>
            <label className={labelClasses}>Captura de pantalla (opcional)</label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className={`w-full max-h-48 object-contain rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-800/50' : 'border-purple-200 bg-gray-50'}`}
                />
                <button
                  type="button"
                  onClick={() => { setForm({ ...form, imagen: null }); setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full p-4 rounded-xl border-2 border-dashed ${isDark ? 'border-purple-500/30 hover:border-purple-500/50' : 'border-purple-200 hover:border-purple-300'} transition-colors flex flex-col items-center gap-2`}
              >
                <Image className="h-8 w-8 text-purple-400" />
                <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Haz clic para subir una imagen</span>
                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Max 5MB</span>
              </button>
            )}
          </div>

          {error && (
            <div className={`p-4 rounded-xl bg-red-500/10 border border-red-500/30 ${isDark ? 'text-red-300' : 'text-red-700'} text-sm flex items-center gap-2`}>
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className={`flex justify-end gap-3 pt-4 border-t ${isDark ? 'border-purple-500/20' : 'border-purple-200'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium ${isDark ? 'text-purple-300' : 'text-gray-700'} ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'hover:bg-purple-500/10' : 'hover:bg-purple-50'} hover:border-purple-500/40 transition-all`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {createMutation.isPending ? 'Enviando...' : 'Enviar Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewTicketModal({
  ticket,
  onClose,
}: {
  ticket: TicketType;
  onClose: () => void;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [showImage, setShowImage] = useState(false);

  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['Nuevo'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-50 w-full max-w-2xl ${isDark ? 'bg-gradient-to-br from-zinc-900 via-purple-950/20 to-zinc-900' : 'bg-white'} border ${isDark ? 'border-purple-500/30' : 'border-purple-200'} rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40' : 'bg-purple-50'} sticky top-0 z-10`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <Ticket className={`h-6 w-6 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Ticket #{ticket.id}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
                  {ticket.status}
                </span>
              </div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{ticket.titulo}</h2>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${isDark ? 'hover:bg-purple-500/20' : 'hover:bg-purple-50'} rounded-xl transition-colors group`}>
            <X className={`h-5 w-5 ${isDark ? 'text-purple-300 group-hover:text-white' : 'text-gray-500 group-hover:text-gray-900'} transition-colors`} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} border ${isDark ? 'border-purple-500/10' : 'border-gray-200'}`}>
            <h3 className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-600'} mb-2`}>Descripcion</h3>
            <p className={`${isDark ? 'text-zinc-300' : 'text-gray-600'} whitespace-pre-wrap`}>{ticket.descripcion}</p>
          </div>

          {ticket.imagen && (
            <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} border ${isDark ? 'border-purple-500/10' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowImage(!showImage)}
                className={`flex items-center gap-2 ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'} transition-colors`}
              >
                <Image className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {showImage ? 'Ocultar imagen' : 'Ver imagen adjunta'}
                </span>
              </button>
              {showImage && (
                <div className="mt-3">
                  <img
                    src={ticket.imagen}
                    alt="Imagen del ticket"
                    className={`max-w-full rounded-lg border ${isDark ? 'border-purple-500/20' : 'border-purple-200'}`}
                  />
                </div>
              )}
            </div>
          )}

          {ticket.respuesta && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <h3 className="text-sm font-medium text-green-400 mb-2">Respuesta del equipo</h3>
              <p className={`${isDark ? 'text-zinc-300' : 'text-gray-600'} whitespace-pre-wrap`}>{ticket.respuesta}</p>
              {ticket.respondido_por && (
                <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mt-2`}>
                  Por {ticket.respondido_por} - {ticket.respondido_at && new Date(ticket.respondido_at).toLocaleString('es-MX')}
                </p>
              )}
            </div>
          )}

          <div className={`flex items-center justify-between text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} pt-4 border-t ${isDark ? 'border-purple-500/20' : 'border-purple-200'}`}>
            <span>Creado: {new Date(ticket.created_at).toLocaleString('es-MX')}</span>
            <span>Actualizado: {new Date(ticket.updated_at).toLocaleString('es-MX')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TicketsPage() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => ticketsService.getMyTickets(),
  });

  const tickets = ticketsData?.data || [];

  return (
    <div className="min-h-screen">
      <Header title="Mis Tickets" />
      <div className="p-6 space-y-5">
        {/* Control Bar */}
        <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'bg-white'} backdrop-blur-xl p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Mis Tickets de Soporte</h2>
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Reporta problemas o solicita ayuda</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
              >
                <Plus className="h-4 w-4" />
                Nuevo Ticket
              </button>
              <div className={`px-4 py-2 rounded-xl ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} border ${isDark ? 'border-purple-500/20' : 'border-purple-200'}`}>
                <span className={`${isDark ? 'text-purple-300' : 'text-purple-600'} text-sm font-medium`}>{tickets.length} tickets</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tickets List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-purple-400 animate-spin mb-4" />
            <p className={`${isDark ? 'text-purple-300/70' : 'text-gray-500'} text-sm`}>Cargando tickets...</p>
          </div>
        ) : tickets.length > 0 ? (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['Nuevo'];
              const prioridadConfig = PRIORIDAD_CONFIG[ticket.prioridad] || PRIORIDAD_CONFIG['Normal'];
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={ticket.id}
                  className={`rounded-2xl border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'bg-white'} p-5 ${isDark ? 'hover:border-purple-500/40' : 'hover:border-purple-300'} transition-all cursor-pointer`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>#{ticket.id}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
                          <StatusIcon className="h-3 w-3" />
                          {ticket.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${prioridadConfig.bgColor} ${prioridadConfig.color} ${prioridadConfig.borderColor}`}>
                          {ticket.prioridad}
                        </span>
                      </div>
                      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-1`}>{ticket.titulo}</h3>
                      <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} line-clamp-2`}>{ticket.descripcion}</p>
                      <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mt-2`}>
                        Creado: {new Date(ticket.created_at).toLocaleString('es-MX')}
                      </p>
                    </div>
                    {ticket.imagen && (
                      <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} border ${isDark ? 'border-purple-500/20' : 'border-purple-200'}`}>
                        <Image className="h-5 w-5 text-purple-400" />
                      </div>
                    )}
                  </div>

                  {ticket.respuesta && (
                    <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                      <p className="text-xs text-green-400 font-medium mb-1">Respuesta:</p>
                      <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>{ticket.respuesta}</p>
                      {ticket.respondido_por && (
                        <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mt-1`}>
                          Por {ticket.respondido_por} - {ticket.respondido_at && new Date(ticket.respondido_at).toLocaleString('es-MX')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'bg-white'} p-16 text-center`}>
            <Ticket className="h-16 w-16 text-purple-400/50 mx-auto mb-4" />
            <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>No tienes tickets</h3>
            <p className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-6`}>Crea un ticket si necesitas ayuda o quieres reportar un problema</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 transition-all"
            >
              <Plus className="h-4 w-4" />
              Crear Primer Ticket
            </button>
          </div>
        )}

        {showCreateModal && (
          <CreateTicketModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
              setShowCreateModal(false);
            }}
          />
        )}

        {selectedTicket && (
          <ViewTicketModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
          />
        )}
      </div>
    </div>
  );
}
