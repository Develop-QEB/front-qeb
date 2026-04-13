import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Calendar, Loader2, Download, Package, ClipboardList, MapPin, DollarSign, Layers } from 'lucide-react';
import { propuestasService } from '../../services/propuestas.service';

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
  campana_nombre: string;
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

interface CatorcenaGroup {
  key: string;
  num: number;
  anio: number;
  propuestas: PropuestaGroupItem[];
}

interface PropuestaGroupItem {
  info: PropuestaInfo;
  circuitos: CircuitoGroupItem[];
}

interface CircuitoGroupItem {
  cara: CaraInfo;
  inventarios: InventarioItem[];
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

export default function PropuestasVersionarioView({ isDark, filters }: PropuestasVersionarioViewProps) {
  const [expandedCatorcenas, setExpandedCatorcenas] = useState<Set<string>>(new Set());
  const [expandedPropuestas, setExpandedPropuestas] = useState<Set<number>>(new Set());
  const [expandedCircuitos, setExpandedCircuitos] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['propuestas-versionario', filters],
    queryFn: () => propuestasService.getVersionarioData(filters),
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const catorcenaGroups = useMemo<CatorcenaGroup[]>(() => {
    if (!data) return [];

    const { inventarios, propuestasInfo, carasInfo } = data;

    // Build a map: propuesta_id -> PropuestaInfo
    const propuestaMap = new Map<number, PropuestaInfo>();
    for (const p of propuestasInfo) {
      propuestaMap.set(p.propuesta_id, p);
    }

    // Build a map: catorcena key -> propuesta_id -> sc_id -> inventarios
    const catorcenaMap = new Map<string, Map<number, Map<number, InventarioItem[]>>>();

    for (const inv of inventarios) {
      const catKey = `${inv.numero_catorcena}-${inv.anio_catorcena}`;
      if (!catorcenaMap.has(catKey)) catorcenaMap.set(catKey, new Map());
      const propMap = catorcenaMap.get(catKey)!;
      if (!propMap.has(inv.propuesta_id)) propMap.set(inv.propuesta_id, new Map());
      const scMap = propMap.get(inv.propuesta_id)!;
      const scId = inv.solicitud_caras_id || 0;
      if (!scMap.has(scId)) scMap.set(scId, []);
      scMap.get(scId)!.push(inv);
    }

    // Build a map: catorcena key -> propuesta_id -> sc_id -> CaraInfo
    const caraMap = new Map<string, Map<number, Map<number, CaraInfo>>>();
    for (const c of carasInfo) {
      const catKey = `${c.numero_catorcena}-${c.anio_catorcena}`;
      if (!caraMap.has(catKey)) caraMap.set(catKey, new Map());
      const propMap = caraMap.get(catKey)!;
      if (!propMap.has(c.propuesta_id)) propMap.set(c.propuesta_id, new Map());
      propMap.get(c.propuesta_id)!.set(c.sc_id, c);
    }

    // Collect all catorcena keys from both inventarios and carasInfo
    const allCatKeys = new Set<string>();
    catorcenaMap.forEach((_, k) => allCatKeys.add(k));
    caraMap.forEach((_, k) => allCatKeys.add(k));

    // Build groups
    const groups: CatorcenaGroup[] = [];
    for (const catKey of allCatKeys) {
      const [numStr, anioStr] = catKey.split('-');
      const num = parseInt(numStr, 10);
      const anio = parseInt(anioStr, 10);
      if (isNaN(num) || isNaN(anio)) continue;

      // Gather all propuesta_ids for this catorcena from both maps
      const propIdsFromInv = catorcenaMap.get(catKey);
      const propIdsFromCaras = caraMap.get(catKey);
      const allPropIds = new Set<number>();
      if (propIdsFromInv) propIdsFromInv.forEach((_, pid) => allPropIds.add(pid));
      if (propIdsFromCaras) propIdsFromCaras.forEach((_, pid) => allPropIds.add(pid));

      const propuestas: PropuestaGroupItem[] = [];
      for (const pid of allPropIds) {
        const info = propuestaMap.get(pid);
        if (!info) continue;
        // Excluir propuestas aprobadas (ya son campañas)
        if (info.status === 'Aprobada') continue;

        // Build circuitos from carasInfo
        const carasForProp = propIdsFromCaras?.get(pid);
        const invForProp = propIdsFromInv?.get(pid);

        // Collect all sc_ids from both sources
        const allScIds = new Set<number>();
        if (carasForProp) carasForProp.forEach((_, scId) => allScIds.add(scId));
        if (invForProp) invForProp.forEach((_, scId) => allScIds.add(scId));

        const circuitos: CircuitoGroupItem[] = [];
        for (const scId of allScIds) {
          const cara = carasForProp?.get(scId);
          const invItems = invForProp?.get(scId) || [];

          if (cara) {
            circuitos.push({ cara, inventarios: invItems });
          } else if (invItems.length > 0) {
            // Build a synthetic cara from inventory data
            const firstInv = invItems[0];
            circuitos.push({
              cara: {
                propuesta_id: pid,
                sc_id: scId,
                articulo: firstInv.articulo || '',
                ciudad: firstInv.plaza || '',
                formato: firstInv.formato || '',
                caras_solicitadas: 0,
                bonificacion: 0,
                caras_esperadas: invItems.length,
                reservas_count: invItems.filter(i => i.estatus_reserva === 'reservado').length,
                numero_catorcena: num,
                anio_catorcena: anio,
              },
              inventarios: invItems,
            });
          }
        }

        propuestas.push({ info, circuitos });
      }

      // Sort propuestas by name
      propuestas.sort((a, b) => (a.info.campana_nombre || '').localeCompare(b.info.campana_nombre || ''));

      if (propuestas.length > 0) {
        groups.push({ key: catKey, num, anio, propuestas });
      }
    }

    // Sort groups by year then catorcena number
    groups.sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.num - b.num);

    // Filtrar catorcenas fuera del rango seleccionado
    if (filters.yearInicio && filters.yearFin && filters.catorcenaInicio && filters.catorcenaFin) {
      const rangeStart = filters.yearInicio * 100 + filters.catorcenaInicio;
      const rangeEnd = filters.yearFin * 100 + filters.catorcenaFin;
      return groups.filter(g => {
        const val = g.anio * 100 + g.num;
        return val >= rangeStart && val <= rangeEnd;
      });
    }

    return groups;
  }, [data, filters.yearInicio, filters.yearFin, filters.catorcenaInicio, filters.catorcenaFin]);

