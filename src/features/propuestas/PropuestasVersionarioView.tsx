import { useState, useMemo, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Calendar, Loader2, Download, Package, ClipboardList, MapPin, DollarSign, User, Briefcase, Hash, BadgeCheck, Clock, CalendarDays } from 'lucide-react';
import * as XLSX from 'xlsx';
import { propuestasService } from '../../services/propuestas.service';

interface AdvancedFilter {
  field: string;
  operator: string;
  value: string;
  connector: 'Y' | 'O';
}

interface PropuestasVersionarioViewProps {
  isDark: boolean;
  filters: {
    status?: string;
    search?: string;
    yearInicio?: number;
    yearFin?: number;
    catorcenaInicio?: number;
    catorcenaFin?: number;
    tipoPeriodo?: string;
  };
  advancedFilters?: AdvancedFilter[];
  activeGroupings: GroupByField[];
}

interface InventarioItem {
  propuesta_id: number;
  codigo_unico: string;
  tipo_de_cara: string;
  plaza: string;
  estado: string;
  articulo: string;
  formato: string;
  tipo_medio: string;
  tradicional_digital: string;
  tarifa_publica_sc: number;
  estatus_reserva: string;
  cortesia: number;
  bonificacion_sc: number;
  numero_catorcena: number;
  anio_catorcena: number;
  solicitud_caras_id: number;
  aps_especifico?: number | null;
  caras_totales?: number; // viene del back; reservas en este grupo de inv
}

interface PropuestaInfo {
  propuesta_id: number;
  status: string;
  descripcion: string;
  inversion: number;
  anunciante: string;
  cuic: string;
  vendedor: string;
  tipo_periodo: string;
  campana_nombre: string | null;
  nombre_campania: string | null;
  catorcena_inicio_num: number;
  catorcena_inicio_anio: number;
  catorcena_fin_num: number;
  catorcena_fin_anio: number;
}

interface CaraInfo {
  propuesta_id: number;
  sc_id: number;
  articulo: string;
  ciudad: string;
  formato: string;
  caras_solicitadas: number;
  bonificacion: number;
  caras_esperadas: number;
  reservas_count: number;
  numero_catorcena: number;
  anio_catorcena: number;
}

// === Grouping (filtro Agrupar) ===
export type GroupByField = 'catorcena' | 'asesor' | 'propuesta' | 'circuito' | 'anunciante' | 'cuic' | 'estatus' | 'tipo_periodo' | 'anio';

export interface GroupConfig {
  field: GroupByField;
  label: string;
}

export const AVAILABLE_GROUPINGS: GroupConfig[] = [
  { field: 'catorcena', label: 'Catorcena' },
  { field: 'asesor', label: 'Asesor' },
  { field: 'propuesta', label: 'Propuesta' },
  { field: 'circuito', label: 'Circuito' },
  { field: 'anunciante', label: 'Anunciante' },
  { field: 'cuic', label: 'CUIC' },
  { field: 'estatus', label: 'Estatus' },
  { field: 'tipo_periodo', label: 'Tipo de Periodo' },
  { field: 'anio', label: 'Año' },
];

export const DEFAULT_GROUPINGS: GroupByField[] = ['catorcena', 'asesor', 'propuesta', 'circuito'];
export const MAX_GROUPINGS = 4;
export const GROUPINGS_STORAGE_KEY = 'propuestas-versionario-groupings-v1';

