import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, X, RefreshCw, Clock, Filter, ChevronLeft, ChevronRight, ChevronDown,
  StickyNote, Send, History, Layers, Download, User, Eye,
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { historialService, type HistorialEntry, type HistorialFilters, type HistorialUsuario } from '../../services/historial.service';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { useSocketHistorialAcciones } from '../../hooks/useSocket';
import { formatHistorialDetalles } from '../../lib/historial';

function formatFechaHora(fecha: string): string {
  const d = new Date(fecha);
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function normalizeTipo(raw: string): string {
  if (raw.startsWith('autorizacion_')) return 'Autorización';
  if (raw === 'Arte' || raw.startsWith('Arte ')) return 'Arte';
  const map: Record<string, string> = {
    'Campaña': 'Campaña', 'Propuesta': 'Propuesta', 'Solicitud': 'Solicitud',
    'Inventario': 'Inventario', 'Nota': 'Nota', 'Tarea': 'Tarea',
  };
  return map[raw] || raw;
}

function formatSubtipo(raw: string): string | null {
  if (!raw.startsWith('autorizacion_')) return null;
  const sub = raw.replace('autorizacion_', '');
  const map: Record<string, string> = {
    'solicitud_solicitud': 'Solicitud', 'cambio_campana': 'Cambio Campaña',
    'nueva_cara_campana': 'Nueva Cara', 'cambio_solicitud': 'Cambio Solicitud',
    'nueva_cara_solicitud': 'Nueva Cara Sol.', 'solicitud_campana': 'Campaña',
    'aprobacion': 'Aprobación', 'rechazo': 'Rechazo',
  };
  return map[sub] || sub.charAt(0).toUpperCase() + sub.slice(1).replace(/_/g, ' ');
}

// Wrapper local: la pagina global espera '-' cuando no hay detalles; el
// modulo compartido devuelve ''. Mantenemos la semantica original.
function formatDetalles(detalles: string | null): string {
  const out = formatHistorialDetalles(detalles);
  return out || '-';
}

const tipoColors: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  'Campaña': { bg: 'bg-purple-100', text: 'text-purple-700', darkBg: 'bg-purple-900/30', darkText: 'text-purple-300' },
  'Propuesta': { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'bg-blue-900/30', darkText: 'text-blue-300' },
  'Solicitud': { bg: 'bg-green-100', text: 'text-green-700', darkBg: 'bg-green-900/30', darkText: 'text-green-300' },
  'Inventario': { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'bg-orange-900/30', darkText: 'text-orange-300' },
  'Autorización': { bg: 'bg-red-100', text: 'text-red-700', darkBg: 'bg-red-900/30', darkText: 'text-red-300' },
  'Nota': { bg: 'bg-yellow-100', text: 'text-yellow-700', darkBg: 'bg-yellow-900/30', darkText: 'text-yellow-300' },
  'Arte': { bg: 'bg-pink-100', text: 'text-pink-700', darkBg: 'bg-pink-900/30', darkText: 'text-pink-300' },
  'Tarea': { bg: 'bg-cyan-100', text: 'text-cyan-700', darkBg: 'bg-cyan-900/30', darkText: 'text-cyan-300' },
};

function TipoBadge({ tipo, isDark }: { tipo: string; isDark: boolean }) {
  const display = normalizeTipo(tipo);
  const subtipo = formatSubtipo(tipo);
  const colors = tipoColors[display] || {
    bg: 'bg-gray-100', text: 'text-gray-700', darkBg: 'bg-zinc-700/30', darkText: 'text-zinc-300',
  };
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isDark ? `${colors.darkBg} ${colors.darkText}` : `${colors.bg} ${colors.text}`
      }`}>{display}</span>
      {subtipo && (
        <span className={`text-[10px] px-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{subtipo}</span>
      )}
    </div>
  );
}