  // Toggle helpers
  const toggleCatorcena = (key: string) => {
    setExpandedCatorcenas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const togglePropuesta = (id: number) => {
    setExpandedPropuestas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCircuito = (key: string) => {
    setExpandedCircuitos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Count totals
  const totalPropuestas = useMemo(() => {
    const ids = new Set<number>();
    catorcenaGroups.forEach(g => g.propuestas.forEach(p => ids.add(p.info.propuesta_id)));
    return ids.size;
  }, [catorcenaGroups]);

  // CSV Export
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const headers = [
        'Campaña', 'Anunciante', 'Inversión Campaña', 'Operación', 'Código de contrato (Opcional)',
        'Precio por cara (Opcional)', 'APS Global', 'CUIC', 'Articulo', 'Vendedor',
        'Descripción (Opcional)', 'Inicio o Periodo', 'Fin o Segmento', 'Arte',
        'Código de arte (Opcional)', 'Arte Url (Opcional)', 'Origen del arte (Opcional)',
        'Unidad', 'Cara', 'Ciudad', 'Tipo de Distribución', 'Reproducciones', 'Notas',
      ];

      const rows: string[][] = [];

      for (const group of catorcenaGroups) {
        for (const prop of group.propuestas) {
          const info = prop.info;
          for (const circ of prop.circuitos) {
            if (circ.inventarios.length > 0) {
              for (const inv of circ.inventarios) {
                rows.push([
                  info.campana_nombre || '',
                  info.anunciante || '',
                  String(info.inversion || ''),
                  '',
                  '',
                  String(inv.tarifa_publica_sc || ''),
                  '',
                  info.cuic || '',
                  inv.articulo || '',
                  info.vendedor || '',
                  info.descripcion || '',
                  `Cat ${info.catorcena_inicio_num}/${info.catorcena_inicio_anio}`,
                  `Cat ${info.catorcena_fin_num}/${info.catorcena_fin_anio}`,
                  '',
                  '',
                  '',
                  '',
                  inv.codigo_unico || '',
                  inv.tipo_de_cara || '',
                  inv.plaza || '',
                  inv.tradicional_digital || '',
                  '',
                  '',
                ]);
              }
            } else {
              rows.push([
                info.campana_nombre || '',
                info.anunciante || '',
                String(info.inversion || ''),
                '',
                '',
                '',
                '',
                info.cuic || '',
                circ.cara.articulo || '',
                info.vendedor || '',
                info.descripcion || '',
                `Cat ${info.catorcena_inicio_num}/${info.catorcena_inicio_anio}`,
                `Cat ${info.catorcena_fin_num}/${info.catorcena_fin_anio}`,
                '',
                '',
                '',
                '',
                '',
                '',
                circ.cara.ciudad || '',
                '',
                '',
                '',
              ]);
            }
          }
        }
      }

      const escapeCSV = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(',')),
      ].join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `propuestas_versionario_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

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
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Desglose de Propuestas</h3>
              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Propuestas desglosadas por catorcena</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{catorcenaGroups.length}</p>
              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wide`}>Catorcenas</p>
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
      ) : catorcenaGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} mb-4`}>
            <Calendar className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          </div>
          <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>No hay datos</p>
        </div>
      ) : (
        <div className={`divide-y ${isDark ? 'divide-zinc-800/30' : 'divide-gray-200'}`}>
          {catorcenaGroups.map(group => (
            <div key={group.key} className="group">
              {/* Catorcena Header */}
              <button
                onClick={() => toggleCatorcena(group.key)}
                className={`w-full flex items-center gap-3 px-5 py-4 transition-all ${
                  isDark ? 'bg-zinc-800/30 hover:bg-zinc-800/50' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {expandedCatorcenas.has(group.key) ? (
                  <ChevronDown className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                ) : (
                  <ChevronRight className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                )}
                <Calendar className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>
                  Cat {group.num} / {group.anio}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs ${isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200'} border`}>
                  {group.propuestas.length} propuesta{group.propuestas.length !== 1 ? 's' : ''}
                </span>
                {/* Total investment for catorcena */}
                {(() => {
                  const totalInversion = group.propuestas.reduce((s, p) => s + (Number(p.info.inversion) || 0), 0);
                  return totalInversion > 0 ? (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-green-500/15 text-green-300' : 'bg-green-50 text-green-700'} border border-green-500/25 flex items-center gap-1`}>
                      <DollarSign className="h-3 w-3" /> ${totalInversion.toLocaleString()}
                    </span>
                  ) : null;
                })()}
              </button>

              {/* Catorcena Content - Propuestas */}
              {expandedCatorcenas.has(group.key) && (
                <div className={isDark ? 'bg-zinc-900/50' : 'bg-white'}>
                  {group.propuestas.map(prop => {
                    const info = prop.info;
                    const statusColor = getStatusColor(info.status, isDark);
                    const isExpanded = expandedPropuestas.has(info.propuesta_id);
                    const circuitosCount = prop.circuitos.length;

                    return (
                      <div key={info.propuesta_id} className={`border-t ${isDark ? 'border-zinc-800/30' : 'border-gray-200'}`}>
                        {/* Propuesta Row */}
                        <button
                          onClick={() => togglePropuesta(info.propuesta_id)}
                          className={`w-full flex items-center gap-3 px-6 py-3 ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50'} transition-all`}
                        >
                          {isExpanded ? (
                            <ChevronDown className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
                          ) : (
                            <ChevronRight className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
                          )}
                          <Package className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'} text-sm flex-1 text-left truncate`}>
                            {info.campana_nombre || info.descripcion || `Propuesta #${info.propuesta_id}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
                            {info.status}
                          </span>
                          {info.anunciante && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'} border border-cyan-500/25`}>
                              {info.anunciante}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-green-500/15 text-green-300' : 'bg-green-50 text-green-700'} border border-green-500/25 flex items-center gap-1`}>
                            <DollarSign className="h-3 w-3" />
                            {Number(info.inversion) > 0 ? `$${Number(info.inversion).toLocaleString()}` : 'Sin inversión'}
                          </span>
                          {circuitosCount > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'} border border-blue-500/25 flex items-center gap-1`}>
                              <Layers className="h-3 w-3" /> {circuitosCount} circuito{circuitosCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </button>

                        {/* Propuesta Expanded - Circuitos */}
                        {isExpanded && (
                          <div className={`${isDark ? 'bg-zinc-950/50' : 'bg-gray-50'} px-8 py-3`}>
                            {prop.circuitos.length === 0 ? (
                              <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Sin circuitos asignados</p>
                            ) : (
                              <div className="space-y-1">
                                {prop.circuitos.map(circ => {
                                  const circKey = `${info.propuesta_id}-${circ.cara.sc_id}`;
                                  const isCircExpanded = expandedCircuitos.has(circKey);
                                  const hasInventarios = circ.inventarios.length > 0;
                                  const reserved = circ.cara.reservas_count || 0;
                                  const expected = circ.cara.caras_esperadas || 0;
                                  const counterFull = expected > 0 && reserved >= expected;

                                  return (
                                    <div key={circKey} className={`border-l-2 ${isDark ? 'border-zinc-700' : 'border-gray-300'} pl-2`}>
                                      <div
                                        onClick={() => hasInventarios && toggleCircuito(circKey)}
                                        className={`w-full flex items-center gap-2 py-1.5 text-left ${hasInventarios ? (isDark ? 'hover:bg-zinc-800/30 cursor-pointer' : 'hover:bg-gray-100 cursor-pointer') : ''} rounded px-1 flex-wrap`}
                                      >
                                        {hasInventarios ? (
                                          isCircExpanded ? (
                                            <ChevronDown className={`h-3 w-3 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                                          ) : (
                                            <ChevronRight className={`h-3 w-3 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                                          )
                                        ) : (
                                          <span className="w-3" />
                                        )}
                                        <ClipboardList className={`h-3 w-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                        <span className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                                          {[circ.cara.articulo, circ.cara.formato, circ.cara.ciudad].filter(Boolean).join(' · ') || `Circuito #${circ.cara.sc_id}`}
                                        </span>
                                        {/* Reserved/Expected counter badge */}
                                        {expected > 0 && (
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border flex items-center gap-1 ${
                                            counterFull
                                              ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                              : isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200'
                                          }`}>
                                            {reserved}/{expected}
                                          </span>
                                        )}
                                        {circ.cara.bonificacion > 0 && (
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'} border border-amber-500/25`}>
                                            Bonif: {circ.cara.bonificacion}
                                          </span>
                                        )}
                                      </div>

                                      {/* Circuito Expanded - Inventory Items */}
                                      {isCircExpanded && hasInventarios && (
                                        <div className="pl-5 py-1 space-y-0.5">
                                          {circ.inventarios.map((inv, idx) => (
                                            <div key={`${inv.codigo_unico}-${idx}`} className={`flex items-center gap-2 text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} py-0.5 flex-wrap`}>
                                              <MapPin className={`h-2.5 w-2.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
                                              <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} font-mono`}>{inv.codigo_unico}</span>
                                              <span className={isDark ? 'text-zinc-600' : 'text-gray-300'}>|</span>
                                              <span>{inv.tipo_de_cara || 'Sin tipo'}</span>
                                              <span className={isDark ? 'text-zinc-600' : 'text-gray-300'}>|</span>
                                              <span>{inv.plaza || 'Sin plaza'}</span>
                                              <span className={isDark ? 'text-zinc-600' : 'text-gray-300'}>|</span>
                                              {inv.estatus_reserva && (
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                                  inv.estatus_reserva === 'reservado'
                                                    ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : isDark ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' : 'bg-gray-100 text-gray-500 border-gray-300'
                                                } border`}>
                                                  {inv.estatus_reserva}
                                                </span>
                                              )}
                                              {Number(inv.tarifa_publica_sc) > 0 && (
                                                <span className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                                  ${Number(inv.tarifa_publica_sc).toLocaleString()}
                                                </span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {!isLoading && catorcenaGroups.length > 0 && (
        <div className={`flex items-center justify-between px-5 py-3 border-t ${isDark ? 'border-zinc-800/50 bg-zinc-900/30 text-zinc-500' : 'border-gray-200 bg-gray-50 text-gray-400'} text-xs`}>
          <span>
            {catorcenaGroups.length} catorcena{catorcenaGroups.length !== 1 ? 's' : ''} · {totalPropuestas} propuesta{totalPropuestas !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
