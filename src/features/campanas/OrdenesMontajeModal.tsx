import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, Download, Filter, ChevronDown, ChevronUp, Calendar, Loader2, FileSpreadsheet,
  Building2, Users, ClipboardList
} from 'lucide-react';
import { campanasService, OrdenMontajeCAT, OrdenMontajeINVIAN } from '../../services/campanas.service';
import { solicitudesService } from '../../services/solicitudes.service';
import { Catorcena } from '../../types';
import * as XLSX from 'xlsx';

interface OrdenesMontajeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'cat' | 'invian';

// Status options for filter
const STATUS_OPTIONS = ['activa', 'inactiva', 'finalizada', 'por iniciar', 'en curso'];

// Helper to get initials for avatar
function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

// Helper to get avatar color based on name
function getAvatarColor(name: string | null): string {
  if (!name) return 'bg-zinc-600';
  const colors = [
    'bg-purple-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-pink-500'
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// Format date helper
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function OrdenesMontajeModal({ isOpen, onClose }: OrdenesMontajeModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('cat');
  const contentRef = useRef<HTMLDivElement>(null);

  // Filters
  const [status, setStatus] = useState('');
  const [yearInicio, setYearInicio] = useState<number | undefined>(undefined);
  const [yearFin, setYearFin] = useState<number | undefined>(undefined);
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>(undefined);
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  // Grouping for CAT
  const [groupByCAT, setGroupByCAT] = useState<string>('');

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Get catorcenas for filter
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
  });

  // Query for CAT data
  const { data: catData, isLoading: isLoadingCAT } = useQuery({
    queryKey: ['ordenes-montaje-cat', status, yearInicio, yearFin, catorcenaInicio, catorcenaFin],
    queryFn: () => campanasService.getOrdenMontajeCAT({
      status: status || undefined,
      yearInicio,
      yearFin,
      catorcenaInicio,
      catorcenaFin,
    }),
    enabled: isOpen && activeTab === 'cat',
  });

  // Query for INVIAN data
  const { data: invianData, isLoading: isLoadingINVIAN } = useQuery({
    queryKey: ['ordenes-montaje-invian', status, yearInicio, yearFin, catorcenaInicio, catorcenaFin],
    queryFn: () => campanasService.getOrdenMontajeINVIAN({
      status: status || undefined,
      yearInicio,
      yearFin,
      catorcenaInicio,
      catorcenaFin,
    }),
    enabled: isOpen && activeTab === 'invian',
  });

  const years = catorcenasData?.years || [];

  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio) return [];
    const catorcenas = catorcenasData.data.filter((c: Catorcena) => c.a_o === yearInicio);
    if (yearInicio === yearFin && catorcenaFin) {
      return catorcenas.filter((c: Catorcena) => c.numero_catorcena <= catorcenaFin);
    }
    return catorcenas;
  }, [catorcenasData, yearInicio, yearFin, catorcenaFin]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearFin) return [];
    const catorcenas = catorcenasData.data.filter((c: Catorcena) => c.a_o === yearFin);
    if (yearInicio === yearFin && catorcenaInicio) {
      return catorcenas.filter((c: Catorcena) => c.numero_catorcena >= catorcenaInicio);
    }
    return catorcenas;
  }, [catorcenasData, yearFin, yearInicio, catorcenaInicio]);

  // Group CAT data
  const groupedCATData = useMemo(() => {
    if (!catData || !groupByCAT) return null;

    const groups: Record<string, OrdenMontajeCAT[]> = {};
    catData.forEach(item => {
      let key = 'Sin asignar';
      if (groupByCAT === 'plaza') key = item.plaza || 'Sin plaza';
      else if (groupByCAT === 'tipo') key = item.tipo || 'Sin tipo';
      else if (groupByCAT === 'cliente') key = item.cliente || 'Sin cliente';
      else if (groupByCAT === 'campania') key = item.campania || 'Sin campaña';
      else if (groupByCAT === 'articulo') key = item.numero_articulo || 'Sin artículo';

      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [catData, groupByCAT]);

  // Calculate totals - ensure numeric addition
  const catTotals = useMemo(() => {
    if (!catData || catData.length === 0) return { caras: 0, tarifa: 0, monto: 0 };
    return {
      caras: catData.reduce((sum, i) => sum + (Number(i.caras) || 0), 0),
      tarifa: catData.reduce((sum, i) => sum + (Number(i.tarifa) || 0), 0),
      monto: catData.reduce((sum, i) => sum + (Number(i.monto_total) || 0), 0),
    };
  }, [catData]);

  // Export to XLSX
  const handleExportXLSX = () => {
    if (activeTab === 'cat' && catData) {
      const wsData = catData.map(item => ({
        'Plaza': item.plaza || '',
        'Tipo': item.tipo || '',
        'Asesor': item.asesor || '',
        'APS': item.aps_especifico || '',
        'Fecha Inicio': item.fecha_inicio_periodo ? formatDate(item.fecha_inicio_periodo) : '',
        'Fecha Fin': item.fecha_fin_periodo ? formatDate(item.fecha_fin_periodo) : '',
        'Cliente': item.cliente || '',
        'Marca': item.marca || '',
        'Campaña': item.campania || '',
        'Artículo': item.numero_articulo || '',
        'Negociación': item.negociacion || '',
        'Caras': Number(item.caras) || 0,
        'Tarifa': Number(item.tarifa) || 0,
        'Monto Total': Number(item.monto_total) || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orden Montaje CAT');
      XLSX.writeFile(wb, `orden_montaje_cat_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'invian' && invianData) {
      const wsData = invianData.map(item => ({
        'Campaña': item.Campania || '',
        'Anunciante': item.Anunciante || '',
        'Operación': item.Operacion || '',
        'Código de contrato (Opcional)': item.CodigoContrato || '',
        'Precio por cara (Opcional)': Number(item.PrecioPorCara) || 0,
        'Vendedor': item.Vendedor || '',
        'Descripción (Opcional)': item.Descripcion || '',
        'Inicio o Periodo': item.InicioPeriodo || '',
        'Fin o Segmento': item.FinSegmento || '',
        'Arte': item.Arte || '',
        'Código de arte (Opcional)': item.CodigoArte || '',
        'Arte Url (Opcional)': item.ArteUrl || '',
        'Origen del arte (Opcional)': item.OrigenArte || '',
        'Unidad': item.Unidad || '',
        'Cara': item.Cara || '',
        'Ciudad': item.Ciudad || '',
        'Tipo de Distribución': item.TipoDistribucion || '',
        'Reproducciones': item.Reproducciones || '',
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orden Montaje INVIAN');
      XLSX.writeFile(wb, `orden_montaje_invian_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  const clearFilters = () => {
    setStatus('');
    setYearInicio(undefined);
    setYearFin(undefined);
    setCatorcenaInicio(undefined);
    setCatorcenaFin(undefined);
    setGroupByCAT('');
  };

  if (!isOpen) return null;

  const isLoading = activeTab === 'cat' ? isLoadingCAT : isLoadingINVIAN;
  const dataCount = activeTab === 'cat' ? (catData?.length || 0) : (invianData?.length || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[95vw] max-w-7xl h-[90vh] bg-zinc-900 rounded-2xl border border-purple-500/30 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Órdenes de Montaje</h2>
              <p className="text-xs text-zinc-400">Gestión y exportación de órdenes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs - Redesigned */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/80">
          <div className="flex p-1 bg-zinc-800/80 rounded-xl border border-zinc-700/50">
            <button
              onClick={() => setActiveTab('cat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'cat'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Building2 className="h-4 w-4" />
              CAT - Ocupación
            </button>
            <button
              onClick={() => setActiveTab('invian')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'invian'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              INVIAN QEB
            </button>
          </div>

          <div className="flex-1" />

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              showFilters
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtros
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {/* Data count */}
          <span className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-medium border border-purple-500/30">
            {dataCount} registros
          </span>

          {/* Export button */}
          <button
            onClick={handleExportXLSX}
            disabled={isLoading || dataCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Download className="h-4 w-4" />
            Exportar XLSX
          </button>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="px-6 py-3 border-b border-zinc-800/50 bg-zinc-800/30 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-wrap items-center gap-3">
              {/* Status */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 min-w-[140px]"
                >
                  <option value="">Todos</option>
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="h-8 w-px bg-zinc-700" />

              {/* Year Inicio */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Período Inicio
                </span>
                <div className="flex gap-2">
                  <select
                    value={yearInicio || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      setYearInicio(val);
                      setCatorcenaInicio(undefined);
                    }}
                    className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  >
                    <option value="">Año</option>
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select
                    value={catorcenaInicio || ''}
                    onChange={(e) => setCatorcenaInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                    disabled={!yearInicio}
                    className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                  >
                    <option value="">Cat.</option>
                    {catorcenasInicioOptions.map((c: Catorcena) => (
                      <option key={c.id} value={c.numero_catorcena}>{c.numero_catorcena}</option>
                    ))}
                  </select>
                </div>
              </div>

              <span className="text-zinc-600 text-lg">→</span>

              {/* Year Fin */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Período Fin
                </span>
                <div className="flex gap-2">
                  <select
                    value={yearFin || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      setYearFin(val);
                      setCatorcenaFin(undefined);
                    }}
                    className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  >
                    <option value="">Año</option>
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select
                    value={catorcenaFin || ''}
                    onChange={(e) => setCatorcenaFin(e.target.value ? parseInt(e.target.value) : undefined)}
                    disabled={!yearFin}
                    className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                  >
                    <option value="">Cat.</option>
                    {catorcenasFinOptions.map((c: Catorcena) => (
                      <option key={c.id} value={c.numero_catorcena}>{c.numero_catorcena}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Group by (only for CAT) */}
              {activeTab === 'cat' && (
                <>
                  <div className="h-8 w-px bg-zinc-700" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Agrupar por</span>
                    <select
                      value={groupByCAT}
                      onChange={(e) => setGroupByCAT(e.target.value)}
                      className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 min-w-[120px]"
                    >
                      <option value="">Sin agrupar</option>
                      <option value="tipo">Tipo</option>
                      <option value="plaza">Plaza</option>
                      <option value="cliente">Cliente</option>
                      <option value="campania">Campaña</option>
                      <option value="articulo">Artículo</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex-1" />

              {/* Clear filters */}
              <button
                onClick={clearFilters}
                className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-auto"
          style={{ overscrollBehavior: 'contain' }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
            </div>
          ) : activeTab === 'cat' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 backdrop-blur-sm">
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Plaza</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Tipo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Asesor</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">APS</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">F. Inicio</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">F. Fin</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Cliente</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Marca</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Campaña</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Artículo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Negociación</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Caras</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Tarifa</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCATData ? (
                    groupedCATData.map(([groupName, items]) => (
                      <React.Fragment key={groupName}>
                        <tr className="bg-purple-500/10 border-b border-purple-500/20">
                          <td colSpan={14} className="px-4 py-2">
                            <span className="font-semibold text-white text-sm">{groupName}</span>
                            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300">
                              {items.length} registros
                            </span>
                            <span className="ml-2 text-xs text-zinc-400">
                              Caras: {items.reduce((sum, i) => sum + (Number(i.caras) || 0), 0).toLocaleString()}
                            </span>
                            <span className="ml-2 text-xs text-emerald-400">
                              Total: ${items.reduce((sum, i) => sum + (Number(i.monto_total) || 0), 0).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                        {items.map((item, idx) => (
                          <CATRow key={`${groupName}-${idx}`} item={item} />
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    catData?.map((item, idx) => (
                      <CATRow key={idx} item={item} />
                    ))
                  )}
                  {(!catData || catData.length === 0) && (
                    <tr>
                      <td colSpan={14} className="px-4 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                          <ClipboardList className="w-8 h-8 text-purple-400" />
                        </div>
                        <p className="text-zinc-500">No se encontraron registros</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {catData && catData.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm">
                    <tr className="border-t-2 border-purple-500/40">
                      <td colSpan={11} className="px-3 py-3 text-right text-sm font-semibold text-purple-300">
                        Totales:
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-white">
                        {catTotals.caras.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-white">
                        ${catTotals.tarifa.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-emerald-400">
                        ${catTotals.monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 backdrop-blur-sm">
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Campaña</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Anunciante</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Operación</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Cód. Contrato</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Precio/Cara</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Vendedor</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Inicio/Periodo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Fin/Segmento</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Arte</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Unidad</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Cara</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Ciudad</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Tipo Dist.</th>
                  </tr>
                </thead>
                <tbody>
                  {invianData?.map((item, idx) => (
                    <INVIANRow key={idx} item={item} />
                  ))}
                  {(!invianData || invianData.length === 0) && (
                    <tr>
                      <td colSpan={13} className="px-4 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                          <FileSpreadsheet className="w-8 h-8 text-purple-400" />
                        </div>
                        <p className="text-zinc-500">No se encontraron registros</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Row components
function CATRow({ item }: { item: OrdenMontajeCAT }) {
  const negociacionColor = item.negociacion === 'BONIFICACION'
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
      <td className="px-3 py-2 text-xs text-zinc-300">{item.plaza || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-300">{item.tipo || '-'}</td>
      <td className="px-3 py-2">
        {item.asesor ? (
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full ${getAvatarColor(item.asesor)} flex items-center justify-center text-[10px] font-bold text-white`}>
              {getInitials(item.asesor)}
            </div>
            <span className="text-xs text-zinc-300 truncate max-w-[100px]" title={item.asesor}>{item.asesor}</span>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-purple-300 font-mono">{item.aps_especifico || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-400">{formatDate(item.fecha_inicio_periodo)}</td>
      <td className="px-3 py-2 text-xs text-zinc-400">{formatDate(item.fecha_fin_periodo)}</td>
      <td className="px-3 py-2 text-xs text-zinc-300 max-w-[120px] truncate" title={item.cliente || ''}>{item.cliente || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-300">{item.marca || '-'}</td>
      <td className="px-3 py-2 text-xs text-white font-medium max-w-[150px] truncate" title={item.campania || ''}>{item.campania || '-'}</td>
      <td className="px-3 py-2 text-xs text-violet-300 font-mono">{item.numero_articulo || '-'}</td>
      <td className="px-3 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${negociacionColor}`}>
          {item.negociacion}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-right text-white font-medium">{Number(item.caras) || 0}</td>
      <td className="px-3 py-2 text-xs text-right text-zinc-300">${(Number(item.tarifa) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="px-3 py-2 text-xs text-right text-emerald-400 font-medium">${(Number(item.monto_total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  );
}

function INVIANRow({ item }: { item: OrdenMontajeINVIAN }) {
  const operacionColor = item.Operacion === 'BONIFICACION'
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
      <td className="px-3 py-2 text-xs text-white font-medium max-w-[140px] truncate" title={item.Campania || ''}>{item.Campania || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-300 max-w-[120px] truncate" title={item.Anunciante || ''}>{item.Anunciante || '-'}</td>
      <td className="px-3 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${operacionColor}`}>
          {item.Operacion || '-'}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-zinc-400 font-mono">{item.CodigoContrato || '-'}</td>
      <td className="px-3 py-2 text-xs text-right text-emerald-400 font-medium">${(Number(item.PrecioPorCara) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="px-3 py-2">
        {item.Vendedor ? (
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full ${getAvatarColor(item.Vendedor)} flex items-center justify-center text-[10px] font-bold text-white`}>
              {getInitials(item.Vendedor)}
            </div>
            <span className="text-xs text-zinc-300 truncate max-w-[80px]" title={item.Vendedor}>{item.Vendedor}</span>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-purple-300">{item.InicioPeriodo || '-'}</td>
      <td className="px-3 py-2 text-xs text-purple-300">{item.FinSegmento || '-'}</td>
      <td className="px-3 py-2 text-xs text-cyan-300">{item.Arte || '-'}</td>
      <td className="px-3 py-2 text-xs text-violet-300 font-mono">{item.Unidad || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-300">{item.Cara || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-300">{item.Ciudad || '-'}</td>
      <td className="px-3 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${operacionColor}`}>
          {item.TipoDistribucion || '-'}
        </span>
      </td>
    </tr>
  );
}
