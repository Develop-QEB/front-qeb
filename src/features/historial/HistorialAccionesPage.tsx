import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, X, RefreshCw, Clock, Filter, ChevronLeft, ChevronRight, ChevronDown,
  StickyNote, Send, History, Layers, Download, User, Eye, Briefcase, Activity, Code,
  GitBranch, Info,
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { historialService, type HistorialEntry, type HistorialFilters } from '../../services/historial.service';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { useSocketHistorialAcciones } from '../../hooks/useSocket';
import { formatHistorialDetalles, formatValue, isPlainObject } from '../../lib/historial';
import { ActividadComercialBoard } from './ActividadComercialBoard';
import { FiltroMultiple } from './FiltroMultiple';

function formatFechaHora(fecha: string): string {
  const d = new Date(fecha);
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// Wrapper local: la pagina global espera '-' cuando no hay detalles; el
// modulo compartido devuelve ''. Mantenemos la semantica original.
function formatDetalles(detalles: string | null): string {
  const out = formatHistorialDetalles(detalles);
  return out || '-';
}

// Color por GRUPO de modulo (no por modulo suelto): son ~20 modulos en 8
// grupos, y pintar cada uno distinto seria ruido. El grupo viene del back
// junto con la opcion (ver utils/historialTaxonomia.ts).
const grupoColors: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  'Flujo comercial': { bg: 'bg-purple-100', text: 'text-purple-700', darkBg: 'bg-purple-900/30', darkText: 'text-purple-300' },
  'Inventario y espacios': { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'bg-orange-900/30', darkText: 'text-orange-300' },
  'Artes y producción': { bg: 'bg-pink-100', text: 'text-pink-700', darkBg: 'bg-pink-900/30', darkText: 'text-pink-300' },
  'Operaciones SAP': { bg: 'bg-amber-100', text: 'text-amber-700', darkBg: 'bg-amber-900/30', darkText: 'text-amber-300' },
  'Mapa': { bg: 'bg-teal-100', text: 'text-teal-700', darkBg: 'bg-teal-900/30', darkText: 'text-teal-300' },
  'CRM y soporte': { bg: 'bg-green-100', text: 'text-green-700', darkBg: 'bg-green-900/30', darkText: 'text-green-300' },
  'Administración': { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'bg-blue-900/30', darkText: 'text-blue-300' },
};
const grupoNeutro = { bg: 'bg-gray-100', text: 'text-gray-700', darkBg: 'bg-zinc-700/30', darkText: 'text-zinc-300' };

/** Mapa value -> {label, grupo} para resolver los badges de cada fila. */
type Taxonomia = Map<string, { label: string; grupo: string }>;

function ClasificacionBadge({
  modulo, categoria, modulos, categorias, isDark,
}: {
  modulo: string; categoria: string; modulos: Taxonomia; categorias: Taxonomia; isDark: boolean;
}) {
  const m = modulos.get(modulo);
  const colors = grupoColors[m?.grupo ?? ''] ?? grupoNeutro;
  const catLabel = categorias.get(categoria)?.label;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isDark ? `${colors.darkBg} ${colors.darkText}` : `${colors.bg} ${colors.text}`
      }`}>{m?.label ?? modulo}</span>
      {catLabel && catLabel !== 'Otro' && (
        <span className={`text-[10px] px-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{catLabel}</span>
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

// Claves de `detalles` que el modal pinta en secciones dedicadas. Todo lo que
// NO este aqui cae en el bloque "Más datos" — el back escribe ~75 claves
// distintas y antes solo se mostraban estas, el resto se perdia en silencio.
const CLAVES_CON_SECCION = new Set([
  'usuario', 'usuarioId', 'usuarioRol', 'origen', 'accion',
  'aprobadoPor', 'rechazadoPor', 'tipo', 'carasAprobadas', 'motivo',
  'cambios', 'cara', 'caras', 'campaña', 'articulo',
  'reservas_eliminadas', 'circuitos_eliminados', 'circuitos',
  'pendientesDg', 'pendientesDcm',
]);

