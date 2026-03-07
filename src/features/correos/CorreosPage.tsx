import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Mail, MailOpen, X, RefreshCw, Inbox,
  Calendar, ChevronDown, ChevronRight, Clock
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { correosService, Correo } from '../../services/correos.service';
import { formatDate } from '../../lib/utils';

type FilterType = 'all' | 'unread' | 'read';

// Drawer para ver el correo completo
function CorreoDrawer({
  correo,
  onClose,
}: {
  correo: Correo;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          {correo.leido ? (
            <MailOpen className="h-5 w-5 text-zinc-500" />
          ) : (
            <Mail className="h-5 w-5 text-purple-400" />
          )}
          <span className="text-sm text-zinc-400">Correo</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Asunto */}
        <div>
          <h2 className="text-xl font-semibold text-white">
            {correo.asunto}
          </h2>
        </div>

        {/* Metadatos */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">De</label>
            <div className="p-2 rounded-lg bg-zinc-800/50 text-sm text-zinc-300">
              {correo.remitente}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Para</label>
            <div className="p-2 rounded-lg bg-zinc-800/50 text-sm text-zinc-300">
              {correo.destinatario}
            </div>
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-xs text-zinc-500 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Fecha de envío
            </label>
            <div className="p-2 rounded-lg bg-zinc-800/50 text-sm text-zinc-300">
              {formatDate(correo.fecha_envio)}
            </div>
          </div>
        </div>

        {/* Cuerpo del correo */}
        <div className="space-y-2">
          <label className="text-xs text-zinc-500">Contenido</label>
          <div className="p-4 rounded-xl bg-zinc-800/50 text-sm text-zinc-300 border border-zinc-700/50 whitespace-pre-wrap min-h-[200px]">
            {correo.cuerpo}
          </div>
        </div>
      </div>
    </div>
  );
}

// Fila de correo en la tabla
function CorreoRow({
  correo,
  onSelect,
}: {
  correo: Correo;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`hover:bg-zinc-800/30 cursor-pointer transition-colors ${
        !correo.leido ? 'bg-purple-500/5' : ''
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {correo.leido ? (
            <MailOpen className="h-4 w-4 text-zinc-500" />
          ) : (
            <Mail className="h-4 w-4 text-purple-400" />
          )}
          <span className={`text-sm ${!correo.leido ? 'font-semibold text-white' : 'text-zinc-400'}`}>
            {correo.remitente}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className={`text-sm ${!correo.leido ? 'font-semibold text-white' : 'text-zinc-300'}`}>
          {correo.asunto}
        </div>
        <div className="text-xs text-zinc-500 truncate max-w-md">
          {correo.cuerpo.substring(0, 100)}...
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-400">
        {formatDate(correo.fecha_envio)}
      </td>
      <td className="px-4 py-3">
        {!correo.leido && (
          <span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Nuevo
          </span>
        )}
      </td>
    </tr>
  );
}

export function CorreosPage() {
  const queryClient = useQueryClient();

  // Estado
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedCorreo, setSelectedCorreo] = useState<Correo | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Fetch stats - refetch cada 2 minutos para evitar exceder límite de conexiones BD
  const { data: stats } = useQuery({
    queryKey: ['correos-stats'],
    queryFn: () => correosService.getStats(),
    refetchInterval: 120000, // 2 minutos
    staleTime: 30000,
  });

  // Fetch correos
  const { data, isLoading } = useQuery({
    queryKey: ['correos', search, filter],
    queryFn: () =>
      correosService.getAll({
        limit: 100,
        search: search || undefined,
        leido: filter === 'all' ? '' : filter === 'read',
      }),
  });

  const correos = data?.data || [];

  // Filtrar localmente por búsqueda
  const filteredCorreos = useMemo(() => {
    if (!search) return correos;
    const searchLower = search.toLowerCase();
    return correos.filter(
      c =>
        c.asunto.toLowerCase().includes(searchLower) ||
        c.cuerpo.toLowerCase().includes(searchLower) ||
        c.remitente.toLowerCase().includes(searchLower)
    );
  }, [correos, search]);

  // Seleccionar correo y marcarlo como leído
  const handleSelectCorreo = async (correo: Correo) => {
    if (!correo.leido) {
      await correosService.getById(correo.id); // Esto lo marca como leído
      queryClient.invalidateQueries({ queryKey: ['correos'] });
      queryClient.invalidateQueries({ queryKey: ['correos-stats'] });
    }
    setSelectedCorreo(correo);
  };

  const filterLabels: Record<FilterType, string> = {
    all: 'Todos',
    unread: 'No leídos',
    read: 'Leídos',
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="Correos" />

      {/* Barra superior */}
      <div className="sticky top-16 z-20 bg-[#1a1025]/95 backdrop-blur-sm border-b border-zinc-800/80">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar correos..."
                className="w-80 pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Filtro */}
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all"
              >
                <span>{filterLabels[filter]}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 z-50 min-w-[140px] rounded-xl border border-purple-500/20 bg-zinc-900 backdrop-blur-xl shadow-2xl overflow-hidden">
                    {(['all', 'unread', 'read'] as FilterType[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => { setFilter(f); setFilterOpen(false); }}
                        className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                          filter === f
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        {filterLabels[f]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Acciones y stats */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['correos'] })}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refrescar</span>
            </button>

            {/* Stats */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                <Mail className="h-3 w-3 text-purple-400" />
                <span className="text-xs text-purple-300">{stats?.no_leidos || 0} sin leer</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700">
                <Inbox className="h-3 w-3 text-zinc-400" />
                <span className="text-xs text-zinc-400">{stats?.total || 0} total</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : filteredCorreos.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-12 text-center">
            <Inbox className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500">No tienes correos</p>
            <p className="text-xs text-zinc-600 mt-1">Los correos del sistema aparecerán aquí</p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-800/50 border-b border-zinc-700/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-48">
                      De
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Asunto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-40">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-24">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredCorreos.map((correo) => (
                    <CorreoRow
                      key={correo.id}
                      correo={correo}
                      onSelect={() => handleSelectCorreo(correo)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedCorreo && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedCorreo(null)}
          />
          <CorreoDrawer
            correo={selectedCorreo}
            onClose={() => setSelectedCorreo(null)}
          />
        </>
      )}
    </div>
  );
}
