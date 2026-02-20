import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Map, List, History, X, Loader2, AlertCircle, Calendar as CalendarIcon,
  Plus, Edit2, Ban, CheckCircle, Package, MapPin, DollarSign, ChevronDown, ChevronRight,
  Eye, EyeOff, ArrowUp, ArrowDown, ArrowUpDown, SlidersHorizontal, Monitor, Ruler
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { inventariosService } from '../../services/inventarios.service';
import { Inventario } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { InventarioMap } from './InventarioMap';

const ESTATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Disponible: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  Reservado: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  Ocupado: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  Mantenimiento: { bg: 'bg-zinc-500/20', text: 'text-zinc-300', border: 'border-zinc-500/30' },
  Bloqueado: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
};
const DEFAULT_ESTATUS = { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' };

const EMPTY_FORM: Record<string, string> = {
  codigo_unico: '', ubicacion: '', tipo_de_cara: '', cara: '', mueble: '',
  latitud: '', longitud: '', plaza: '', estado: '', municipio: '', cp: '',
  tradicional_digital: '', sentido: '', tipo_de_mueble: '', ancho: '', alto: '',
  nivel_socioeconomico: '', total_espacios: '', estatus: 'Disponible', codigo: '',
  isla: '', mueble_isla: '', entre_calle_1: '', entre_calle_2: '', orientacion: '',
  tarifa_piso: '', tarifa_publica: '',
};

type SortCol = 'id' | 'codigo_unico' | 'tipo_de_mueble' | 'plaza' | 'estatus' | 'tarifa_publica';

// FilterChip Component matching CampanasPage style
function FilterChip({ label, options, value, onChange, onClear }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [options, searchTerm]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${value
          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
          : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
        }`}
      >
        <span>{value || label}</span>
        {value ? (
          <X className="h-3 w-3 hover:text-white" onClick={(e) => { e.stopPropagation(); onClear(); }} />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearchTerm(''); }} />
          <div className="absolute top-full left-0 mt-1.5 z-50 w-64 rounded-xl border border-purple-500/20 bg-zinc-900 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-zinc-800">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filtered.map(opt => (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false); setSearchTerm(''); }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-purple-500/10 ${value === opt ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-300'}`}
                >
                  {opt}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-xs text-zinc-500 text-center">Sin resultados</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function InventariosPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState('');
  const [estatus, setEstatus] = useState('');
  const [plaza, setPlaza] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [sortCol, setSortCol] = useState<SortCol>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [isHistorialOpen, setIsHistorialOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const limit = 50;
  const { data, isLoading } = useQuery({
    queryKey: ['inventarios', page, search, tipo, estatus, plaza],
    queryFn: () =>
      inventariosService.getAll({ page, limit, search, tipo: tipo || undefined, estatus: estatus || undefined, plaza: plaza || undefined }),
  });

  const { data: tipos } = useQuery({ queryKey: ['inventarios', 'tipos'], queryFn: () => inventariosService.getTipos() });
  const { data: plazas } = useQuery({ queryKey: ['inventarios', 'plazas'], queryFn: () => inventariosService.getPlazas() });
  const { data: estatusList } = useQuery({ queryKey: ['inventarios', 'estatus'], queryFn: () => inventariosService.getEstatus() });

  const { data: historialData, isLoading: isLoadingHistorial } = useQuery({
    queryKey: ['inventario-historial', selectedId],
    queryFn: () => inventariosService.getHistorial(selectedId!),
    enabled: isHistorialOpen && selectedId !== null,
  });

  const toggleBlockMutation = useMutation({
    mutationFn: (id: number) => inventariosService.toggleBlock(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventarios'] }); },
  });

  // Sort
  const sortedData = useMemo(() => {
    if (!data?.data) return [];
    const arr = [...data.data];
    arr.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortCol) {
        case 'id': aVal = a.id; bVal = b.id; break;
        case 'codigo_unico': aVal = a.codigo_unico || ''; bVal = b.codigo_unico || ''; break;
        case 'tipo_de_mueble': aVal = a.tipo_de_mueble || ''; bVal = b.tipo_de_mueble || ''; break;
        case 'plaza': aVal = a.plaza || ''; bVal = b.plaza || ''; break;
        case 'estatus': aVal = a.estatus || ''; bVal = b.estatus || ''; break;
        case 'tarifa_publica': aVal = a.tarifa_publica || 0; bVal = b.tarifa_publica || 0; break;
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
    return arr;
  }, [data?.data, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 text-zinc-600 ml-1" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-purple-400 ml-1" /> : <ArrowDown className="h-3 w-3 text-purple-400 ml-1" />;
  };

  const openEdit = (item: Inventario) => {
    setFormData({
      codigo_unico: item.codigo_unico || '', ubicacion: item.ubicacion || '', tipo_de_cara: item.tipo_de_cara || '',
      cara: item.cara || '', mueble: item.mueble || '', latitud: String(item.latitud || ''), longitud: String(item.longitud || ''),
      plaza: item.plaza || '', estado: item.estado || '', municipio: item.municipio || '', cp: item.cp ? String(item.cp) : '',
      tradicional_digital: item.tradicional_digital || '', sentido: item.sentido || '', tipo_de_mueble: item.tipo_de_mueble || '',
      ancho: String(item.ancho || ''), alto: String(item.alto || ''), nivel_socioeconomico: item.nivel_socioeconomico || '',
      total_espacios: item.total_espacios ? String(item.total_espacios) : '', estatus: item.estatus || 'Disponible',
      codigo: item.codigo || '', isla: item.isla || '', mueble_isla: item.mueble_isla || '',
      entre_calle_1: item.entre_calle_1 || '', entre_calle_2: item.entre_calle_2 || '', orientacion: item.orientacion || '',
      tarifa_piso: item.tarifa_piso ? String(item.tarifa_piso) : '', tarifa_publica: item.tarifa_publica ? String(item.tarifa_publica) : '',
    });
    setSelectedId(item.id);
    setIsEditOpen(true);
  };

  const openCreate = () => { setFormData({ ...EMPTY_FORM }); setIsCreateOpen(true); };

  const handleSave = async (isEdit: boolean) => {
    setSaving(true);
    try {
      if (isEdit && selectedId) await inventariosService.update(selectedId, formData);
      else await inventariosService.create(formData);
      queryClient.invalidateQueries({ queryKey: ['inventarios'] });
      setIsEditOpen(false);
      setIsCreateOpen(false);
    } catch (err) {
      console.error('Error saving:', err);
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally { setSaving(false); }
  };

  const getEstatusStyle = (est: string | null) => ESTATUS_STYLES[est || ''] || DEFAULT_ESTATUS;

  const totalPages = data?.pagination?.totalPages || 1;
  const totalItems = data?.pagination?.total || 0;
  const hasActiveFilters = !!(tipo || plaza || estatus || search);

  // Form fields for create/edit
  const FORM_FIELDS: { key: string; label: string; type?: string; options?: string[]; span?: number }[] = [
    { key: 'codigo_unico', label: 'Código Único' },
    { key: 'codigo', label: 'Código Corto' },
    { key: 'tipo_de_mueble', label: 'Tipo de Mueble' },
    { key: 'mueble', label: 'Mueble / Formato' },
    { key: 'tipo_de_cara', label: 'Tipo de Cara', options: ['Flujo', 'Contraflujo'] },
    { key: 'cara', label: 'Cara' },
    { key: 'tradicional_digital', label: 'Trad / Digital', options: ['Tradicional', 'Digital'] },
    { key: 'sentido', label: 'Sentido' },
    { key: 'ubicacion', label: 'Ubicación', span: 2 },
    { key: 'entre_calle_1', label: 'Entre Calle 1' },
    { key: 'entre_calle_2', label: 'Entre Calle 2' },
    { key: 'plaza', label: 'Plaza' },
    { key: 'estado', label: 'Estado' },
    { key: 'municipio', label: 'Municipio' },
    { key: 'cp', label: 'C.P.', type: 'number' },
    { key: 'latitud', label: 'Latitud', type: 'number' },
    { key: 'longitud', label: 'Longitud', type: 'number' },
    { key: 'ancho', label: 'Ancho (m)', type: 'number' },
    { key: 'alto', label: 'Alto (m)', type: 'number' },
    { key: 'orientacion', label: 'Orientación' },
    { key: 'nivel_socioeconomico', label: 'NSE' },
    { key: 'isla', label: 'Isla' },
    { key: 'mueble_isla', label: 'Mueble Isla' },
    { key: 'total_espacios', label: 'Total Espacios', type: 'number' },
    { key: 'tarifa_publica', label: 'Tarifa Pública', type: 'number' },
    { key: 'tarifa_piso', label: 'Tarifa Piso', type: 'number' },
    { key: 'estatus', label: 'Estatus', options: ['Disponible', 'Reservado', 'Ocupado', 'Mantenimiento', 'Bloqueado'] },
  ];

  const renderFormModal = (isEdit: boolean) => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}>
      <div className="bg-zinc-900 rounded-2xl border border-purple-500/20 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/10" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-fuchsia-900/10 to-purple-900/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              {isEdit ? <Edit2 className="h-5 w-5 text-purple-400" /> : <Plus className="h-5 w-5 text-purple-400" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{isEdit ? 'Editar Inventario' : 'Nuevo Inventario'}</h2>
              {isEdit && selectedId && <p className="text-xs text-purple-300/50">ID: #{selectedId}</p>}
            </div>
          </div>
          <button onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            {FORM_FIELDS.map(f => (
              <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                <label className="text-[10px] text-purple-300/50 uppercase tracking-wide mb-1 block">{f.label}</label>
                {f.options ? (
                  <select
                    value={formData[f.key] || ''}
                    onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                    className="w-full px-3 py-2.5 bg-zinc-800/80 border border-zinc-700/50 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all"
                  >
                    <option value="">— Seleccionar —</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type || 'text'}
                    value={formData[f.key] || ''}
                    onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                    step={f.type === 'number' ? 'any' : undefined}
                    className="w-full px-3 py-2.5 bg-zinc-800/80 border border-zinc-700/50 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all placeholder:text-zinc-600"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Footer */}
        <div className="p-5 border-t border-purple-500/20 bg-gradient-to-r from-purple-900/10 via-transparent to-fuchsia-900/10 flex justify-end gap-3">
          <button onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}
            className="px-4 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-white border border-zinc-700/50 hover:bg-zinc-800 transition-all">
            Cancelar
          </button>
          <button
            onClick={() => handleSave(isEdit)}
            disabled={saving}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Guardar Cambios' : 'Crear Inventario'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Header title="Inventarios" />

      <div className="p-6 space-y-5">
        {/* KPI Cards - Same style as CampanasPage */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total */}
          <div className="col-span-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-purple-500/20 transition-all duration-500" />
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">Total Inventarios</p>
              <h3 className="text-4xl font-bold text-white tracking-tight">
                {isLoading ? '...' : totalItems.toLocaleString()}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                {hasActiveFilters ? 'Filtrado' : 'Todos'}
              </span>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="col-span-1 md:col-span-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-5 relative overflow-hidden">
            <p className="text-zinc-400 text-sm font-medium mb-3">Distribución por Estatus (página actual)</p>
            <div className="flex flex-wrap gap-2">
              {['Disponible', 'Reservado', 'Ocupado', 'Mantenimiento', 'Bloqueado'].map(est => {
                const count = data?.data?.filter(i => i.estatus === est).length || 0;
                const style = getEstatusStyle(est);
                return (
                  <div key={est} className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-800/30 border border-zinc-800/50 min-w-[110px]">
                    <div className={`w-2 h-8 rounded-full ${style.bg.replace('/20', '')}`} style={{ backgroundColor: est === 'Disponible' ? '#10b981' : est === 'Reservado' ? '#f59e0b' : est === 'Ocupado' ? '#06b6d4' : est === 'Bloqueado' ? '#ef4444' : '#71717a' }} />
                    <div>
                      <div className="text-sm font-bold text-white">{count}</div>
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wide">{est}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bloqueados */}
          <div className="col-span-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -mr-5 -mb-5 pointer-events-none group-hover:bg-red-500/20 transition-all duration-500" />
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">Bloqueados</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-red-400">
                  {isLoading ? '...' : (data?.data?.filter(i => i.estatus === 'Bloqueado').length || 0)}
                </h3>
                <span className="text-xs text-red-500/80 font-medium">ocultos</span>
              </div>
            </div>
            <div className="mt-4 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
                style={{ width: `${data?.data?.length ? ((data.data.filter(i => i.estatus === 'Bloqueado').length / data.data.length) * 100) : 0}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-zinc-500">
              <span>Activos: {(data?.data?.length || 0) - (data?.data?.filter(i => i.estatus === 'Bloqueado').length || 0)}</span>
              <span>{data?.data?.length ? Math.round(((data.data.filter(i => i.estatus === 'Bloqueado').length) / data.data.length) * 100) : 0}%</span>
            </div>
          </div>
        </div>

        {/* Control Bar - matching CampanasPage */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl p-4 relative z-30">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 w-full lg:max-w-xl">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
                <input
                  type="search"
                  placeholder="Buscar por código, ubicación, municipio..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-purple-500/20 bg-zinc-900/80 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all hover:border-purple-500/40"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${showFilters || hasActiveFilters
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-purple-400" />}
              </button>

              {/* View Toggle */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    viewMode === 'table'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <List className="h-4 w-4" />
                  Tabla
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    viewMode === 'map'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <Map className="h-4 w-4" />
                  Mapa
                </button>
              </div>

              {/* New button */}
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-lg shadow-purple-500/20"
              >
                <Plus className="h-4 w-4" />
                Nuevo Inventario
              </button>
            </div>

            {/* Filters Row */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/50 relative z-50">
                <FilterChip label="Tipo" options={tipos || []} value={tipo} onChange={v => { setTipo(v); setPage(1); }} onClear={() => { setTipo(''); setPage(1); }} />
                <FilterChip label="Plaza" options={plazas || []} value={plaza} onChange={v => { setPlaza(v); setPage(1); }} onClear={() => { setPlaza(''); setPage(1); }} />
                <FilterChip label="Estatus" options={estatusList || []} value={estatus} onChange={v => { setEstatus(v); setPage(1); }} onClear={() => { setEstatus(''); setPage(1); }} />

                {hasActiveFilters && (
                  <button
                    onClick={() => { setSearch(''); setTipo(''); setPlaza(''); setEstatus(''); setPage(1); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
                  >
                    <X className="h-3 w-3" /> Limpiar todo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Results Badge */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
              <Package className="h-3.5 w-3.5" />
              {totalItems} resultados
            </div>
          </div>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl overflow-hidden shadow-xl shadow-purple-500/5">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : sortedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Package className="h-6 w-6 text-purple-400" />
                </div>
                <p className="text-zinc-400 text-sm">No se encontraron inventarios</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30">
                        {[
                          { col: 'id' as SortCol, label: 'ID', sortable: true },
                          { col: 'codigo_unico' as SortCol, label: 'Código', sortable: true },
                          { col: 'tipo_de_mueble' as SortCol, label: 'Tipo', sortable: true },
                          { col: '' as SortCol, label: 'Ubicación', sortable: false },
                          { col: 'plaza' as SortCol, label: 'Plaza', sortable: true },
                          { col: '' as SortCol, label: 'Cara', sortable: false },
                          { col: '' as SortCol, label: 'Dimensiones', sortable: false },
                          { col: 'tarifa_publica' as SortCol, label: 'Tarifa', sortable: true },
                          { col: 'estatus' as SortCol, label: 'Estatus', sortable: true },
                        ].map(({ col, label, sortable }) => (
                          <th
                            key={label}
                            onClick={sortable ? () => handleSort(col) : undefined}
                            className={`px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider ${sortable ? 'cursor-pointer hover:text-purple-200' : ''}`}
                          >
                            <span className="flex items-center">
                              {label}
                              {sortable && <SortIcon col={col} />}
                            </span>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center text-xs font-semibold text-purple-300 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedData.map(item => {
                        const estStyle = getEstatusStyle(item.estatus);
                        const isBlocked = item.estatus === 'Bloqueado';
                        return (
                          <tr key={item.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${isBlocked ? 'opacity-40' : ''}`}>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-300">#{item.id}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-white font-medium">{item.codigo_unico || '-'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm text-zinc-300">{item.tipo_de_mueble || '-'}</span>
                                {item.tradicional_digital === 'Digital' && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    <Monitor className="h-2.5 w-2.5 inline mr-0.5" />DIG
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-zinc-400 max-w-[200px] truncate block" title={item.ubicacion || ''}>{item.ubicacion || '-'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-zinc-300">{item.plaza || '-'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-zinc-400">{item.tipo_de_cara || '-'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 font-mono text-xs text-zinc-400">
                                <Ruler className="h-3 w-3 text-zinc-600" />
                                {item.ancho}×{item.alto}m
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 text-sm text-zinc-300">
                                <DollarSign className="h-3 w-3 text-zinc-600" />
                                {formatCurrency(item.tarifa_publica)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${estStyle.bg} ${estStyle.text} border ${estStyle.border}`}>
                                {item.estatus || 'Sin estatus'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openEdit(item)}
                                  className="p-1.5 rounded-lg hover:bg-purple-500/10 text-zinc-500 hover:text-purple-300 transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => { setSelectedId(item.id); setIsHistorialOpen(true); }}
                                  className="p-1.5 rounded-lg hover:bg-purple-500/10 text-zinc-500 hover:text-purple-300 transition-colors"
                                  title="Historial"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => toggleBlockMutation.mutate(item.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${isBlocked
                                    ? 'hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300'
                                    : 'hover:bg-red-500/10 text-zinc-500 hover:text-red-400'
                                  }`}
                                  title={isBlocked ? 'Desbloquear' : 'Bloquear'}
                                >
                                  {isBlocked ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination - matching CampanasPage */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20 px-4 py-3">
                    <span className="text-sm text-purple-300/70">
                      Página <span className="font-semibold text-purple-300">{page}</span> de <span className="font-semibold text-purple-300">{totalPages}</span>
                      <span className="text-purple-300/50 ml-2">({totalItems.toLocaleString()} total)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Map View */}
        {viewMode === 'map' && (
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl overflow-hidden shadow-xl shadow-purple-500/5" style={{ height: '600px' }}>
            <InventarioMap tipo={tipo} estatus={estatus} plaza={plaza} />
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateOpen && renderFormModal(false)}

      {/* Edit Modal */}
      {isEditOpen && renderFormModal(true)}

      {/* Historial Modal */}
      {isHistorialOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setIsHistorialOpen(false); setSelectedId(null); }}>
          <div className="bg-zinc-900 rounded-2xl border border-purple-500/20 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/10" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-fuchsia-900/10 to-purple-900/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <History className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Historial del Inventario</h2>
                  {historialData?.inventario && (
                    <p className="text-xs text-purple-300/50">{historialData.inventario.codigo_unico} — {historialData.inventario.ubicacion}</p>
                  )}
                </div>
              </div>
              <button onClick={() => { setIsHistorialOpen(false); setSelectedId(null); }} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {isLoadingHistorial ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                </div>
              ) : historialData ? (
                <div className="space-y-4">
                  {/* Info cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Código', value: historialData.inventario.codigo_unico },
                      { label: 'Formato', value: historialData.inventario.mueble },
                      { label: 'Plaza', value: historialData.inventario.plaza },
                      { label: 'Tipo', value: historialData.inventario.tradicional_digital },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/50">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</p>
                        <p className="text-sm text-white font-medium mt-0.5">{value || '-'}</p>
                      </div>
                    ))}
                  </div>

                  <h3 className="text-sm font-medium text-zinc-300">
                    Historial de Campañas ({historialData.historial.length})
                  </h3>

                  {historialData.historial.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                        <History className="h-6 w-6 text-purple-400" />
                      </div>
                      <p className="text-sm text-zinc-500">No hay historial para este inventario</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {historialData.historial.map((item, index) => (
                        <div key={`${item.reserva_id}-${index}`} className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-800/50 hover:border-purple-500/20 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="font-mono text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-300">
                                  #{item.campana_id}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                  item.reserva_estatus === 'Vendido' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                  item.reserva_estatus === 'Reservado' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                  item.reserva_estatus === 'eliminada' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                                  'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30'
                                }`}>
                                  {item.reserva_estatus}
                                </span>
                                {item.instalado && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">Instalado</span>
                                )}
                              </div>
                              <p className="text-white font-medium text-sm">{item.campana_nombre}</p>
                              <p className="text-xs text-zinc-400">{item.cliente_nombre || 'Sin cliente'}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                  <CalendarIcon className="h-3 w-3" />
                                  {item.inicio_periodo?.split('T')[0]} — {item.fin_periodo?.split('T')[0]}
                                </span>
                                <span>{item.numero_catorcena && item.anio_catorcena
                                  ? `Cat ${item.numero_catorcena} / ${item.anio_catorcena}`
                                  : item.inicio_periodo
                                    ? `${(() => { const parts = item.inicio_periodo.split('-'); const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; return parts.length >= 2 ? `${meses[parseInt(parts[1]) - 1]} ${parts[0]}` : '-'; })()}`
                                    : 'Sin periodo'}</span>
                              </div>
                            </div>
                            {item.archivo && (
                              <img
                                src={item.archivo?.startsWith('http') ? item.archivo : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${item.archivo}`}
                                alt="Arte"
                                className="w-14 h-14 object-cover rounded-xl cursor-pointer hover:opacity-80 flex-shrink-0 border border-zinc-700/50"
                                onClick={() => item.archivo && window.open(item.archivo.startsWith('http') ? item.archivo : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${item.archivo}`, '_blank')}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-zinc-500 opacity-30" />
                  <p className="text-sm text-zinc-500">Error al cargar el historial</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