/** Par etiqueta/valor del modal de detalle. Vive fuera del render para que
 *  React no lo trate como un componente nuevo (y remonte) en cada render. */
function CampoDetalle({ label, isDark, children }: { label: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <div>
      <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{label}</span>
      <div className={`text-sm mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</div>
    </div>
  );
}

/** 'reservas_liberadas' -> 'Reservas liberadas'; 'nombreArte' -> 'Nombre Arte'. */
function humanizarClave(k: string): string {
  const t = k.replace(/_/g, ' ').replace(/([a-z0-9])([A-ZÁÉÍÓÚÑ])/g, '$1 $2').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Pinta cualquier valor del JSON de `detalles` sin conocer su forma:
 * arrays de objetos como tabla, objetos como pares anidados, el resto como
 * texto. Se corta a los 2 niveles para que un JSON hondo no reviente el modal.
 */
function ValorGenerico({ valor, isDark, nivel = 0 }: { valor: unknown; isDark: boolean; nivel?: number }) {
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';
  const txt = isDark ? 'text-zinc-200' : 'text-gray-800';
  const borde = isDark ? 'border-zinc-700' : 'border-gray-200';

  if (valor === null || valor === undefined || valor === '') return <span className={sub}>—</span>;
  if (typeof valor === 'boolean') return <span className={txt}>{valor ? 'Sí' : 'No'}</span>;

  if (Array.isArray(valor)) {
    if (valor.length === 0) return <span className={sub}>—</span>;
    const objetos = valor.filter(isPlainObject);
    // Array homogeneo de objetos -> tabla (ej. caras_eliminadas, reservas).
    if (objetos.length === valor.length && nivel < 2) {
      const cols = Array.from(new Set(objetos.flatMap(o => Object.keys(o)))).slice(0, 8);
      return (
        <div className={`overflow-x-auto rounded-lg border ${borde} mt-1`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-zinc-800' : 'bg-gray-50'}>
                {cols.map(c => (
                  <th key={c} className={`px-2 py-1.5 text-left font-medium ${sub}`}>{humanizarClave(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {objetos.slice(0, 50).map((o, i) => (
                <tr key={i} className={`border-t ${borde}`}>
                  {cols.map(c => (
                    <td key={c} className={`px-2 py-1.5 ${txt}`}>{formatValue(o[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {objetos.length > 50 && (
            <div className={`px-2 py-1 text-[10px] ${sub}`}>+{objetos.length - 50} más</div>
          )}
        </div>
      );
    }
    return <span className={txt}>{valor.map(formatValue).join(', ')}</span>;
  }

  if (isPlainObject(valor)) {
    if (nivel >= 2) return <span className={txt}>{JSON.stringify(valor)}</span>;
    return (
      <div className={`space-y-0.5 pl-3 border-l ${borde}`}>
        {Object.entries(valor).map(([k, v]) => (
          <div key={k} className="flex flex-wrap gap-x-2 text-sm">
            <span className={`${sub} shrink-0`}>{humanizarClave(k)}:</span>
            <ValorGenerico valor={v} isDark={isDark} nivel={nivel + 1} />
          </div>
        ))}
      </div>
    );
  }

  return <span className={txt}>{formatValue(valor)}</span>;
}

// Expedientes validos para una nota manual. Son valores de `historial.tipo`,
// NO modulos de la taxonomia: el modulo se deriva despues de tipo+accion.
const TIPOS_NOTA: { label: string; value: string }[] = [
  { label: 'Nota', value: 'Nota' },
  { label: 'Campaña', value: 'Campaña' },
  { label: 'Propuesta', value: 'Propuesta' },
  { label: 'Solicitud', value: 'Solicitud' },
  { label: 'Tarea', value: 'Tarea' },
  { label: 'Inventario', value: 'Inventario' },
];

/** Niveles por los que se puede agrupar la tabla, uno por eje de la taxonomia. */
type NivelAgrupacion = 'etapa' | 'modulo' | 'referencia';

const NIVEL_LABEL: Record<NivelAgrupacion, string> = {
  etapa: 'Etapa',
  modulo: 'Módulo',
  referencia: 'Referencia',
};

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

  const [activeTab, setActiveTab] = useState<'general' | 'actividad' | 'admin'>('general');
  const [filters, setFilters] = useState<HistorialFilters>({ page: 1, limit: 50 });
  const [searchInput, setSearchInput] = useState('');
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [groupLevels, setGroupLevels] = useState<NivelAgrupacion[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [detalleModal, setDetalleModal] = useState<HistorialEntry | null>(null);
  const [verJson, setVerJson] = useState(false); // toggle del JSON crudo (solo DEV)

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

  // Listas de clasificacion: el back las sirve desde codigo, no cambian
  // durante la sesion, asi que no vale la pena revalidarlas.
  const { data: etapasRaw = [] } = useQuery({
    queryKey: ['historial-etapas'],
    queryFn: () => historialService.getEtapas(),
    staleTime: Infinity,
  });

  const { data: modulosRaw = [] } = useQuery({
    queryKey: ['historial-modulos'],
    queryFn: () => historialService.getModulos(),
    staleTime: Infinity,
  });

  const { data: categoriasRaw = [] } = useQuery({
    queryKey: ['historial-categorias'],
    queryFn: () => historialService.getCategorias(),
    staleTime: Infinity,
  });

  const etapasMap: Taxonomia = new Map(etapasRaw.map(o => [o.value, { label: o.label, grupo: o.grupo }]));
  const modulosMap: Taxonomia = new Map(modulosRaw.map(o => [o.value, { label: o.label, grupo: o.grupo }]));
  const categoriasMap: Taxonomia = new Map(categoriasRaw.map(o => [o.value, { label: o.label, grupo: o.grupo }]));

  const { data: usuariosRaw = [] } = useQuery({
    queryKey: ['historial-usuarios'],
    queryFn: () => historialService.getUsuarios(),
  });

  // El filtro de usuario del back es por nombre (LIKE sobre detalles/accion),
  // no por id; dedupe por si hay nombres repetidos.
  const opcionesUsuarios = Array.from(new Set(usuariosRaw.map(u => u.nombre).filter(Boolean)));

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
        'Etapa': etapasMap.get(e.etapa)?.label ?? '',
        'Módulo': modulosMap.get(e.modulo)?.label ?? e.modulo,
        'Tipo de acción': categoriasMap.get(e.categoria)?.label ?? e.categoria,
        'Expediente': e.tipo,
        'Ref ID': e.ref_id || '',
        'Acción': e.accion,
        'Detalles': formatDetalles(e.detalles),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 40 }, { wch: 60 }];
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
  // El back decide quien ve todo (utils/permissions.ts). Si recorto la vista,
  // se le dice al usuario en vez de dejarlo creer que el historial esta vacio.
  const vistaRecortada = data?.visibilidad?.verTodo === false;

  const groupNodes = groupLevels.length > 0 ? (() => {
    function build(entries: HistorialEntry[], levels: NivelAgrupacion[]): GroupNode[] {
      if (levels.length === 0) return [];
      const [level, ...rest] = levels;
      const map: Record<string, HistorialEntry[]> = {};
      const order: string[] = [];
      for (const entry of entries) {
        const modulo = modulosMap.get(entry.modulo)?.label ?? entry.modulo;
        const key = level === 'etapa'
          ? (etapasMap.get(entry.etapa)?.label ?? 'Fuera del flujo')
          : level === 'referencia'
            ? `${modulo} #${entry.ref_id}`
            : modulo;
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

  // Filtros que viven en la fila secundaria (detras del boton de embudo):
  // acción, rango de fechas y agrupamiento. Usuario y etapa estan a la vista
  // y ya traen su propio contador en el chip.
  const filtrosSecundarios = (filters.categoria?.length ?? 0)
    + [filters.fechaDesde, filters.fechaHasta].filter(Boolean).length
    + groupLevels.length;

  const hasActiveFilters = !!(
    filters.etapa?.length || filters.modulo?.length || filters.usuario?.length
    || filtrosSecundarios > 0
  );

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
      <td className="px-5 py-3">
        <ClasificacionBadge
          modulo={entry.modulo} categoria={entry.categoria}
          modulos={modulosMap} categorias={categoriasMap} isDark={isDark}
        />
      </td>
      <td className={`px-5 py-3 text-sm font-mono ${headerText}`}>{entry.ref_id || '-'}</td>
      <td className={`px-5 py-3 text-sm ${headerText}`}>{entry.accion}</td>
      <td className="px-5 py-3 text-center">
        {entry.detalles ? (
          <button onClick={() => { setVerJson(false); setDetalleModal(entry); }} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-white' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'}`} title="Ver detalle">
            <Eye className="h-4 w-4" />
          </button>
        ) : <span className={subText}>-</span>}
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen">
      <Header title="Historial de Acciones" />

      {/* Tabs — "Actividad Comercial" (tablero CRM) para todos los que ven la
          pagina; "Acciones Admin" solo para rol DEV */}
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
              onClick={() => setActiveTab('actividad')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'actividad'
                  ? isDark ? 'border-amber-500 text-white' : 'border-amber-500 text-gray-900'
                  : isDark ? 'border-transparent text-zinc-400 hover:text-zinc-200' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              title="Tablero de actividades comerciales por estatus"
            >
              <Briefcase className="h-3.5 w-3.5 text-amber-500" />
              Actividad Comercial
            </button>
            {canSeeAdminTab && (
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
            )}
          </div>
      </div>

      {activeTab === 'actividad' ? (
        <div className="p-6">
          <ActividadComercialBoard isDark={isDark} />
        </div>
      ) : (
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
          <FiltroMultiple
            label="Todos los usuarios"
            icon={User}
            options={opcionesUsuarios}
            selected={filters.usuario ?? []}
            onChange={(v) => setFilters(prev => ({ ...prev, page: 1, usuario: v.length ? v : undefined }))}
            isDark={isDark}
            placeholder="Buscar usuario..."
            commitOnClose
            className="min-w-[180px]"
          />

          {/* Etapa — DONDE en el flujo comercial. Solo son tres:
              Solicitud -> Propuesta -> Campaña. */}
          <FiltroMultiple
            label="Todas las etapas"
            icon={GitBranch}
            options={etapasRaw}
            selected={filters.etapa ?? []}
            onChange={(v) => setFilters(prev => ({ ...prev, page: 1, etapa: v.length ? v : undefined }))}
            isDark={isDark}
            placeholder="Buscar etapa..."
            commitOnClose
            className="min-w-[160px]"
          />

          {/* Modulo — sobre QUE se actuo. Lo que antes se llamaba "Etapa" y
              mezclaba las etapas del flujo con entidades de otros modulos. */}
          <FiltroMultiple
            label="Todos los módulos"
            icon={Layers}
            options={modulosRaw}
            selected={filters.modulo ?? []}
            onChange={(v) => setFilters(prev => ({ ...prev, page: 1, modulo: v.length ? v : undefined }))}
            isDark={isDark}
            placeholder="Buscar módulo..."
            commitOnClose
            className="min-w-[170px]"
          />

          <div className={`w-px h-8 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />

          {/* Nota: el botón "Agregar acción" se movió a Notificaciones y Tareas
              como "Actividad Comercial" (tarea manual del asesor). */}

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
            {/* Cuenta solo lo que vive en esta fila secundaria (usuario y etapa
                ya muestran su propio contador). Sin badge si es 0. */}
            {filtrosSecundarios > 0 && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] font-bold">
              {filtrosSecundarios}
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
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Tipo de acción</label>
                <FiltroMultiple
                  label="Todas"
                  icon={Activity}
                  options={categoriasRaw}
                  selected={filters.categoria ?? []}
                  onChange={(v) => setFilters(prev => ({ ...prev, page: 1, categoria: v.length ? v : undefined }))}
                  isDark={isDark}
                  placeholder="Buscar tipo de acción..."
                  commitOnClose
                  className="min-w-[200px]"
                />
              </div>

              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Agrupar por</label>
                <div className="flex gap-1.5">
                  {(['etapa', 'modulo', 'referencia'] as const).map(level => {
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
                        {NIVEL_LABEL[level]}
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

      {vistaRecortada && (
        <div className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm ${
          isDark ? 'border-zinc-800 bg-zinc-900/50 text-zinc-400' : 'border-gray-200 bg-gray-50 text-gray-500'
        }`}>
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-purple-500" />
          <span>
            Estás viendo solo los registros que hiciste y los de las solicitudes,
            propuestas y campañas en las que participas.
          </span>
        </div>
      )}

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
                    <th className={`text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider ${subText}`}>Módulo</th>
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
        tipos={TIPOS_NOTA}
        isDark={isDark}
        isLoading={addNotaMutation.isPending}
      />

      {detalleModal && (() => {
        const raw = detalleModal.detalles;
        const esJson = !!raw && (raw.trimStart().startsWith('{') || raw.trimStart().startsWith('['));
        let obj: Record<string, unknown> | null = null;
        if (esJson) {
          try {
            const parsed = JSON.parse(raw as string);
            obj = isPlainObject(parsed) ? parsed : null;
          } catch { obj = null; }
        }
        // Todo lo que no tiene seccion propia. Se calcula por RESTA, asi que
        // cualquier clave que el back agregue en el futuro aparece sola en
        // vez de perderse en silencio.
        const extras = obj
          ? Object.entries(obj).filter(([k, v]) =>
              !CLAVES_CON_SECCION.has(k) && v !== null && v !== undefined && v !== '')
          : [];
        const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
          <CampoDetalle label={label} isDark={isDark}>{children}</CampoDetalle>
        );

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetalleModal(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className={`relative w-full max-w-3xl max-h-[85vh] overflow-auto rounded-2xl border ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'} shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className={`sticky top-0 z-10 flex items-start justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-gray-200 bg-white'}`}>
              <div className="min-w-0">
                <h3 className={`text-lg font-semibold ${headerText}`}>Detalle de Acción</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  <span className={`text-xs ${subText}`}>{formatFechaHora(detalleModal.fecha_hora)}</span>
                  <ClasificacionBadge
                    modulo={detalleModal.modulo} categoria={detalleModal.categoria}
                    modulos={modulosMap} categorias={categoriasMap} isDark={isDark}
                  />
                  <span className={`text-xs ${subText}`}>
                    {detalleModal.tipo}{detalleModal.ref_id ? ` #${detalleModal.ref_id}` : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canSeeAdminTab && raw && (
                  <button
                    onClick={() => setVerJson(v => !v)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border transition-colors ${
                      verJson ? 'border-purple-500 text-purple-500' : btnSecondary
                    }`}
                    title="Ver el JSON crudo del registro"
                  >
                    <Code className="h-3.5 w-3.5" />JSON
                  </button>
                )}
                <button onClick={() => setDetalleModal(null)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}><X className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              <Campo label="Acción">{detalleModal.accion}</Campo>

              {verJson && (
                <pre className={`text-[11px] p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all ${isDark ? 'bg-zinc-950 text-zinc-300' : 'bg-gray-50 text-gray-700'}`}>
                  {(() => { try { return JSON.stringify(JSON.parse(raw as string), null, 2); } catch { return raw; } })()}
                </pre>
              )}

              {/* Detalles en texto plano: addNota y registros anteriores al JSON. */}
              {!obj && raw && <Campo label="Detalles">{raw}</Campo>}
              {!raw && <p className={`text-sm ${subText}`}>Sin detalles</p>}

              {obj && (
                <>
                  {(!!obj.usuario || !!obj.usuarioRol || !!obj.origen) && (
                    <div className={`flex flex-wrap gap-6 p-3 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'}`}>
                      {!!obj.usuario && <Campo label="Usuario">{formatValue(obj.usuario)}</Campo>}
                      {!!obj.usuarioRol && <Campo label="Rol">{formatValue(obj.usuarioRol)}</Campo>}
                      {!!obj.origen && <Campo label="Origen">{formatValue(obj.origen)}</Campo>}
                    </div>
                  )}

                  {!!obj.aprobadoPor && (
                    <Campo label="Aprobado por">
                      {formatValue(obj.aprobadoPor)}
                      {obj.tipo ? ` · Tipo: ${formatValue(obj.tipo)}` : ''}
                      {obj.carasAprobadas ? ` · ${formatValue(obj.carasAprobadas)} circuito(s)` : ''}
                    </Campo>
                  )}
                  {!!obj.rechazadoPor && (
                    <Campo label="Rechazado por">
                      {formatValue(obj.rechazadoPor)}{obj.motivo ? ` · Motivo: ${formatValue(obj.motivo)}` : ''}
                    </Campo>
                  )}

                  {Array.isArray(obj.cambios) && obj.cambios.length > 0 && (
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
                          {(obj.cambios as Record<string, unknown>[]).map((c, i) => (
                            <tr key={i} className={`border-t ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
                              <td className={`px-3 py-2 font-medium ${headerText}`}>{formatValue(c.label ?? c.campo)}</td>
                              <td className="px-3 py-2 text-red-400">{formatValue(c.antes) || '-'}</td>
                              <td className="px-3 py-2 text-emerald-400">{formatValue(c.despues) || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isPlainObject(obj.cara) && (() => {
                    const cara = obj.cara as Record<string, unknown>;
                    const isPP = String(cara.formato ?? '').toUpperCase().includes('PUENTE PEATONAL');
                    return (
                      <Campo label={isPP ? 'Puente' : 'Cara'}>
                        Artículo: {formatValue(cara.articulo)} · {formatValue(cara.caras)} {isPP ? 'puentes' : 'caras'}
                      </Campo>
                    );
                  })()}
                  {Array.isArray(obj.caras) && obj.caras.length > 0 && (() => {
                    const caras = obj.caras as Record<string, unknown>[];
                    const allPP = caras.every(c => String(c.formato ?? '').toUpperCase().includes('PUENTE PEATONAL'));
                    return (
                      <div>
                        <span className={`text-xs font-medium ${subText}`}>{allPP ? 'Puentes' : 'Caras'} ({caras.length})</span>
                        <ValorGenerico valor={caras} isDark={isDark} />
                      </div>
                    );
                  })()}
                  {Array.isArray(obj.circuitos) && obj.circuitos.length > 0 && (
                    <div>
                      <span className={`text-xs font-medium ${subText}`}>Circuitos afectados ({obj.circuitos.length})</span>
                      <ValorGenerico valor={obj.circuitos} isDark={isDark} />
                    </div>
                  )}

                  {!!obj['campaña'] && <Campo label="Campaña">{formatValue(obj['campaña'])}</Campo>}
                  {!!obj.articulo && <Campo label="Artículo">{formatValue(obj.articulo)}</Campo>}
                  {!obj.rechazadoPor && !!obj.motivo && <Campo label="Motivo">{formatValue(obj.motivo)}</Campo>}
                  {obj.reservas_eliminadas != null && (
                    <Campo label="Reservas eliminadas"><span className="text-red-400 font-medium">{formatValue(obj.reservas_eliminadas)}</span></Campo>
                  )}
                  {obj.circuitos_eliminados != null && (
                    <Campo label="Circuitos eliminados"><span className="text-red-400 font-medium">{formatValue(obj.circuitos_eliminados)}</span></Campo>
                  )}
                  {!!obj.pendientesDg && <p className={`text-sm ${subText}`}>Pendientes DG: {formatValue(obj.pendientesDg)}</p>}
                  {!!obj.pendientesDcm && <p className={`text-sm ${subText}`}>Pendientes DCM: {formatValue(obj.pendientesDcm)}</p>}

                  {/* Todo lo demas que trae el registro. */}
                  {extras.length > 0 && (
                    <div className={`pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                      <span className={`text-xs font-medium ${subText}`}>Más datos ({extras.length})</span>
                      <div className="mt-2 space-y-2">
                        {extras.map(([k, v]) => (
                          <div key={k}>
                            <span className={`text-xs font-medium ${subText}`}>{humanizarClave(k)}</span>
                            <div className="mt-0.5"><ValorGenerico valor={v} isDark={isDark} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        );
      })()}
      </div>
      )}
    </div>
  );
}
