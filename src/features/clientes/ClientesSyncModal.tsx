import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, RefreshCw, ChevronDown, ChevronRight, Check, AlertTriangle, Search, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { useThemeStore } from '../../store/themeStore';

interface SyncDiff {
  cliente_id: number;
  cuic: number;
  sap_database: string;
  razon_social_actual: string | null;
  es_huerfano: boolean;
  cambios: Record<string, { actual: unknown; sap: unknown }>;
}

interface SyncPreviewResponse {
  success: boolean;
  summary: { total_qeb: number; con_cambios: number; huerfanos: number; no_comparables?: number; dbs_no_disponibles?: string[] };
  diffs: SyncDiff[];
}

interface SyncApplyResponse {
  success: boolean;
  cambios_aplicados: Record<string, { actual: unknown; sap: unknown }>;
  solicitudes_afectadas: number;
}

const FIELD_LABELS: Record<string, string> = {
  T0_U_IDAsesor: 'ID Asesor',
  T0_U_Asesor: 'Asesor',
  T0_U_IDAgencia: 'ID Agencia',
  T0_U_Agencia: 'Agencia',
  T0_U_Cliente: 'Cliente',
  T0_U_RazonSocial: 'Razón Social',
  T0_U_IDACA: 'ID ACA',
  T1_U_Cliente: 'T1 Cliente',
  T1_U_IDACA: 'T1 ID ACA',
  T1_U_IDCM: 'T1 ID CM',
  T1_U_IDMarca: 'ID Marca',
  T2_U_IDCategoria: 'ID Categoría',
  T2_U_Categoria: 'Categoría',
  T2_U_IDCM: 'T2 ID CM',
  T2_U_IDProducto: 'ID Producto',
  T2_U_Marca: 'Marca',
  T2_U_Producto: 'Producto',
  card_code: 'Card Code',
  salesperson_code: 'Salesperson Code',
};