function UserSelect({
  users, value, onChange, isDark,
}: {
  users: HistorialUsuario[]; value: string; onChange: (v: string) => void; isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search
    ? users.filter(u => u.nombre.toLowerCase().includes(search.toLowerCase()))
    : users;

  const inputCls = isDark
    ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setSearch(''); }}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm min-w-[180px] ${inputCls} ${
          value ? '' : isDark ? 'text-zinc-500' : 'text-gray-400'
        }`}
      >
        <User className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate flex-1 text-left">{value || 'Todos los usuarios'}</span>
        {value ? (
          <X className="h-3.5 w-3.5 shrink-0 hover:text-red-400" onClick={(e) => { e.stopPropagation(); onChange(''); }} />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>
      {open && (
        <div className={`absolute top-full left-0 mt-1 w-72 rounded-lg border shadow-xl z-50 overflow-hidden ${
          isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'
        }`}>
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar usuario..."
              className={`w-full rounded-md border px-2.5 py-1.5 text-sm ${inputCls}`}
              autoFocus
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                !value
                  ? 'bg-purple-500/10 text-purple-500 font-medium'
                  : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Todos los usuarios
            </button>
            {filtered.map(u => (
              <button
                key={u.id}
                onClick={() => { onChange(u.nombre); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  value === u.nombre
                    ? 'bg-purple-500/10 text-purple-500 font-medium'
                    : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {u.nombre}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className={`px-3 py-3 text-sm text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                Sin resultados
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotaModal({
  isOpen, onClose, onSubmit, tipos, isDark, isLoading,
}: {
  isOpen: boolean; onClose: () => void;
  onSubmit: (data: { tipo: string; nota: string; ref_id?: number; fecha_entrega?: string; recordar_dias_antes?: number }) => void;
  tipos: { label: string; value: string }[]; isDark: boolean; isLoading: boolean;
}) {
  const [tipo, setTipo] = useState('Nota');
  const [nota, setNota] = useState('');
  const [refId, setRefId] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [activarRecordatorio, setActivarRecordatorio] = useState(false);
  const [diasAntes, setDiasAntes] = useState('1');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!nota.trim()) return;
    onSubmit({
      tipo,
      nota: nota.trim(),
      ref_id: refId ? parseInt(refId) : undefined,
      fecha_entrega: fechaEntrega || undefined,
      recordar_dias_antes: fechaEntrega && activarRecordatorio
        ? Math.max(0, parseInt(diasAntes || '0', 10) || 0)
        : undefined,
    });
    setNota('');
    setRefId('');
    setFechaEntrega('');
    setActivarRecordatorio(false);
    setDiasAntes('1');
  };

  // Fecha minima (hoy) para no permitir programar al pasado
  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-xl border shadow-2xl p-6 ${
        isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Agregar acción</h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
              <option value="Nota">Nota</option>
              {tipos.filter(t => t.value !== 'Nota').map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>ID de referencia (opcional)</label>
            <input type="number" value={refId} onChange={(e) => setRefId(e.target.value)}
              placeholder="Ej: ID de propuesta o solicitud"
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'}`} />
          </div>
          <div>
            <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Descripción</label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3}
              placeholder="Describe la acción..."
              className={`w-full rounded-lg border px-3 py-2 text-sm resize-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'}`} />
          </div>
          <div className={`pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
            <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              Fecha de entrega / actividad (opcional)
            </label>
            <input type="date" value={fechaEntrega} min={minDate} onChange={(e) => setFechaEntrega(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
            <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              Deja vacio si no es una actividad programada a futuro.
            </p>
          </div>
          {fechaEntrega && (
            <div className={`rounded-lg p-3 ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input type="checkbox" checked={activarRecordatorio} onChange={(e) => setActivarRecordatorio(e.target.checked)}
                  className="h-4 w-4 rounded accent-purple-600" />
                <span className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                  Activar recordatorio
                </span>
              </label>
              {activarRecordatorio && (
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Recordar</span>
                  <input type="number" min="0" max="365" value={diasAntes} onChange={(e) => setDiasAntes(e.target.value)}
                    className={`w-16 rounded-lg border px-2 py-1 text-sm text-center ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                  <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    día(s) antes de la fecha de entrega
                  </span>
                </div>
              )}
            </div>
          )}
          <button onClick={handleSubmit} disabled={!nota.trim() || isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <Send className="h-4 w-4" />
            {isLoading ? 'Guardando...' : 'Agregar acción'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface GroupNode {
  key: string;
  entries: HistorialEntry[];
  subGroups?: GroupNode[];
}

export function HistorialAccionesPage() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const user = useAuthStore((s) => s.user);
  const permissions = getPermissions(user?.rol);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'general' | 'admin'>('general');
  const [filters, setFilters] = useState<HistorialFilters>({ page: 1, limit: 50 });
  const [searchInput, setSearchInput] = useState('');
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [groupLevels, setGroupLevels] = useState<('etapa' | 'referencia')[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [detalleModal, setDetalleModal] = useState<HistorialEntry | null>(null);

  // Tab "Acciones Admin" solo visible para usuarios con rol DEV
  const canSeeAdminTab = user?.rol === 'DEV';
  // El filtro auditAdmin viaja al backend cuando la tab admin esta activa
  const effectiveFilters: HistorialFilters = activeTab === 'admin' && canSeeAdminTab
    ? { ...filters, auditAdmin: true }
    : filters;

  useSocketHistorialAcciones();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['historial-acciones', effectiveFilters],
    queryFn: () => historialService.getAll(effectiveFilters),
  });

  const { data: tiposRaw = [] } = useQuery({
    queryKey: ['historial-tipos'],
    queryFn: () => historialService.getTipos(),
  });

  const { data: accionesRaw = [] } = useQuery({
    queryKey: ['historial-acciones-list'],
    queryFn: () => historialService.getAcciones(),
  });

  const { data: usuariosRaw = [] } = useQuery({
    queryKey: ['historial-usuarios'],
    queryFn: () => historialService.getUsuarios(),
  });

  const tiposAgrupados = (() => {
    const seen = new Set<string>();
    const result: { label: string; value: string }[] = [];
    for (const t of tiposRaw) {
      const norm = normalizeTipo(t);
      if (!seen.has(norm)) {
        seen.add(norm);
        let value = t;
        if (t.startsWith('autorizacion_')) value = 'autorizacion_';
        else if (t === 'Arte' || t.startsWith('Arte ')) value = 'Arte*';
        result.push({ label: norm, value });
      }
    }
    // Garantizar que "Tarea" siempre este en el dropdown de "Agregar accion"
    // aunque no haya entradas previas con tipo='Tarea' en historial.
    if (!seen.has('Tarea')) {
      result.push({ label: 'Tarea', value: 'Tarea' });
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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await historialService.getAll({ ...effectiveFilters, page: 1, limit: 10000 });
      const XLSX = await import('xlsx');
      // Excluir tambien en la descarga los registros de "Suplantó identidad".
      const rows = result.data
        .filter(e => {
          const a = e.accion || '';
          return !a.includes('Suplantó identidad') && !a.includes('Suplanto identidad');
        })
        .map(e => ({
        'Fecha/Hora': formatFechaHora(e.fecha_hora),
        'Tipo': normalizeTipo(e.tipo),
        'Ref ID': e.ref_id || '',
        'Acción': e.accion,
        'Detalles': formatDetalles(e.detalles),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 60 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Historial');
      XLSX.writeFile(wb, `historial_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleCollapse = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Ocultar registros de "Suplantó identidad de X" que quedaron en la BD
  // antes del fix del back (2026-07-15). No tocamos main DB — filtramos en
  // front para que ese evento nunca sea visible en el screen de Historial.
  const historial = (data?.data || []).filter(entry => {
    const accion = entry.accion || '';
    return !accion.includes('Suplantó identidad') && !accion.includes('Suplanto identidad');
  });
  const pagination = data?.pagination;

  const groupNodes = groupLevels.length > 0 ? (() => {
    function build(entries: HistorialEntry[], levels: ('etapa' | 'referencia')[]): GroupNode[] {
      if (levels.length === 0) return [];
      const [level, ...rest] = levels;
      const map: Record<string, HistorialEntry[]> = {};
      const order: string[] = [];
      for (const entry of entries) {
        const key = level === 'referencia'
          ? `${normalizeTipo(entry.tipo)} #${entry.ref_id}`
          : normalizeTipo(entry.tipo);
        if (!map[key]) { map[key] = []; order.push(key); }
        map[key].push(entry);
      }
      return order.map(k => ({
        key: k,
        entries: map[k],
        subGroups: rest.length > 0 ? build(map[k], rest) : undefined,
      }));
    }
    return build(historial, groupLevels);
  })() : null;

  const renderGroupNodes = (nodes: GroupNode[], prefix = ''): React.JSX.Element[] =>
    nodes.flatMap(node => {
      const fullKey = prefix ? `${prefix}>${node.key}` : node.key;
      const depth = prefix ? prefix.split('>').length : 0;
      const isCollapsed = collapsedGroups.has(fullKey);
      const bgColor = depth === 0
        ? (isDark ? 'bg-purple-900/20 hover:bg-purple-900/30' : 'bg-purple-50 hover:bg-purple-100/80')
        : (isDark ? 'bg-indigo-900/15 hover:bg-indigo-900/25' : 'bg-indigo-50/70 hover:bg-indigo-100/60');
      return [
        <tr
          key={`g-${fullKey}`}
          className={`cursor-pointer select-none transition-colors ${bgColor}`}
          onClick={() => toggleCollapse(fullKey)}
        >
          <td colSpan={5} className={`py-2.5 text-sm font-semibold ${headerText}`}
            style={{ paddingLeft: `${20 + depth * 24}px` }}>
            <div className="flex items-center gap-2">
              <ChevronDown className={`h-4 w-4 text-purple-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              <Layers className="h-3.5 w-3.5 text-purple-500" />
              {node.key}
              <span className={`font-normal text-xs ${subText}`}>({node.entries.length})</span>
            </div>
          </td>
        </tr>,
        ...(!isCollapsed
          ? node.subGroups
            ? renderGroupNodes(node.subGroups, fullKey)
            : node.entries.map(renderRow)
          : []),
      ];
    });

  const hasActiveFilters = !!(filters.tipo || filters.accion || filters.usuario || filters.fechaDesde || filters.fechaHasta || groupLevels.length > 0);

  const clearAllFilters = () => {
    setSearchInput('');
    setFilters({ page: 1, limit: 50 });
    setGroupLevels([]);
    setCollapsedGroups(new Set());
  };

  const cardBg = isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-gray-200';
  const headerText = isDark ? 'text-white' : 'text-gray-900';
  const subText = isDark ? 'text-zinc-400' : 'text-gray-500';
  const rowHover = isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-50';
  const inputCls = isDark
    ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400';
  const btnSecondary = isDark
    ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
    : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600';

  const renderRow = (entry: HistorialEntry) => (
    <tr key={entry.id} className={`transition-colors ${rowHover}`}>
      <td className={`px-5 py-3 text-sm whitespace-nowrap ${subText}`}>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {formatFechaHora(entry.fecha_hora)}
        </div>
      </td>
      <td className="px-5 py-3"><TipoBadge tipo={entry.tipo} isDark={isDark} /></td>
      <td className={`px-5 py-3 text-sm font-mono ${headerText}`}>{entry.ref_id || '-'}</td>
      <td className={`px-5 py-3 text-sm ${headerText}`}>{entry.accion}</td>
      <td className="px-5 py-3 text-center">
        {entry.detalles ? (
          <button onClick={() => setDetalleModal(entry)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-white' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'}`} title="Ver detalle">
            <Eye className="h-4 w-4" />
          </button>
        ) : <span className={subText}>-</span>}
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen">
      <Header title="Historial de Acciones" />

      {/* Tabs — la pestaña "Acciones Admin" solo es visible para rol DEV */}
      {canSeeAdminTab && (
        <div className={`px-6 pt-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? isDark ? 'border-purple-500 text-white' : 'border-purple-600 text-gray-900'
                  : isDark ? 'border-transparent text-zinc-400 hover:text-zinc-200' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? isDark ? 'border-purple-500 text-white' : 'border-purple-600 text-gray-900'
                  : isDark ? 'border-transparent text-zinc-400 hover:text-zinc-200' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              title="Solo visible para rol DEV"
            >
              Acciones Admin
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>DEV</span>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4 p-6">
      {/* Barra de filtros */}
      <div className={`rounded-xl border ${cardBg}`}>
        {/* Fila principal */}
        <div className="p-4 flex flex-wrap items-center gap-2.5">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${subText}`} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por acción, detalle o cliente..."
              className={`w-full rounded-lg border pl-9 pr-8 py-2 text-sm ${inputCls}`}
            />
            {searchInput && (
              <button onClick={handleClearSearch} className={`absolute right-3 top-1/2 -translate-y-1/2 ${subText}`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button onClick={handleSearch}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors">
            Buscar
          </button>

          {/* Usuario */}
          <UserSelect
            users={usuariosRaw}
            value={filters.usuario || ''}
            onChange={(v) => setFilters(prev => ({ ...prev, page: 1, usuario: v || undefined }))}
            isDark={isDark}
          />

          {/* Etapa */}
          <select
            value={filters.tipo || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, page: 1, tipo: e.target.value || undefined }))}
            className={`rounded-lg border px-3 py-2 text-sm min-w-[150px] ${inputCls}`}
          >
            <option value="">Todas las etapas</option>
            {tiposAgrupados.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <div className={`w-px h-8 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />

          {/* Acciones */}
          <button onClick={() => setShowNotaModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors">
            <StickyNote className="h-4 w-4" />
            Agregar acción
          </button>

          <button onClick={handleExport} disabled={isExporting}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${btnSecondary} disabled:opacity-50`}
            title="Descargar Excel">
            <Download className={`h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} />
            Excel
          </button>

          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['historial-acciones'] })}
            className={`p-2 rounded-lg border transition-colors ${btnSecondary}`} title="Refrescar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
              showMoreFilters || hasActiveFilters
                ? 'border-purple-500 text-purple-500'
                : btnSecondary
            }`}
          >
            <Filter className="h-4 w-4" />
            {hasActiveFilters && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] font-bold">
              {[filters.accion, filters.fechaDesde, filters.fechaHasta].filter(Boolean).length + groupLevels.length}
            </span>}
          </button>
        </div>

        {/* Fila secundaria — más filtros */}
        {showMoreFilters && (
          <div className={`px-4 pb-4 pt-0`}>
            <div className={`flex flex-wrap items-end gap-3 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Desde</label>
                <input type="date" value={filters.fechaDesde || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, page: 1, fechaDesde: e.target.value || undefined }))}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${inputCls}`} />
              </div>

              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Hasta</label>
                <input type="date" value={filters.fechaHasta || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, page: 1, fechaHasta: e.target.value || undefined }))}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${inputCls}`} />
              </div>

              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Acción</label>
                <select value={filters.accion || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, page: 1, accion: e.target.value || undefined }))}
                  className={`rounded-lg border px-3 py-1.5 text-sm min-w-[140px] ${inputCls}`}>
                  <option value="">Todas</option>
                  {accionesRaw.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>

              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Agrupar por</label>
                <div className="flex gap-1.5">
                  {(['etapa', 'referencia'] as const).map(level => {
                    const idx = groupLevels.indexOf(level);
                    const active = idx !== -1;
                    return (
                      <button
                        key={level}
                        onClick={() => {
                          setGroupLevels(prev => active ? prev.filter(l => l !== level) : [...prev, level]);
                          setCollapsedGroups(new Set());
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          active
                            ? 'border-purple-500 bg-purple-500/10 text-purple-500 font-medium'
                            : btnSecondary
                        }`}
                      >
                        {active && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] font-bold">
                            {idx + 1}
                          </span>
                        )}
                        {level === 'etapa' ? 'Etapa' : 'Referencia'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {hasActiveFilters && (
                <button onClick={clearAllFilters}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-500 hover:text-purple-400 border border-purple-500/30 hover:border-purple-500/50 transition-colors">
                  Limpiar todo
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabla */}
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
                  <tr className={isDark ? 'bg-zinc-800/70' : 'bg-gray-50'}>
                    <th className={`text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider ${subText}`}>Fecha/Hora</th>
                    <th className={`text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider ${subText}`}>Tipo</th>
                    <th className={`text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider ${subText}`}>Ref ID</th>
                    <th className={`text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider ${subText}`}>Acción</th>
                    <th className={`text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider ${subText}`}>Detalles</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-zinc-800/60' : 'divide-gray-100'}`}>
                  {groupNodes
                    ? renderGroupNodes(groupNodes)
                    : historial.map(renderRow)}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {pagination && pagination.totalPages > 1 && (
              <div className={`flex items-center justify-between px-5 py-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <div className={`text-sm ${subText}`}>
                  {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                    disabled={pagination.page <= 1}
                    className={`p-1.5 rounded-lg border transition-colors disabled:opacity-30 ${btnSecondary}`}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className={`text-sm font-medium ${headerText}`}>{pagination.page} / {pagination.totalPages}</span>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className={`p-1.5 rounded-lg border transition-colors disabled:opacity-30 ${btnSecondary}`}>
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

      {detalleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetalleModal(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className={`relative w-full max-w-2xl max-h-[80vh] overflow-auto rounded-2xl border ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'} shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className={`sticky top-0 flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-gray-200 bg-white'}`}>
              <div>
                <h3 className={`text-lg font-semibold ${headerText}`}>Detalle de Acción</h3>
                <p className={`text-xs mt-0.5 ${subText}`}>{formatFechaHora(detalleModal.fecha_hora)} · {normalizeTipo(detalleModal.tipo)} · #{detalleModal.ref_id || '-'}</p>
              </div>
              <button onClick={() => setDetalleModal(null)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <span className={`text-xs font-medium ${subText}`}>Acción</span>
                <p className={`text-sm mt-1 ${headerText}`}>{detalleModal.accion}</p>
              </div>
              {(() => {
                const raw = detalleModal.detalles;
                if (!raw) return <p className={`text-sm ${subText}`}>Sin detalles</p>;
                if (!raw.startsWith('{') && !raw.startsWith('[')) return <p className={`text-sm ${headerText}`}>{raw}</p>;
                try {
                  const obj = JSON.parse(raw);
                  return (
                    <>
                      {obj.usuario && (
                        <div>
                          <span className={`text-xs font-medium ${subText}`}>Usuario</span>
                          <p className={`text-sm mt-1 ${headerText}`}>{obj.usuario}</p>
                        </div>
                      )}
                      {obj.origen && (
                        <div>
                          <span className={`text-xs font-medium ${subText}`}>Origen</span>
                          <p className={`text-sm mt-1 ${headerText}`}>{obj.origen}</p>
                        </div>
                      )}
                      {obj.aprobadoPor && (
                        <div>
                          <span className={`text-xs font-medium ${subText}`}>Aprobado por</span>
                          <p className={`text-sm mt-1 ${headerText}`}>{obj.aprobadoPor}{obj.tipo ? ` · Tipo: ${obj.tipo}` : ''}{obj.carasAprobadas ? ` · ${obj.carasAprobadas} circuito(s)` : ''}</p>
                        </div>
                      )}
                      {obj.rechazadoPor && (
                        <div>
                          <span className={`text-xs font-medium ${subText}`}>Rechazado por</span>
                          <p className={`text-sm mt-1 ${headerText}`}>{obj.rechazadoPor}{obj.motivo ? ` · Motivo: ${obj.motivo}` : ''}</p>
                        </div>
                      )}
                      {obj.cambios?.length > 0 && (
                        <div>
                          <span className={`text-xs font-medium ${subText}`}>Cambios ({obj.cambios.length})</span>
                          <table className={`w-full mt-2 text-sm border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg overflow-hidden`}>
                            <thead>
                              <tr className={isDark ? 'bg-zinc-800' : 'bg-gray-50'}>
                                <th className={`px-3 py-2 text-left text-xs font-medium ${subText}`}>Campo</th>
                                <th className={`px-3 py-2 text-left text-xs font-medium ${subText}`}>Antes</th>
                                <th className={`px-3 py-2 text-left text-xs font-medium ${subText}`}>Después</th>
                              </tr>
                            </thead>
                            <tbody>
                              {obj.cambios.map((c: any, i: number) => (
                                <tr key={i} className={`border-t ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
                                  <td className={`px-3 py-2 font-medium ${headerText}`}>{c.label || c.campo}</td>
                                  <td className="px-3 py-2 text-red-400">{c.antes ?? '-'}</td>
                                  <td className="px-3 py-2 text-emerald-400">{c.despues ?? '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {obj.cara && (() => {
                        const isPP = (obj.cara.formato || '').toUpperCase().includes('PUENTE PEATONAL');
                        const cap = isPP ? 'Puente' : 'Cara';
                        const noun = isPP ? 'puentes' : 'caras';
                        return (
                          <div>
                            <span className={`text-xs font-medium ${subText}`}>{cap}</span>
                            <p className={`text-sm mt-1 ${headerText}`}>Artículo: {obj.cara.articulo} · {obj.cara.caras} {noun}</p>
                          </div>
                        );
                      })()}
                      {obj.caras?.length > 0 && (() => {
                        const allPP = obj.caras.every((c: any) => (c.formato || '').toUpperCase().includes('PUENTE PEATONAL'));
                        const groupLabel = allPP ? 'Puentes' : 'Caras';
                        return (
                          <div>
                            <span className={`text-xs font-medium ${subText}`}>{groupLabel} ({obj.caras.length})</span>
                            <div className="mt-1 space-y-1">
                              {obj.caras.map((c: any, i: number) => {
                                const isPP = (c.formato || '').toUpperCase().includes('PUENTE PEATONAL');
                                const noun = isPP ? 'puentes' : 'caras';
                                return (
                                  <p key={i} className={`text-sm ${headerText}`}>{c.articulo} — {c.formato} — {c.caras} {noun}</p>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                      {obj.campaña && (
                        <div>
                          <span className={`text-xs font-medium ${subText}`}>Campaña</span>
                          <p className={`text-sm mt-1 ${headerText}`}>{obj.campaña}</p>
                        </div>
                      )}
                      {obj.motivo && (
                        <div>
                          <span className={`text-xs font-medium ${subText}`}>Motivo</span>
                          <p className={`text-sm mt-1 ${headerText}`}>{obj.motivo}</p>
                        </div>
                      )}
                      {obj.reservas_eliminadas != null && (
                        <div>
                          <span className={`text-xs font-medium ${subText}`}>Reservas eliminadas</span>
                          <p className={`text-sm mt-1 text-red-400 font-medium`}>{obj.reservas_eliminadas}</p>
                        </div>
                      )}
                      {obj.circuitos_eliminados != null && (
                        <div>
                          <span className={`text-xs font-medium ${subText}`}>Circuitos eliminados</span>
                          <p className={`text-sm mt-1 text-red-400 font-medium`}>{obj.circuitos_eliminados}</p>
                        </div>
                      )}
                      {obj.circuitos?.length > 0 && !obj.cambios && (
                        <div>
                          <span className={`text-xs font-medium ${subText}`}>Circuitos afectados ({obj.circuitos.length})</span>
                          <div className="mt-1 space-y-1">
                            {obj.circuitos.map((c: any, i: number) => (
                              <p key={i} className={`text-sm ${headerText}`}>{c.articulo || '-'} — {c.formato || '-'}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {obj.pendientesDg && <p className={`text-sm ${subText}`}>Pendientes DG: {obj.pendientesDg}</p>}
                      {obj.pendientesDcm && <p className={`text-sm ${subText}`}>Pendientes DCM: {obj.pendientesDcm}</p>}
                    </>
                  );
                } catch {
                  return <p className={`text-sm ${headerText}`}>{raw}</p>;
                }
              })()}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
