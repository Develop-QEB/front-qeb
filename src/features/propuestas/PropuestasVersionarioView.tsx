import { useState, useMemo, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Calendar, Loader2, Download, Package, ClipboardList, MapPin, DollarSign, User, Briefcase, Hash, BadgeCheck, Clock, CalendarDays, Layers, Gift } from 'lucide-react';
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
    excludeRechazadas?: boolean;
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

// Resumen ligero por (propuesta, catorcena) que viene del back. Permite
// mostrar Circuitos/Caras/Bonif/Tarifa/Inversión a nivel propuesta antes de
// expandir, ya filtrados por la catorcena del bucket. Lo trae siempre el back
// (lite y full).
interface ResumenCatorcena {
  propuesta_id: number;
  numero_catorcena: number;
  anio_catorcena: number;
  circuitos_count: number;
  caras_total: number;
  bonif_total: number;
  tarifa_representativa: number;
  inversion_catorcena: number;
}

interface CaraInfo {
  propuesta_id: number;
  sc_id: number;
  articulo: string;
  ciudad: string;
  formato: string;
  tarifa_publica: number;
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
  scIds: Set<number>;
  circuitosCount: number;
  totalCarasEsperadas: number;
  totalBonif: number;
  tarifaRepresentativa: number;
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
      // Plaza viene del inventario (sc.ciudad no es plaza). Fallback a ciudad si
      // todavía no hay inv cargado (modo lite).
      const plaza = row.inventarios[0]?.plaza || row.cara.ciudad || '';
      const lbl = [plaza, row.cara.formato, row.cara.articulo].filter(Boolean).join(' · ') || `Circuito #${row.cara.sc_id}`;
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