export function ClientesSyncModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [omitted, setOmitted] = useState<Set<number>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [filterMode, setFilterMode] = useState<'todos' | 'cambios' | 'huerfanos'>('todos');

  // Preview
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['clientes-sync-preview'],
    queryFn: async () => {
      const { data } = await api.post<SyncPreviewResponse>('/clientes/sync/preview');
      return data;
    },
    enabled: isOpen,
    staleTime: 60_000,
  });

  // Apply per-client
  const applyMutation = useMutation({
    mutationFn: async (clienteId: number) => {
      const { data } = await api.post<SyncApplyResponse>(`/clientes/${clienteId}/sync-from-sap`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-sync-preview'] });
    },
  });
  const [applied, setApplied] = useState<Map<number, SyncApplyResponse>>(new Map());
  const [applying, setApplying] = useState<Set<number>>(new Set());

  const handleApply = async (clienteId: number) => {
    setApplying(prev => new Set(prev).add(clienteId));
    try {
      const result = await applyMutation.mutateAsync(clienteId);
      setApplied(prev => new Map(prev).set(clienteId, result));
    } catch (err) {
      console.error('Error aplicando sync:', err);
      alert(`Error al actualizar cliente ${clienteId}: ${err instanceof Error ? err.message : 'desconocido'}`);
    } finally {
      setApplying(prev => { const n = new Set(prev); n.delete(clienteId); return n; });
    }
  };

  const handleOmit = (clienteId: number) => {
    setOmitted(prev => new Set(prev).add(clienteId));
  };

  const toggleExpand = (clienteId: number) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(clienteId)) n.delete(clienteId); else n.add(clienteId);
      return n;
    });
  };

  useEffect(() => {
    if (filterMode === 'huerfanos' && (data?.summary.huerfanos ?? 0) === 0) {
      setFilterMode('todos');
    }
  }, [data?.summary.huerfanos, filterMode]);

  const filteredDiffs = useMemo(() => {
    let list = data?.diffs || [];
    if (filterMode === 'cambios') list = list.filter(d => !d.es_huerfano);
    else if (filterMode === 'huerfanos') list = list.filter(d => d.es_huerfano);
    if (filterText.trim()) {
      const t = filterText.toLowerCase();
      list = list.filter(d =>
        String(d.cuic).includes(t) ||
        (d.razon_social_actual || '').toLowerCase().includes(t) ||
        d.sap_database.toLowerCase().includes(t)
      );
    }
    return list;
  }, [data?.diffs, filterMode, filterText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-[95vw] max-w-[1200px] h-[85vh] ${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} shadow-2xl flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500">
              <RefreshCw className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Sincronizar Clientes desde SAP</h2>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Compara QEB vs SAP (CIMU + TRADE) y aplica los cambios uno por uno</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Loading inicial */}
        {(isLoading || (isFetching && !data)) && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-10 w-10 text-purple-500 animate-spin" />
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Comparando QEB con SAP… esto puede tardar unos segundos</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary + filtros */}
            <div className={`px-6 py-3 border-b ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50/50'}`}>
              {/* Warning si alguna DB SAP no respondió */}
              {(data.summary.dbs_no_disponibles?.length || 0) > 0 && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <b>SAP {data.summary.dbs_no_disponibles!.join(' + ')} no respondió</b> (probable sesión expirada / 401).
                    {data.summary.no_comparables ? <> Hay <b>{data.summary.no_comparables}</b> clientes que no se pudieron comparar — NO son huérfanos reales, solo no se pudieron verificar contra SAP. Renueva la sesión del proxy SAP y vuelve a abrir el modal.</> : null}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-gray-700 border border-gray-200'}`}>
                  📊 <b>{data.summary.total_qeb}</b> clientes en QEB
                </span>
                <span className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  ⚠️ <b>{data.summary.con_cambios}</b> con cambios
                </span>
                {data.summary.huerfanos > 0 && (
                  <span className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                    🚫 <b>{data.summary.huerfanos}</b> sin coincidencia en SAP
                  </span>
                )}
                {data.summary.no_comparables ? (
                  <span className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    ⏸️ <b>{data.summary.no_comparables}</b> no comparables
                  </span>
                ) : null}
                <div className="flex-1" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'} border flex-1 max-w-md`}>
                  <Search className="h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Buscar por CUIC, razón social, database…"
                    className={`bg-transparent outline-none text-sm flex-1 ${isDark ? 'text-zinc-100 placeholder-zinc-500' : 'text-gray-700 placeholder-gray-400'}`}
                  />
                </div>
                <div className={`flex p-1 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
                  {(['todos', 'cambios', ...(data.summary.huerfanos > 0 ? ['huerfanos' as const] : [])] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setFilterMode(m)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${filterMode === m
                        ? 'bg-purple-500 text-white'
                        : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {m === 'todos' ? 'Todos' : m === 'cambios' ? 'Solo cambios' : 'Sin coincidencia'}
                    </button>
                  ))}
                </div>
                <span className={`text-xs px-2 py-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                  Mostrando <b>{filteredDiffs.length}</b> de <b>{data.diffs.length}</b>
                </span>
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredDiffs.length === 0 ? (
                <div className={`text-center py-12 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  ✅ Sin clientes con cambios para sincronizar
                </div>
              ) : (
                filteredDiffs.map(d => {
                  const isExpanded = expanded.has(d.cliente_id);
                  const isApplied = applied.has(d.cliente_id);
                  const isOmitted = omitted.has(d.cliente_id);
                  const isApplying = applying.has(d.cliente_id);
                  // Se oculta T1_U_UnidadNegocio del diff visible (sigue sincronizándose al aplicar).
                  const numCampos = Object.keys(d.cambios).filter(f => f !== 'T1_U_UnidadNegocio').length;
                  return (
                    <div
                      key={d.cliente_id}
                      className={`rounded-xl border ${isApplied
                        ? isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-300 bg-emerald-50'
                        : isOmitted
                          ? isDark ? 'border-zinc-700/30 bg-zinc-800/30 opacity-60' : 'border-gray-200 bg-gray-100 opacity-60'
                          : d.es_huerfano
                            ? isDark ? 'border-red-500/30 bg-red-500/5' : 'border-red-300 bg-red-50'
                            : isDark ? 'border-zinc-700/30 bg-zinc-800/30' : 'border-gray-200 bg-white'
                      } transition-all`}
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Expand */}
                        <button
                          onClick={() => toggleExpand(d.cliente_id)}
                          disabled={d.es_huerfano}
                          className={`p-1 rounded ${d.es_huerfano ? 'opacity-30 cursor-not-allowed' : isDark ? 'hover:bg-zinc-700' : 'hover:bg-gray-200'}`}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>

                        {/* Datos */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>
                              {d.razon_social_actual || '(sin razón social)'}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-200 text-gray-700'}`}>
                              CUIC {d.cuic}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${d.sap_database === 'CIMU' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                              {d.sap_database}
                            </span>
                            {d.es_huerfano ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Huérfano (no está en SAP)
                              </span>
                            ) : (
                              <span className={`text-[10px] px-2 py-0.5 rounded ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                                {numCampos} campo{numCampos !== 1 ? 's' : ''} con diff
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Acciones */}
                        {!d.es_huerfano && (
                          isApplied ? (
                            <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                              <Check className="h-3.5 w-3.5" /> Aplicado
                              {applied.get(d.cliente_id)?.solicitudes_afectadas ? (
                                <span className="text-[10px] opacity-75 ml-1">(+{applied.get(d.cliente_id)?.solicitudes_afectadas} sol.)</span>
                              ) : null}
                            </span>
                          ) : isOmitted ? (
                            <button
                              onClick={() => setOmitted(prev => { const n = new Set(prev); n.delete(d.cliente_id); return n; })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                              Deshacer omitir
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApply(d.cliente_id)}
                                disabled={isApplying}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white hover:from-purple-600 hover:to-fuchsia-600 transition-all disabled:opacity-50 flex items-center gap-1"
                              >
                                {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                Actualizar
                              </button>
                              <button
                                onClick={() => handleOmit(d.cliente_id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                              >
                                Omitir
                              </button>
                            </div>
                          )
                        )}
                      </div>

                      {/* Detalle expandido */}
                      {isExpanded && !d.es_huerfano && (
                        <div className={`px-4 pb-3 pt-1 border-t ${isDark ? 'border-zinc-700/50' : 'border-gray-200'}`}>
                          <div className={`grid grid-cols-[180px_1fr_1fr] gap-2 text-xs`}>
                            <div className={`font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-600'} pb-1`}>Campo</div>
                            <div className={`font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-600'} pb-1`}>Actual (QEB)</div>
                            <div className={`font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-600'} pb-1`}>SAP</div>
                            {Object.entries(d.cambios).filter(([field]) => field !== 'T1_U_UnidadNegocio').map(([field, val]) => (
                              <ContentsRow
                                key={field}
                                label={FIELD_LABELS[field] || field}
                                actual={val.actual}
                                sap={val.sap}
                                isDark={isDark}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ContentsRow({ label, actual, sap, isDark }: { label: string; actual: unknown; sap: unknown; isDark: boolean }) {
  return (
    <>
      <div className={`text-[11px] py-1 ${isDark ? 'text-zinc-300' : 'text-gray-700'} font-medium`}>{label}</div>
      <div className={`text-[11px] py-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'} line-through truncate`}>
        {actual == null || actual === '' ? '—' : String(actual)}
      </div>
      <div className={`text-[11px] py-1 font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'} truncate`}>
        {sap == null || sap === '' ? '—' : String(sap)}
      </div>
    </>
  );
}
