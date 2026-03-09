import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Mail, MailOpen, X, RefreshCw, Inbox,
  Calendar, ChevronDown, ChevronRight, Clock
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { correosService, Correo } from '../../services/correos.service';
import { formatDate } from '../../lib/utils';
import { useThemeStore } from '../../store/themeStore';

type FilterType = 'all' | 'unread' | 'read';

// Drawer para ver el correo completo
function CorreoDrawer({
  correo,
  onClose,
}: {
  correo: Correo;
  onClose: () => void;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  return (
    <div className={`fixed inset-y-0 right-0 w-full max-w-2xl border-l shadow-2xl z-50 flex flex-col ${
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          {correo.leido ? (
            <MailOpen className={`h-5 w-5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
          ) : (
            <Mail className="h-5 w-5 text-purple-400" />
          )}
          <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Correo</span>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Asunto */}
        <div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {correo.asunto}
          </h2>
        </div>

        {/* Metadatos */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>De</label>
            <div className={`p-2 rounded-lg text-sm ${isDark ? 'bg-zinc-800/50 text-zinc-300' : 'bg-gray-50 text-gray-700'}`}>
              {correo.remitente}
            </div>
          </div>
          <div className="space-y-1">
            <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Para</label>
            <div className={`p-2 rounded-lg text-sm ${isDark ? 'bg-zinc-800/50 text-zinc-300' : 'bg-gray-50 text-gray-700'}`}>
              {correo.destinatario}
            </div>
          </div>
          <div className="space-y-1 col-span-2">
            <label className={`text-xs flex items-center gap-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              <Calendar className="h-3 w-3" /> Fecha de envío
            </label>
            <div className={`p-2 rounded-lg text-sm ${isDark ? 'bg-zinc-800/50 text-zinc-300' : 'bg-gray-50 text-gray-700'}`}>
              {formatDate(correo.fecha_envio)}
            </div>
          </div>
        </div>

        {/* Cuerpo del correo */}
        <div className="space-y-2">
          <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Contenido</label>
          <div className={`p-4 rounded-xl text-sm border whitespace-pre-wrap min-h-[200px] ${
            isDark ? 'bg-zinc-800/50 text-zinc-300 border-zinc-700/50' : 'bg-gray-50 text-gray-700 border-gray-200'
          }`}>
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
  isDark,
}: {
  correo: Correo;
  onSelect: () => void;
  isDark: boolean;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer transition-colors ${
        isDark
          ? `hover:bg-zinc-800/30 ${!correo.leido ? 'bg-purple-500/5' : ''}`
          : `hover:bg-gray-50 ${!correo.leido ? 'bg-purple-50/50' : ''}`
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {correo.leido ? (
            <MailOpen className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
          ) : (
            <Mail className="h-4 w-4 text-purple-400" />
          )}
          <span className={`text-sm ${!correo.leido
            ? (isDark ? 'font-semibold text-white' : 'font-semibold text-gray-900')
            : (isDark ? 'text-zinc-400' : 'text-gray-500')
          }`}>
            {correo.remitente}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className={`text-sm ${!correo.leido
          ? (isDark ? 'font-semibold text-white' : 'font-semibold text-gray-900')
          : (isDark ? 'text-zinc-300' : 'text-gray-600')
        }`}>
          {correo.asunto}
        </div>
        <div className={`text-xs truncate max-w-md ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
          {correo.cuerpo.substring(0, 100)}...
        </div>
      </td>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
        {formatDate(correo.fecha_envio)}
      </td>
      <td className="px-4 py-3">
        {!correo.leido && (
          <span className={`px-2 py-1 rounded-full text-xs border ${
            isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200'
          }`}>
            Nuevo
          </span>
        )}
      </td>
    </tr>
  );
}

export function CorreosPage() {
  const queryClient = useQueryClient();
  const isDark = useThemeStore((s) => s.theme) === 'dark';

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
      <div className={`sticky top-16 z-20 backdrop-blur-sm border-b ${
        isDark ? 'bg-[#1a1025]/95 border-zinc-800/80' : 'bg-white/95 border-gray-200'
      }`}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar correos..."
                className={`w-80 pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:border-purple-500/50 ${
                  isDark ? 'bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-600' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400'
                }`}
              />
            </div>

            {/* Filtro */}
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{filterLabels[filter]}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                  <div className={`absolute top-full left-0 mt-1 z-50 min-w-[140px] rounded-xl border backdrop-blur-xl shadow-2xl overflow-hidden ${
                    isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-gray-200 bg-white'
                  }`}>
                    {(['all', 'unread', 'read'] as FilterType[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => { setFilter(f); setFilterOpen(false); }}
                        className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                          filter === f
                            ? (isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-700')
                            : (isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700')
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
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refrescar</span>
            </button>

            {/* Stats */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                isDark ? 'bg-purple-500/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'
              }`}>
                <Mail className="h-3 w-3 text-purple-400" />
                <span className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{stats?.no_leidos || 0} sin leer</span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-100 border-gray-200'
              }`}>
                <Inbox className={`h-3 w-3 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
                <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{stats?.total || 0} total</span>
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
          <div className={`rounded-2xl border p-12 text-center ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/30' : 'border-gray-200 bg-gray-50'
          }`}>
            <Inbox className={`h-12 w-12 mx-auto mb-4 ${isDark ? 'text-zinc-700' : 'text-gray-300'}`} />
            <p className={isDark ? 'text-zinc-500' : 'text-gray-500'}>No tienes correos</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Los correos del sistema aparecerán aquí</p>
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-zinc-800/80' : 'border-gray-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'}`}>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-48 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      De
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      Asunto
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-40 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      Fecha
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-24 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-zinc-800/50' : 'divide-gray-100'}`}>
                  {filteredCorreos.map((correo) => (
                    <CorreoRow
                      key={correo.id}
                      correo={correo}
                      isDark={isDark}
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