  // Lazy-load detalle (caras + inventarios) por propuesta cuando se expande.
  const [propuestaDetails, setPropuestaDetails] = useState<Map<number, { caras: CaraInfo[]; invs: InventarioItem[] }>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set());

  const loadPropuestaDetail = async (pid: number) => {
    if (propuestaDetails.has(pid) || loadingDetails.has(pid)) return;
    setLoadingDetails(prev => new Set(prev).add(pid));
    try {
      const detail = await propuestasService.getVersionarioData({ propuestaIds: String(pid), lite: false });
      setPropuestaDetails(prev => {
        const next = new Map(prev);
        next.set(pid, {
          caras: (detail.carasInfo || []) as CaraInfo[],
          invs: (detail.inventarios || []) as InventarioItem[],
        });
        return next;
      });
    } catch (err) {
      console.error('Error cargando detalle de propuesta', pid, err);
    } finally {
      setLoadingDetails(prev => {
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
    }
  };

  // Use default grouping if parent didn't provide any (defensive)
  const effectiveGroupings = activeGroupings.length > 0 ? activeGroupings : DEFAULT_GROUPINGS;

  // Cuando hay filtro de catorcena, el back devuelve inv/caras filtrados a ese
  // rango (mucho menos data → manejable). Sin filtro: lite=true para no
  // reventar el back con 270k reservas.
  const hasCatFilter = !!(filters.yearInicio && filters.yearFin && filters.catorcenaInicio && filters.catorcenaFin);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['propuestas-versionario', filters],
    queryFn: () => propuestasService.getVersionarioData({ ...filters, page: 1, limit, lite: !hasCatFilter }),
    refetchOnWindowFocus: false,
    staleTime: 60000,
    retry: 1,
  });

  // Build flat rows then group them recursively according to activeGroupings
  const groupTree = useMemo<GroupNode[]>(() => {
    if (!data) return [];

    const { inventarios: liteInv, propuestasInfo, carasInfo: liteCaras } = data;
    const resumenArr: ResumenCatorcena[] = (data as { resumenPorCatorcena?: ResumenCatorcena[] }).resumenPorCatorcena || [];

    // Mezclar detalles lazy-loaded por propuesta con los datos lite.
    const extraCaras: CaraInfo[] = [];
    const extraInv: InventarioItem[] = [];
    propuestaDetails.forEach(d => {
      extraCaras.push(...d.caras);
      extraInv.push(...d.invs);
    });
    const inventarios: InventarioItem[] = [...liteInv, ...extraInv];
    const carasInfo: CaraInfo[] = [...liteCaras, ...extraCaras];

    const propuestaMap = new Map<number, PropuestaInfo>();
    for (const p of propuestasInfo) propuestaMap.set(p.propuesta_id, p);

    // Index resumen por "pid-num-anio" para lookup O(1) en buildTree.
    const resumenMap = new Map<string, ResumenCatorcena>();
    for (const r of resumenArr) {
      const num = Number(r.numero_catorcena) || 0;
      const anio = Number(r.anio_catorcena) || 0;
      if (!num || !anio) continue;
      resumenMap.set(`${r.propuesta_id}-${num}-${anio}`, r);
    }

    // inventarios indexed by (propuesta_id, sc_id)
    const invByKey = new Map<string, InventarioItem[]>();
    for (const inv of inventarios) {
      const k = `${inv.propuesta_id}-${inv.solicitud_caras_id || 0}`;
      if (!invByKey.has(k)) invByKey.set(k, []);
      invByKey.get(k)!.push(inv);
    }

    const isAllowed = (info: PropuestaInfo) =>
      advancedFilters.length === 0 || matchesAdvancedFilters(info as unknown as Record<string, unknown>, advancedFilters);

    const hasRangeFilter = !!(filters.yearInicio && filters.yearFin && filters.catorcenaInicio && filters.catorcenaFin);

    const rows: Row[] = [];
    const seenKeys = new Set<string>();

    // 1er pase: caras (sc) en el rango. Incluye las que no tienen reserva
    // todavía — para que el jefe vea las propuestas con circuitos planeados
    // aunque no estén asignadas a inventario aún.
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
        tarifa_publica: Number(firstInv.tarifa_publica_sc) || 0,
        caras_solicitadas: 0,
        bonificacion: 0,
        caras_esperadas: invs.length,
        reservas_count: invs.filter(i => i.estatus_reserva === 'reservado').length,
        numero_catorcena: firstInv.numero_catorcena,
        anio_catorcena: firstInv.anio_catorcena,
      };
      rows.push({ propuesta, cara, inventarios: invs });
    }

    // 3er pase: completar filas que los pasos previos no generaron.
    //
    // (a) En modo lite (sin filtro), carasInfo/invs llegan vacíos: construimos
    //     filas sintéticas por (propuesta, catorcena) usando `resumenPorCatorcena`
    //     para que cada propuesta aparezca en CADA catorcena donde tiene caras
    //     (no solo en su catorcena_inicio).
    // (b) Incompletas — propuestas sin caras todavía — se agregan como fila
    //     cara=null y caen en su catorcena_inicio via fallback de getGroupValue.
    //
    // Aplicamos en ambos modos (con y sin filtro) para que sin filtro y con
    // filtro Cat X muestren los mismos conjuntos.
    {
      const propIdsConContenido = new Set<number>();
      for (const c of carasInfo) propIdsConContenido.add(c.propuesta_id);
      for (const k of invByKey.keys()) {
        propIdsConContenido.add(parseInt(k.split('-')[0], 10));
      }
      const propIdsEnResumen = new Set<number>();
      for (const res of resumenArr) {
        const propuesta = propuestaMap.get(res.propuesta_id);
        if (!propuesta || !isAllowed(propuesta)) continue;
        if (propIdsConContenido.has(res.propuesta_id)) continue;
        const num = Number(res.numero_catorcena) || 0;
        const anio = Number(res.anio_catorcena) || 0;
        if (!num || !anio) continue;
        propIdsEnResumen.add(res.propuesta_id);
        const syntheticCara: CaraInfo = {
          propuesta_id: res.propuesta_id,
          sc_id: -(res.propuesta_id * 100000 + anio * 100 + num),
          articulo: '',
          ciudad: '',
          formato: '',
          tarifa_publica: Number(res.tarifa_representativa) || 0,
          caras_solicitadas: 0,
          bonificacion: Number(res.bonif_total) || 0,
          caras_esperadas: Number(res.caras_total) || 0,
          reservas_count: 0,
          numero_catorcena: num,
          anio_catorcena: anio,
        };
        rows.push({ propuesta, cara: syntheticCara, inventarios: [] });
      }
      for (const p of propuestasInfo) {
        if (propIdsConContenido.has(p.propuesta_id)) continue;
        if (propIdsEnResumen.has(p.propuesta_id)) continue;
        if (!isAllowed(p)) continue;
        rows.push({ propuesta: p, cara: null, inventarios: [] });
      }
    }

    // Range filter on catorcena. Match exacto: la cara/inv debe estar en el
    // rango, o (lite mode) catorcena_inicio de la propuesta debe estar en el
    // rango. Las propuestas que solo "pasan" por el rango no se incluyen.
    let filteredRows = rows;
    if (filters.yearInicio && filters.yearFin && filters.catorcenaInicio && filters.catorcenaFin) {
      const rangeStart = filters.yearInicio * 100 + filters.catorcenaInicio;
      const rangeEnd = filters.yearFin * 100 + filters.catorcenaFin;
      filteredRows = rows.filter(r => {
        const ref = r.cara || r.inventarios[0];
        let num: number;
        let anio: number;
        if (ref) {
          num = (ref as { numero_catorcena: number }).numero_catorcena || 0;
          anio = (ref as { anio_catorcena: number }).anio_catorcena || 0;
        } else {
          num = r.propuesta.catorcena_inicio_num || 0;
          anio = r.propuesta.catorcena_inicio_anio || 0;
        }
        const val = anio * 100 + num;
        return val >= rangeStart && val <= rangeEnd;
      });
    }

    function buildTree(currentRows: Row[], levels: GroupByField[], parentKey: string, catContext: { num: number; anio: number } | null): GroupNode[] {
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
        // El bucket de catorcena fija num/anio para sus descendientes; los
        // niveles anidados heredan el contexto del padre.
        const bucketCatContext = head === 'catorcena' && value.meta?.catorcena
          ? { num: value.meta.catorcena.num, anio: value.meta.catorcena.anio }
          : catContext;
        // Inversión por bucket:
        // - En el bucket de catorcena (head === 'catorcena') SIEMPRE usar
        //   `resumen.inversion_catorcena` (SUM sc.costo por catorcena). Esto
        //   garantiza que sin filtro (lite, sin invs) y con filtro (full, con
        //   invs) muestren la MISMA cifra al nivel de catorcena. Las dos
        //   fórmulas anteriores divergían cuando había caras planeadas no
        //   reservadas todavía.
        // - En niveles más profundos con inv real cargada, usar tarifa × caras
        //   reservadas (refleja lo efectivamente reservado).
        // - Sin contexto de catorcena (usuario quitó catorcena del grouping)
        //   usar propuesta.inversion como total.
        const propInversionSeen = new Set<number>();
        let inversion = 0;
        const bucketHasInv = bucketRows.some(r => r.inventarios.length > 0);
        const useResumenInversion = head === 'catorcena' || !bucketHasInv;
        const scIds = new Set<number>();
        let totalCarasEsperadas = 0;
        let totalBonif = 0;
        let tarifaRepresentativa = 0;
        const seenScForAgg = new Set<number>();
        for (const r of bucketRows) {
          propuestaIds.add(r.propuesta.propuesta_id);
          if (useResumenInversion) {
            if (!propInversionSeen.has(r.propuesta.propuesta_id)) {
              propInversionSeen.add(r.propuesta.propuesta_id);
              if (bucketCatContext) {
                const res = resumenMap.get(`${r.propuesta.propuesta_id}-${bucketCatContext.num}-${bucketCatContext.anio}`);
                inversion += res ? Number(res.inversion_catorcena) || 0 : 0;
              } else {
                inversion += Number(r.propuesta.inversion) || 0;
              }
            }
          } else {
            for (const inv of r.inventarios) {
              const tarifa = Number(inv.tarifa_publica_sc) || 0;
              const cant = Number((inv as any).caras_totales) || 1;
              inversion += tarifa * cant;
            }
          }
          // Agregaciones por cara (sc) — únicas por sc_id dentro del bucket.
          if (r.cara && !seenScForAgg.has(r.cara.sc_id)) {
            seenScForAgg.add(r.cara.sc_id);
            scIds.add(r.cara.sc_id);
            totalCarasEsperadas += Number(r.cara.caras_esperadas) || 0;
            totalBonif += Number(r.cara.bonificacion) || 0;
            const t = Number(r.cara.tarifa_publica) || 0;
            if (t > 0 && tarifaRepresentativa === 0) tarifaRepresentativa = t;
          }
        }
        let circuitosCount = scIds.size;
        // Fallback para el bucket de propuesta sin caras detalladas (modo
        // lite): usar el resumen específico de la catorcena del path. Sin
        // catContext (usuario quitó catorcena del grouping) no rellenamos para
        // evitar mostrar totales engañosos.
        if (head === 'propuesta' && scIds.size === 0 && bucketCatContext && propuestaIds.size === 1) {
          const pid = bucketRows[0].propuesta.propuesta_id;
          const res = resumenMap.get(`${pid}-${bucketCatContext.num}-${bucketCatContext.anio}`);
          if (res) {
            circuitosCount = Number(res.circuitos_count) || 0;
            totalCarasEsperadas = Number(res.caras_total) || 0;
            totalBonif = Number(res.bonif_total) || 0;
            if (tarifaRepresentativa === 0) tarifaRepresentativa = Number(res.tarifa_representativa) || 0;
          }
        }
        const node: GroupNode = {
          field: head,
          key: value.key,
          fullKey,
          label: value.label,
          meta: value.meta,
          children: rest.length > 0 ? buildTree(bucketRows, rest, fullKey, bucketCatContext) : [],
          inversion,
          propuestaIds,
          scIds,
          circuitosCount,
          totalCarasEsperadas,
          totalBonif,
          tarifaRepresentativa,
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

    return buildTree(filteredRows, effectiveGroupings, '', null);
  }, [data, filters.yearInicio, filters.yearFin, filters.catorcenaInicio, filters.catorcenaFin, advancedFilters, effectiveGroupings, propuestaDetails]);

  // Al expandir un nodo de nivel "propuesta", lazy-load su detalle (caras+inv)
  // si todavía no se ha cargado. Igual que la UX de versionario de campañas.
  const toggleNode = (key: string, node?: GroupNode) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Si expandimos y es nodo propuesta, gatillar lazy-load
        if (node && node.field === 'propuesta' && node.propuestaIds.size > 0) {
          node.propuestaIds.forEach(pid => { loadPropuestaDetail(pid); });
        }
      }
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
      if (!data?.propuestasInfo || data.propuestasInfo.length === 0) {
        alert('No hay propuestas para exportar.');
        return;
      }

      // Patrón estilo campañas: una sola request al back con exportLayout=true.
      // El back hace batches internos (30 a la vez) y devuelve toda la data.
      const fullData = await propuestasService.getVersionarioData({
        ...filters,
        exportLayout: true,
      });

      // Si hay filtro de rango de catorcenas, descartar inventarios FUERA
      // del rango. El back trae todas las propuestas que tocan el rango con
      // TODOS sus inv (cat 1-26), pero el usuario quiere solo las del rango.
      const hasRange = !!(filters.yearInicio && filters.yearFin && filters.catorcenaInicio && filters.catorcenaFin);
      const rangeStart = hasRange ? filters.yearInicio! * 100 + filters.catorcenaInicio! : -Infinity;
      const rangeEnd = hasRange ? filters.yearFin! * 100 + filters.catorcenaFin! : Infinity;
      const invInRange = (inv: InventarioItem) => {
        if (!hasRange) return true;
        const val = (inv.anio_catorcena || 0) * 100 + (inv.numero_catorcena || 0);
        return val >= rangeStart && val <= rangeEnd;
      };
      // Filtrar propuestas a las que cuya catorcena_inicio cae en el rango,
      // O que tienen al menos un inv en el rango.
      const allInv = ((fullData.inventarios as InventarioItem[]) || []).filter(invInRange);

      // Indexar por propuesta_id
      const invsByPid = new Map<number, InventarioItem[]>();
      for (const inv of allInv) {
        if (!invsByPid.has(inv.propuesta_id)) invsByPid.set(inv.propuesta_id, []);
        invsByPid.get(inv.propuesta_id)!.push(inv);
      }
      // Indexar caras también para incluir propuestas con caras sin reserva
      const carasInfoArr: CaraInfo[] = (fullData.carasInfo as CaraInfo[]) || [];
      const carasByPidExp = new Map<number, CaraInfo[]>();
      for (const c of carasInfoArr) {
        if (!carasByPidExp.has(c.propuesta_id)) carasByPidExp.set(c.propuesta_id, []);
        carasByPidExp.get(c.propuesta_id)!.push(c);
      }
      const loadedDetails = new Map<number, { caras: CaraInfo[]; invs: InventarioItem[] }>();
      for (const p of (fullData.propuestasInfo || [])) {
        loadedDetails.set(p.propuesta_id, {
          caras: [],
          invs: invsByPid.get(p.propuesta_id) || [],
        });
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
      // Filtrar propuestas: si hay filtro de rango, incluir las que tienen
      // al menos UN CIRCUITO (inv) o UNA CARA en el rango. Las caras sin
      // reserva aún salen como 1 fila básica (sin inv).
      const allExportPropuestas: PropuestaInfo[] = (fullData.propuestasInfo as PropuestaInfo[]) || [];
      const exportPropuestas = hasRange
        ? allExportPropuestas.filter(p =>
            (invsByPid.get(p.propuesta_id) || []).length > 0 ||
            (carasByPidExp.get(p.propuesta_id) || []).length > 0
          )
        : allExportPropuestas;
      for (const propuesta of exportPropuestas) {
        const det = loadedDetails.get(propuesta.propuesta_id);
        const invs = det?.invs || [];
        const apsGlobal = String(propuesta.propuesta_id);
        if (invs.length === 0) {
          // Propuesta con caras en el rango pero sin reservas: 1 fila básica.
          const caras = carasByPidExp.get(propuesta.propuesta_id) || [];
          const firstCara = caras[0];
          const invCat = firstCara
            ? `Cat ${firstCara.numero_catorcena ?? ''}/${firstCara.anio_catorcena ?? ''}`
            : `Cat ${propuesta.catorcena_inicio_num ?? ''}/${propuesta.catorcena_inicio_anio ?? ''}`;
          rows.push([
            propuesta.campana_nombre || propuesta.nombre_campania || '',
            propuesta.anunciante || '',
            String(propuesta.inversion ?? ''),
            '', '', '', apsGlobal, '',
            propuesta.cuic || '',
            firstCara?.articulo || '',
            propuesta.vendedor || '',
            propuesta.descripcion || '',
            invCat, invCat,
            '', '', '', '', '', '',
            firstCara?.ciudad || '',
            '', '', '',
            propuesta.status || '',
          ]);
          continue;
        }
        for (const inv of invs) {
          const invAny = inv as InventarioItem & { estatus_reserva?: string; cortesia?: number };
          const operacion = invAny.cortesia
            ? 'CORTESIA'
            : (invAny.estatus_reserva === 'Bonificado' || invAny.estatus_reserva === 'Vendido bonificado')
              ? 'BONIFICACION'
              : 'RENTA';
          const arteStatus = invAny.estatus_reserva === 'Arte Aprobado' ? 'Aprobado' : 'Pendiente';
          // Inicio/Fin = la catorcena específica del INV (no el rango total
          // de la propuesta), para que el export solo refleje cat 10.
          const invCat = `Cat ${inv.numero_catorcena ?? ''}/${inv.anio_catorcena ?? ''}`;
          rows.push([
            propuesta.campana_nombre || propuesta.nombre_campania || '',
            propuesta.anunciante || '',
            String(propuesta.inversion ?? ''),
            operacion,
            '',
            String(inv.tarifa_publica_sc ?? ''),
            apsGlobal,
            inv.aps_especifico ? String(inv.aps_especifico) : '',
            propuesta.cuic || '',
            inv.articulo || '',
            propuesta.vendedor || '',
            propuesta.descripcion || '',
            invCat, invCat,
            arteStatus,
            '', '', '',
            inv.codigo_unico || '',
            inv.tipo_de_cara || '',
            inv.plaza || '',
            inv.tradicional_digital || '',
            '', '',
            propuesta.status || '',
          ]);
        }
      }

      if (rows.length === 0) {
        alert('No hay propuestas para exportar.');
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
          onClick={() => toggleNode(node.fullKey, node)}
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
          {node.field === 'propuesta' && node.circuitosCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'} border border-blue-500/25 flex items-center gap-1`} title="Circuitos (caras)">
              <Layers className="h-3 w-3" /> Circuitos {node.circuitosCount}
            </span>
          )}
          {node.field === 'propuesta' && node.totalBonif > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'} border border-amber-500/25 flex items-center gap-1`} title="Bonificación">
              <Gift className="h-3 w-3" /> {node.totalBonif}
            </span>
          )}
          {node.field === 'propuesta' && (node.totalCarasEsperadas - node.totalBonif) > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'} border border-cyan-500/25 flex items-center gap-1`} title="Caras rentadas sin bonificación">
              <MapPin className="h-3 w-3" /> {node.totalCarasEsperadas - node.totalBonif}
            </span>
          )}
          {node.field === 'propuesta' && node.tarifaRepresentativa > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'} border border-blue-500/25`} title="Tarifa pública (precio por cara)">
              Tarifa: ${node.tarifaRepresentativa.toLocaleString()}
            </span>
          )}
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
            {/* Boton "Exportar Excel" se eliminó: los 2 exports (Layout y
                Ocupacion) ahora viven en el header de PropuestasPage para
                que esten juntos y mas visibles. */}
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
