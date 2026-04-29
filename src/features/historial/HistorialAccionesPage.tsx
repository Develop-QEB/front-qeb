import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, X, RefreshCw, Clock, Filter, ChevronLeft, ChevronRight,
  StickyNote, Send, History,
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { historialService, type HistorialEntry, type HistorialFilters } from '../../services/historial.service';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { useSocketHistorialAcciones } from '../../hooks/useSocket';

function formatFechaHora(fecha: string): string {
  const d = new Date(fecha);
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function normalizeTipo(raw: string): string {
  if (raw.startsWith('autorizacion_')) return 'Autorización';
  const map: Record<string, string> = {
    'Campaña': 'Campaña',
    'Propuesta': 'Propuesta',
    'Solicitud': 'Solicitud',
    'Inventario': 'Inventario',
    'Nota': 'Nota',
  };
  return map[raw] || raw;
}

function formatSubtipo(raw: string): string | null {
  if (!raw.startsWith('autorizacion_')) return null;
  const sub = raw.replace('autorizacion_', '');
  const map: Record<string, string> = {
    'solicitud_solicitud': 'Solicitud',
    'cambio_campana': 'Cambio Campaña',
    'nueva_cara_campana': 'Nueva Cara',
    'cambio_solicitud': 'Cambio Solicitud',
    'nueva_cara_solicitud': 'Nueva Cara Sol.',
    'solicitud_campana': 'Campaña',
    'aprobacion': 'Aprobación',
    'rechazo': 'Rechazo',
  };
  return map[sub] || sub.charAt(0).toUpperCase() + sub.slice(1).replace(/_/g, ' ');
}

function formatDetalles(detalles: string | null): string {
  if (!detalles) return '-';
  if (!detalles.startsWith('{') && !detalles.startsWith('[')) return detalles;
  try {
    const obj = JSON.parse(detalles);
    const parts: string[] = [];
    if (obj.aprobadoPor) {
      parts.push(`Aprobado por: ${obj.aprobadoPor}`);
      if (obj.tipo) parts.push(`Tipo: ${obj.tipo}`);
      if (obj.carasAprobadas) parts.push(`${obj.carasAprobadas} circuito(s)`);
      return parts.join(' | ');
    }
    if (obj.rechazadoPor) {
      parts.push(`Rechazado por: ${obj.rechazadoPor}`);
      if (obj.tipo) parts.push(`Tipo: ${obj.tipo}`);
      if (obj.motivo) parts.push(`Motivo: ${obj.motivo}`);
      return parts.join(' | ');
    }
    if (obj.usuario) parts.push(obj.usuario);
    if (obj.origen) parts.push(`Origen: ${obj.origen}`);
    if (obj.cambios?.length) {
      for (const c of obj.cambios) {
        parts.push(`${c.label || c.campo}: ${c.antes} → ${c.despues}`);
      }
    }
    if (obj.cara) {
      parts.push(`Artículo: ${obj.cara.articulo}, ${obj.cara.caras} caras`);
    }
    if (obj.caras?.length) {
      const c = obj.caras[0];
      parts.push(`${c.articulo} — ${c.formato} — ${c.caras} caras`);
    }
    if (obj.pendientesDg) parts.push(`Pendientes DG: ${obj.pendientesDg}`);
    if (obj.pendientesDcm) parts.push(`Pendientes DCM: ${obj.pendientesDcm}`);
    return parts.length > 0 ? parts.join(' | ') : detalles;
  } catch {
    return detalles;
  }
}

const tipoColors: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  'Campaña': { bg: 'bg-purple-100', text: 'text-purple-700', darkBg: 'bg-purple-900/30', darkText: 'text-purple-300' },
  'Propuesta': { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'bg-blue-900/30', darkText: 'text-blue-300' },
  'Solicitud': { bg: 'bg-green-100', text: 'text-green-700', darkBg: 'bg-green-900/30', darkText: 'text-green-300' },
  'Inventario': { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'bg-orange-900/30', darkText: 'text-orange-300' },
  'Autorización': { bg: 'bg-red-100', text: 'text-red-700', darkBg: 'bg-red-900/30', darkText: 'text-red-300' },
  'Nota': { bg: 'bg-yellow-100', text: 'text-yellow-700', darkBg: 'bg-yellow-900/30', darkText: 'text-yellow-300' },
};