export function loadGroupingsFromStorage(): GroupByField[] {
  try {
    const raw = localStorage.getItem(GROUPINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_GROUPINGS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_GROUPINGS;
    const valid = parsed.filter((f: unknown): f is GroupByField =>
      typeof f === 'string' && AVAILABLE_GROUPINGS.some(g => g.field === f),
    );
    if (valid.length === 0) return DEFAULT_GROUPINGS;
    return valid.slice(0, MAX_GROUPINGS);
  } catch {
    return DEFAULT_GROUPINGS;
  }
}

interface Row {
  propuesta: PropuestaInfo;
  cara: CaraInfo | null;
  inventarios: InventarioItem[];
}

interface GroupNode {
  field: GroupByField;
  key: string;
  fullKey: string;
  label: string;
  meta?: {
    propuesta?: PropuestaInfo;
    cara?: CaraInfo;
    catorcena?: { num: number; anio: number };
  };
  children: GroupNode[];
  inventarios?: InventarioItem[];
  inversion: number;
  propuestaIds: Set<number>;
}

function getGroupValue(row: Row, field: GroupByField): { key: string; label: string; meta?: GroupNode['meta'] } {
  switch (field) {
    case 'catorcena': {
      const ref = row.cara || row.inventarios[0];
      let num = ref ? (ref as { numero_catorcena: number }).numero_catorcena : 0;
      let anio = ref ? (ref as { anio_catorcena: number }).anio_catorcena : 0;
      // Propuestas vacías (sin cara ni inventario): usar catorcena_inicio de la propuesta.
      if (!num && !anio && row.propuesta) {
        num = row.propuesta.catorcena_inicio_num || 0;
        anio = row.propuesta.catorcena_inicio_anio || 0;
      }
      return { key: `${num}-${anio}`, label: `Cat ${num} / ${anio}`, meta: { catorcena: { num, anio } } };
    }
    case 'asesor': {
      const v = (row.propuesta.vendedor || '').trim() || 'Sin asesor';
      return { key: v, label: v };
    }
    case 'propuesta': {
      const name = row.propuesta.campana_nombre || row.propuesta.nombre_campania || `Propuesta #${row.propuesta.propuesta_id}`;
      return { key: String(row.propuesta.propuesta_id), label: name, meta: { propuesta: row.propuesta } };
    }
    case 'circuito': {
      if (!row.cara) return { key: 'sin-circuito', label: 'Sin circuito' };
      const lbl = [row.cara.articulo, row.cara.formato, row.cara.ciudad].filter(Boolean).join(' · ') || `Circuito #${row.cara.sc_id}`;
      return { key: String(row.cara.sc_id), label: lbl, meta: { cara: row.cara } };
    }
    case 'anunciante': {
      const v = (row.propuesta.anunciante || '').trim() || 'Sin anunciante';
      return { key: v, label: `Anunciante: ${v}` };
    }
    case 'cuic': {
      const v = (row.propuesta.cuic || '').trim() || 'Sin CUIC';
      return { key: v, label: `CUIC: ${v}` };
    }
    case 'estatus': {
      const v = (row.propuesta.status || '').trim() || 'Sin estatus';
      return { key: v, label: `Estatus: ${v}` };
    }
    case 'tipo_periodo': {
      const v = (row.propuesta.tipo_periodo || '').trim() || 'Sin tipo';
      return { key: v, label: `Tipo: ${v}` };
    }
    case 'anio': {
      const ref = row.cara || row.inventarios[0];
      let anio = ref ? (ref as { anio_catorcena: number }).anio_catorcena : 0;
      if (!anio && row.propuesta) anio = row.propuesta.catorcena_inicio_anio || 0;
      return { key: String(anio), label: `Año ${anio}` };
    }
  }
}

function getFieldIcon(field: GroupByField) {
  switch (field) {
    case 'catorcena': return Calendar;
    case 'asesor': return User;
    case 'propuesta': return Package;
    case 'circuito': return ClipboardList;
    case 'anunciante': return Briefcase;
    case 'cuic': return Hash;
    case 'estatus': return BadgeCheck;
    case 'tipo_periodo': return Clock;
    case 'anio': return CalendarDays;
  }
}

// Status colors for propuestas
function getStatusColor(status: string, isDark: boolean) {
  const s = (status || '').toLowerCase();
  if (s.includes('aprobad')) return {
    bg: isDark ? 'bg-emerald-500/20' : 'bg-emerald-50',
    text: isDark ? 'text-emerald-300' : 'text-emerald-700',
    border: isDark ? 'border-emerald-500/30' : 'border-emerald-200',
  };
  if (s.includes('rechazad')) return {
    bg: isDark ? 'bg-red-500/20' : 'bg-red-50',
    text: isDark ? 'text-red-300' : 'text-red-700',
    border: isDark ? 'border-red-500/30' : 'border-red-200',
  };
  if (s.includes('pendiente') || s.includes('revision')) return {
    bg: isDark ? 'bg-amber-500/20' : 'bg-amber-50',
    text: isDark ? 'text-amber-300' : 'text-amber-700',
    border: isDark ? 'border-amber-500/30' : 'border-amber-200',
  };
  if (s.includes('campana') || s.includes('campaña')) return {
    bg: isDark ? 'bg-blue-500/20' : 'bg-blue-50',
    text: isDark ? 'text-blue-300' : 'text-blue-700',
    border: isDark ? 'border-blue-500/30' : 'border-blue-200',
  };
  return {
    bg: isDark ? 'bg-zinc-500/20' : 'bg-gray-100',
    text: isDark ? 'text-zinc-400' : 'text-gray-500',
    border: isDark ? 'border-zinc-500/30' : 'border-gray-300',
  };
}

function matchesAdvancedFilters(item: Record<string, unknown>, filters: AdvancedFilter[]): boolean {
  if (filters.length === 0) return true;
  const evalOne = (f: AdvancedFilter): boolean => {
    if (!f.value) return true;
    const raw = item[f.field];
    if (raw === null || raw === undefined) return f.operator === '!=' || f.operator === 'not_contains';
    const sv = String(raw).toLowerCase();
    const fv = f.value.toLowerCase();
    switch (f.operator) {
      case '=': return sv === fv;
      case '!=': return sv !== fv;
      case 'contains': return sv.includes(fv);
      case 'not_contains': return !sv.includes(fv);
      case '>': return Number(raw) > Number(f.value);
      case '<': return Number(raw) < Number(f.value);
      case '>=': return Number(raw) >= Number(f.value);
      case '<=': return Number(raw) <= Number(f.value);
      default: return true;
    }
  };
  let result = evalOne(filters[0]);
  for (let i = 1; i < filters.length; i++) {
    const val = evalOne(filters[i]);
    if (filters[i].connector === 'O') result = result || val;
    else result = result && val;
  }
  return result;
}

export default function PropuestasVersionarioView({ isDark, filters, advancedFilters = [], activeGroupings }: PropuestasVersionarioViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedCircuitInventories, setExpandedCircuitInventories] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  // Sin paginación — el back recibe limit alto para devolver todo de una.
  const limit = 1000;

  // Use default grouping if parent didn't provide any (defensive)
  const effectiveGroupings = activeGroupings.length > 0 ? activeGroupings : DEFAULT_GROUPINGS;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['propuestas-versionario', filters],
    queryFn: () => propuestasService.getVersionarioData({ ...filters, page: 1, limit }),
    refetchOnWindowFocus: false,
    staleTime: 60000,
    retry: 1,
  });

  // Build flat rows then group them recursively according to activeGroupings
  const groupTree = useMemo<GroupNode[]>(() => {
    if (!data) return [];

    const { inventarios, propuestasInfo, carasInfo } = data;

    const propuestaMap = new Map<number, PropuestaInfo>();
    for (const p of propuestasInfo) propuestaMap.set(p.propuesta_id, p);

    // inventarios indexed by (propuesta_id, sc_id)
    const invByKey = new Map<string, InventarioItem[]>();
    for (const inv of inventarios) {
      const k = `${inv.propuesta_id}-${inv.solicitud_caras_id || 0}`;
      if (!invByKey.has(k)) invByKey.set(k, []);
      invByKey.get(k)!.push(inv);
    }

    const isAllowed = (info: PropuestaInfo) =>
      advancedFilters.length === 0 || matchesAdvancedFilters(info as unknown as Record<string, unknown>, advancedFilters);

    const rows: Row[] = [];
    const seenKeys = new Set<string>();

    for (const cara of carasInfo) {
      const propuesta = propuestaMap.get(cara.propuesta_id);
      if (!propuesta || !isAllowed(propuesta)) continue;
      const k = `${cara.propuesta_id}-${cara.sc_id}`;
      seenKeys.add(k);
      const invs = invByKey.get(k) || [];
      rows.push({ propuesta, cara, inventarios: invs });
    }

    for (const [k, invs] of invByKey) {
      if (seenKeys.has(k)) continue;
      const [pidStr, scStr] = k.split('-');
      const pid = parseInt(pidStr, 10);
      const scId = parseInt(scStr, 10);
      const propuesta = propuestaMap.get(pid);
      if (!propuesta || !isAllowed(propuesta)) continue;
      const firstInv = invs[0];
      const cara: CaraInfo = {
        propuesta_id: pid,
        sc_id: scId,
        articulo: firstInv.articulo || '',
        ciudad: firstInv.plaza || '',
        formato: firstInv.formato || '',
        caras_solicitadas: 0,
        bonificacion: 0,
        caras_esperadas: invs.length,
        reservas_count: invs.filter(i => i.estatus_reserva === 'reservado').length,
        numero_catorcena: firstInv.numero_catorcena,
        anio_catorcena: firstInv.anio_catorcena,
      };
      rows.push({ propuesta, cara, inventarios: invs });
    }

    // 3er pase: propuestas SIN caras NI inventarios. Las incluimos como filas
    // vacías para que el footer del desglose cuadre con el KPI de stats.
    const propIdsConContenido = new Set<number>();
    for (const c of carasInfo) propIdsConContenido.add(c.propuesta_id);
    for (const k of invByKey.keys()) {
      const pidStr = k.split('-')[0];
      propIdsConContenido.add(parseInt(pidStr, 10));
    }
    for (const p of propuestasInfo) {
      if (propIdsConContenido.has(p.propuesta_id)) continue;
      if (!isAllowed(p)) continue;
      rows.push({ propuesta: p, cara: null, inventarios: [] });
    }

    // Range filter on catorcena
    let filteredRows = rows;
    if (filters.yearInicio && filters.yearFin && filters.catorcenaInicio && filters.catorcenaFin) {
      const rangeStart = filters.yearInicio * 100 + filters.catorcenaInicio;
      const rangeEnd = filters.yearFin * 100 + filters.catorcenaFin;
      filteredRows = rows.filter(r => {
        const ref = r.cara || r.inventarios[0];
        if (!ref) return false;
        const num = (ref as { numero_catorcena: number }).numero_catorcena || 0;
        const anio = (ref as { anio_catorcena: number }).anio_catorcena || 0;
        const val = anio * 100 + num;
        return val >= rangeStart && val <= rangeEnd;
      });
    }

    function buildTree(currentRows: Row[], levels: GroupByField[], parentKey: string): GroupNode[] {
      if (levels.length === 0) return [];
      const [head, ...rest] = levels;
      const buckets = new Map<string, { value: { key: string; label: string; meta?: GroupNode['meta'] }; rows: Row[] }>();

      for (const r of currentRows) {
        const v = getGroupValue(r, head);
        if (!buckets.has(v.key)) buckets.set(v.key, { value: v, rows: [] });
        buckets.get(v.key)!.rows.push(r);
      }

      const nodes: GroupNode[] = [];
      buckets.forEach(({ value, rows: bucketRows }) => {
        const fullKey = `${parentKey}/${head}:${value.key}`;
        const propuestaIds = new Set<number>();
        // Inversión por bucket: sumar el slice de inventarios que CAEN en este
        // bucket — no `propuesta.inversion` completa (esa cubre todas las cats).
        let inversion = 0;
        for (const r of bucketRows) {
          propuestaIds.add(r.propuesta.propuesta_id);
          for (const inv of r.inventarios) {
            const tarifa = Number(inv.tarifa_publica_sc) || 0;
            const cant = Number(inv.caras_totales) || 1;
            inversion += tarifa * cant;
          }
        }
        const node: GroupNode = {
          field: head,
          key: value.key,
          fullKey,
          label: value.label,
          meta: value.meta,
          children: rest.length > 0 ? buildTree(bucketRows, rest, fullKey) : [],
          inversion,
          propuestaIds,
        };
        if (rest.length === 0) {
          node.inventarios = bucketRows.flatMap(r => r.inventarios);
        }
        nodes.push(node);
      });

      // Sort: catorcena/anio numeric, everything else by label
      nodes.sort((a, b) => {
        if (head === 'catorcena' && a.meta?.catorcena && b.meta?.catorcena) {
          if (a.meta.catorcena.anio !== b.meta.catorcena.anio) return a.meta.catorcena.anio - b.meta.catorcena.anio;
          return a.meta.catorcena.num - b.meta.catorcena.num;
        }
        if (head === 'anio') return Number(a.key) - Number(b.key);
        return a.label.localeCompare(b.label);
      });

      return nodes;
    }

    return buildTree(filteredRows, effectiveGroupings, '');
  }, [data, filters.yearInicio, filters.yearFin, filters.catorcenaInicio, filters.catorcenaFin, advancedFilters, effectiveGroupings]);

  const toggleNode = (key: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleCircuitInventory = (key: string) => {
    setExpandedCircuitInventories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Total propuestas (unique) across the tree
  const totalPropuestas = useMemo(() => {
    const ids = new Set<number>();
    const walk = (nodes: GroupNode[]) => {
      for (const n of nodes) {
        n.propuestaIds.forEach(id => ids.add(id));
        if (n.children.length > 0) walk(n.children);
      }
    };
    walk(groupTree);
    return ids.size;
  }, [groupTree]);

  // CSV Export
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      if (!groupTree || groupTree.length === 0) {
        alert('No hay datos para exportar.');
        return;
      }

      const headers = [
        'Campaña', 'Anunciante', 'Inversión Campaña', 'Operación', 'Código de contrato (Opcional)',
        'Precio por cara (Opcional)', 'APS Global', 'APS Específico', 'CUIC', 'Articulo', 'Vendedor',
        'Descripción (Opcional)', 'Inicio o Periodo', 'Fin o Segmento', 'Arte',
        'Código de arte (Opcional)', 'Arte Url (Opcional)', 'Origen del arte (Opcional)',
        'Unidad', 'Cara', 'Ciudad', 'Tipo de Distribución', 'Reproducciones', 'Notas',
        'Estatus',
      ];

      const rows: string[][] = [];

      // Walk leaves and emit one row per inventory item
      const walk = (nodes: GroupNode[]) => {
        for (const n of nodes) {
          if (n.children.length > 0) {
            walk(n.children);
          } else if (n.inventarios && n.inventarios.length > 0) {
            for (const inv of n.inventarios) {
              const info = inv as InventarioItem;
              // Need PropuestaInfo here; we kept it on row-level but not on node. Look it up from data.propuestasInfo.
              const propuesta = data?.propuestasInfo.find(p => p.propuesta_id === inv.propuesta_id);
              if (!propuesta) continue;
              rows.push([
                propuesta.campana_nombre || propuesta.nombre_campania || '',
                propuesta.anunciante || '',
                String(propuesta.inversion ?? ''),
                '',
                '',
                String(info.tarifa_publica_sc ?? ''),
                '',
                info.aps_especifico ? String(info.aps_especifico) : '',
                propuesta.cuic || '',
                info.articulo || '',
                propuesta.vendedor || '',
                propuesta.descripcion || '',
                `Cat ${propuesta.catorcena_inicio_num ?? ''}/${propuesta.catorcena_inicio_anio ?? ''}`,
                `Cat ${propuesta.catorcena_fin_num ?? ''}/${propuesta.catorcena_fin_anio ?? ''}`,
                '',
                '',
                '',
                '',
                info.codigo_unico || '',
                info.tipo_de_cara || '',
                info.plaza || '',
                info.tradicional_digital || '',
                '',
                '',
                propuesta.status || '',
              ]);
            }
          }
        }
      };
      walk(groupTree);

      if (rows.length === 0) {
        alert('No hay filas exportables. Revisa que las propuestas tengan circuitos o inventarios.');
        return;
      }

      const safeCell = (val: unknown) => (val == null ? '' : String(val));
      const sheetData = [headers, ...rows.map(r => r.map(safeCell))];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, 'Versionario');
      XLSX.writeFile(wb, `propuestas_versionario_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Error exportando Excel versionario:', err);
      alert(`Error exportando Excel: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Top-level count for header
  const topLevelLabel = effectiveGroupings[0]
    ? AVAILABLE_GROUPINGS.find(g => g.field === effectiveGroupings[0])?.label || effectiveGroupings[0]
    : 'Grupos';

  // Recursive renderer
  const renderNode = (node: GroupNode, depth: number): ReactElement => {
    const isExpanded = expandedNodes.has(node.fullKey);
    const isLeaf = node.children.length === 0;
    const Icon = getFieldIcon(node.field);
    const hasInventarios = !!(node.inventarios && node.inventarios.length > 0);

    // Visual treatment per depth
    const headerBg = depth === 0
      ? (isDark ? 'bg-zinc-800/30 hover:bg-zinc-800/50' : 'bg-gray-50 hover:bg-gray-100')
      : depth === 1
        ? (isDark ? 'bg-indigo-900/10 hover:bg-indigo-900/20' : 'bg-indigo-50/50 hover:bg-indigo-50')
        : depth === 2
          ? (isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50')
          : (isDark ? 'hover:bg-zinc-800/20' : 'hover:bg-gray-50');

    const iconColor = depth === 0
      ? (isDark ? 'text-purple-400' : 'text-purple-600')
      : depth === 1
        ? (isDark ? 'text-indigo-400' : 'text-indigo-600')
        : (isDark ? 'text-zinc-400' : 'text-gray-500');

    const paddingLeft = 20 + depth * 16;

    // Build status badge for propuesta nodes
    let statusBadge: ReactElement | null = null;
    if (node.field === 'propuesta' && node.meta?.propuesta) {
      const sc = getStatusColor(node.meta.propuesta.status, isDark);
      statusBadge = (
        <span className={`px-2 py-0.5 rounded-full text-[10px] ${sc.bg} ${sc.text} border ${sc.border}`}>
          {node.meta.propuesta.status}
        </span>
      );
    }

    return (
      <div key={node.fullKey} className={depth === 0 ? 'group' : `border-t ${isDark ? 'border-zinc-800/30' : 'border-gray-200'}`}>
        <button
          onClick={() => toggleNode(node.fullKey)}
          style={{ paddingLeft }}
          className={`w-full flex items-center gap-3 pr-5 py-${depth === 0 ? '4' : '3'} transition-all ${headerBg}`}
        >
          {isExpanded ? (
            <ChevronDown className={`h-${depth === 0 ? '5' : '4'} w-${depth === 0 ? '5' : '4'} ${iconColor}`} />
          ) : (
            <ChevronRight className={`h-${depth === 0 ? '5' : '4'} w-${depth === 0 ? '5' : '4'} ${iconColor}`} />
          )}
          <Icon className={`h-${depth === 0 ? '5' : '4'} w-${depth === 0 ? '5' : '4'} ${iconColor}`} />
          <span className={`font-${depth <= 1 ? 'semibold' : 'medium'} ${isDark ? 'text-white' : 'text-gray-900'} text-sm flex-1 text-left truncate`}>
            {node.label}
          </span>
          {statusBadge}
          {node.meta?.propuesta?.anunciante && node.field === 'propuesta' && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'} border border-cyan-500/25`}>
              {node.meta.propuesta.anunciante}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-50 text-purple-700'} border border-purple-500/25`}>
            {node.propuestaIds.size} prop{node.propuestaIds.size !== 1 ? 's' : ''}
          </span>
          {node.inversion > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-green-500/15 text-green-300' : 'bg-green-50 text-green-700'} border border-green-500/25 flex items-center gap-1`}>
              <DollarSign className="h-3 w-3" /> {node.inversion.toLocaleString()}
            </span>
          )}
          {node.field === 'circuito' && node.meta?.cara && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${
              node.meta.cara.caras_esperadas > 0 && node.meta.cara.reservas_count >= node.meta.cara.caras_esperadas
                ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {node.meta.cara.reservas_count || 0}/{node.meta.cara.caras_esperadas || 0}
            </span>
          )}
        </button>

        {isExpanded && (
          <div className={isDark ? 'bg-zinc-900/30' : 'bg-white'}>
            {isLeaf ? (
              // Leaf: show inventarios for this group
              hasInventarios ? (
                <div style={{ paddingLeft: paddingLeft + 32 }} className="py-2 pr-5 space-y-0.5">
                  {node.inventarios!.map((inv, idx) => (
                    <div key={`${node.fullKey}-${inv.codigo_unico}-${idx}`} className={`flex items-center gap-2 text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} py-0.5 flex-wrap`}>
                      <MapPin className={`h-2.5 w-2.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
                      <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} font-mono`}>{inv.codigo_unico}</span>
                      <span className={isDark ? 'text-zinc-600' : 'text-gray-300'}>|</span>
                      <span>{inv.tipo_de_cara || 'Sin tipo'}</span>
                      <span className={isDark ? 'text-zinc-600' : 'text-gray-300'}>|</span>
                      <span>{inv.plaza || 'Sin plaza'}</span>
                      {inv.estatus_reserva && (
                        <>
                          <span className={isDark ? 'text-zinc-600' : 'text-gray-300'}>|</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                            inv.estatus_reserva === 'reservado'
                              ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isDark ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' : 'bg-gray-100 text-gray-500 border-gray-300'
                          } border`}>
                            {inv.estatus_reserva}
                          </span>
                        </>
                      )}
                      {Number(inv.tarifa_publica_sc) > 0 && (
                        <span className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          ${Number(inv.tarifa_publica_sc).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ paddingLeft: paddingLeft + 32 }} className={`text-sm py-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Sin inventarios</p>
              )
            ) : (
              node.children.map(child => renderNode(child, depth + 1))
            )}
          </div>
        )}
      </div>
    );
  };

  // Suppress unused var warnings (kept for potential future use)
  void expandedCircuitInventories;
  void toggleCircuitInventory;

  return (
    <div className={`rounded-2xl border ${isDark ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-gray-200 bg-white'} backdrop-blur-sm overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${isDark ? 'border-zinc-800/50 bg-gradient-to-r from-purple-900/20 via-fuchsia-900/10 to-purple-900/20' : 'border-gray-200 bg-purple-50/50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'} flex items-center justify-center`}>
              <Calendar className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Versionario de Propuestas</h3>
              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Propuestas desglosadas — agrupado por {effectiveGroupings.map(f => AVAILABLE_GROUPINGS.find(g => g.field === f)?.label).filter(Boolean).join(' › ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={isExporting || groupTree.length === 0}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isExporting || groupTree.length === 0
                  ? isDark ? 'bg-zinc-800/30 text-zinc-600 cursor-not-allowed' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700/50' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {isExporting ? 'Exportando...' : 'Exportar Excel'}
            </button>
            <div className={`w-px h-10 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
            <div className="text-right">
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{groupTree.length}</p>
              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wide`}>{topLevelLabel}</p>
            </div>
            <div className={`w-px h-10 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
            <div className="text-right">
              <p className={`text-2xl font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{totalPropuestas}</p>
              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wide`}>Propuestas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading || isFetching ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className={`h-8 w-8 animate-spin ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{isFetching && !isLoading ? 'Aplicando filtros...' : 'Cargando desglose...'}</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-center px-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${isDark ? 'bg-red-500/10' : 'bg-red-50'} mb-4`}>
            <Calendar className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
          </div>
          <p className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}>No se pudo cargar el desglose</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'} max-w-md`}>
            {(error as Error)?.message || 'La consulta tardó demasiado. Aplica filtros más específicos (status, periodo o búsqueda) para reducir el conjunto de resultados.'}
          </p>
          <button
            onClick={() => refetch()}
            className={`mt-4 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
              isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            Reintentar
          </button>
        </div>
      ) : groupTree.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} mb-4`}>
            <Calendar className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          </div>
          <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>No hay datos</p>
        </div>
      ) : (
        <div className={`divide-y ${isDark ? 'divide-zinc-800/30' : 'divide-gray-200'}`}>
          {groupTree.map(node => renderNode(node, 0))}
        </div>
      )}

      {/* Footer — sin paginación, solo contador */}
      {!isLoading && (
        <div className={`px-5 py-3 border-t ${isDark ? 'border-zinc-800/50 bg-zinc-900/30 text-zinc-500' : 'border-gray-200 bg-gray-50 text-gray-400'} text-xs`}>
          {groupTree.length > 0
            ? `${groupTree.length} ${topLevelLabel.toLowerCase()}${groupTree.length !== 1 ? 's' : ''} · ${totalPropuestas} propuesta${totalPropuestas !== 1 ? 's' : ''}`
            : 'Sin resultados'}
        </div>
      )}
    </div>
  );
}