function TipoBadge({ tipo, isDark }: { tipo: string; isDark: boolean }) {
  const display = normalizeTipo(tipo);
  const subtipo = formatSubtipo(tipo);
  const colors = tipoColors[display] || {
    bg: 'bg-gray-100', text: 'text-gray-700',
    darkBg: 'bg-zinc-700/30', darkText: 'text-zinc-300',
  };

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isDark ? `${colors.darkBg} ${colors.darkText}` : `${colors.bg} ${colors.text}`
      }`}>
        {display}
      </span>
      {subtipo && (
        <span className={`text-[10px] px-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
          {subtipo}
        </span>
      )}
    </div>
  );
}

function NotaModal({
  isOpen,
  onClose,
  onSubmit,
  tipos,
  isDark,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { tipo: string; nota: string; ref_id?: number }) => void;
  tipos: { label: string; value: string }[];
  isDark: boolean;
  isLoading: boolean;
}) {
  const [tipo, setTipo] = useState('Nota');
  const [nota, setNota] = useState('');
  const [refId, setRefId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!nota.trim()) return;
    onSubmit({
      tipo,
      nota: nota.trim(),
      ref_id: refId ? parseInt(refId) : undefined,
    });
    setNota('');
    setRefId('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-xl border shadow-2xl p-6 ${
        isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Agregar nota
          </h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="Nota">Nota</option>
              {tipos.filter(t => t.value !== 'Nota').map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>ID de referencia (opcional)</label>
            <input
              type="number"
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              placeholder="Ej: ID de propuesta o solicitud"
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
              }`}
            />
          </div>

          <div>
            <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Nota</label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
              placeholder="Escribe tu nota aquí..."
              className={`w-full rounded-lg border px-3 py-2 text-sm resize-none ${
                isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
              }`}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!nota.trim() || isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
            {isLoading ? 'Guardando...' : 'Agregar nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function HistorialAccionesPage() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const user = useAuthStore((s) => s.user);
  const permissions = getPermissions(user?.rol);
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<HistorialFilters>({ page: 1, limit: 50 });
  const [searchInput, setSearchInput] = useState('');
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useSocketHistorialAcciones();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['historial-acciones', filters],
    queryFn: () => historialService.getAll(filters),
  });

  const { data: tiposRaw = [] } = useQuery({
    queryKey: ['historial-tipos'],
    queryFn: () => historialService.getTipos(),
  });

  const tiposAgrupados = (() => {
    const seen = new Set<string>();
    const result: { label: string; value: string }[] = [];
    for (const t of tiposRaw) {
      const norm = normalizeTipo(t);
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push({ label: norm, value: t.startsWith('autorizacion_') ? 'autorizacion_' : t });
      }
    }
    return result;
  })();

  const addNotaMutation = useMutation({
    mutationFn: historialService.addNota,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historial-acciones'] });
      setShowNotaModal(false);
    },
  });

  const handleSearch = useCallback(() => {
    setFilters(prev => ({ ...prev, page: 1, search: searchInput || undefined }));
  }, [searchInput]);

  const handleClearSearch = () => {
    setSearchInput('');
    setFilters(prev => ({ ...prev, page: 1, search: undefined }));
  };

  const handleTipoFilter = (tipo: string) => {
    setFilters(prev => ({
      ...prev,
      page: 1,
      tipo: prev.tipo === tipo ? undefined : tipo,
    }));
  };

  const handleDateFilter = (field: 'fechaDesde' | 'fechaHasta', value: string) => {
    setFilters(prev => ({
      ...prev,
      page: 1,
      [field]: value || undefined,
    }));
  };

  const historial = data?.data || [];
  const pagination = data?.pagination;

  const cardBg = isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-gray-200';
  const headerText = isDark ? 'text-white' : 'text-gray-900';
  const subText = isDark ? 'text-zinc-400' : 'text-gray-500';
  const rowHover = isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-50';
  const inputCls = isDark
    ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400';

  return (
    <div className="space-y-6">
      <Header title="Historial de Acciones" />

      {/* Barra de acciones */}
      <div className={`rounded-xl border p-4 ${cardBg}`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${subText}`} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar en acciones o detalles..."
              className={`w-full rounded-lg border pl-9 pr-8 py-2 text-sm ${inputCls}`}
            />
            {searchInput && (
              <button onClick={handleClearSearch} className={`absolute right-3 top-1/2 -translate-y-1/2 ${subText}`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={handleSearch}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors"
          >
            Buscar
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
              showFilters
                ? 'border-purple-500 text-purple-500'
                : isDark ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600' : 'border-gray-300 text-gray-500 hover:border-gray-400'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>

          <button
            onClick={() => setShowNotaModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors"
          >
            <StickyNote className="h-4 w-4" />
            Agregar nota
          </button>

          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['historial-acciones'] })}
            className={`p-2 rounded-lg border transition-colors ${
              isDark ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600' : 'border-gray-300 text-gray-500 hover:border-gray-400'
            }`}
            title="Refrescar"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Panel de filtros expandible */}
        {showFilters && (
          <div className={`mt-4 pt-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Tipo</label>
                <div className="flex flex-wrap gap-1.5">
                  {tiposAgrupados.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => handleTipoFilter(value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        filters.tipo === value
                          ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                          : isDark ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600' : 'border-gray-300 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Desde</label>
                <input
                  type="date"
                  value={filters.fechaDesde || ''}
                  onChange={(e) => handleDateFilter('fechaDesde', e.target.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${inputCls}`}
                />
              </div>

              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Hasta</label>
                <input
                  type="date"
                  value={filters.fechaHasta || ''}
                  onChange={(e) => handleDateFilter('fechaHasta', e.target.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${inputCls}`}
                />
              </div>

              {(filters.tipo || filters.fechaDesde || filters.fechaHasta) && (
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: 1, tipo: undefined, fechaDesde: undefined, fechaHasta: undefined }))}
                  className="text-xs text-purple-500 hover:text-purple-400"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabla de historial */}
      <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
          </div>
        ) : historial.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <History className={`h-12 w-12 ${subText}`} />
            <p className={`text-sm ${subText}`}>No se encontraron registros</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={isDark ? 'bg-zinc-800/50' : 'bg-gray-50'}>
                    <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${subText}`}>Fecha/Hora</th>
                    <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${subText}`}>Tipo</th>
                    <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${subText}`}>Ref ID</th>
                    <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${subText}`}>Acción</th>
                    <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${subText}`}>Detalles</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-gray-100'}`}>
                  {historial.map((entry: HistorialEntry) => (
                    <tr key={entry.id} className={`transition-colors ${rowHover}`}>
                      <td className={`px-4 py-3 text-sm whitespace-nowrap ${subText}`}>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatFechaHora(entry.fecha_hora)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TipoBadge tipo={entry.tipo} isDark={isDark} />
                      </td>
                      <td className={`px-4 py-3 text-sm font-mono ${headerText}`}>
                        {entry.ref_id || '-'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${headerText}`}>
                        {entry.accion}
                      </td>
                      <td className={`px-4 py-3 text-sm max-w-md truncate ${subText}`} title={entry.detalles || ''}>
                        {formatDetalles(entry.detalles)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {pagination && pagination.totalPages > 1 && (
              <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <div className={`text-sm ${subText}`}>
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                    disabled={pagination.page <= 1}
                    className={`p-1.5 rounded-lg border transition-colors disabled:opacity-30 ${
                      isDark ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600' : 'border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className={`text-sm font-medium ${headerText}`}>
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className={`p-1.5 rounded-lg border transition-colors disabled:opacity-30 ${
                      isDark ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600' : 'border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <NotaModal
        isOpen={showNotaModal}
        onClose={() => setShowNotaModal(false)}
        onSubmit={addNotaMutation.mutate}
        tipos={tiposAgrupados}
        isDark={isDark}
        isLoading={addNotaMutation.isPending}
      />
    </div>
  );
}
