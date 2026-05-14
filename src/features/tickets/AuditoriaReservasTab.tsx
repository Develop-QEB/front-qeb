import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Users, Search, Database, Calendar, Building2 } from 'lucide-react';
import { auditReservasService } from '../../services/auditReservas.service';

type SubTab = 'resumen' | 'duplicados' | 'huerfanos' | 'catorcena' | 'cliente';

// Card de KPI minimal para el resumen — colorea según severidad.
function KpiCard({
  label,
  value,
  isDark,
  severity = 'neutral',
  hint,
}: {
  label: string;
  value: number | string;
  isDark: boolean;
  severity?: 'neutral' | 'ok' | 'warn' | 'danger';
  hint?: string;
}) {
  const colors = {
    neutral: { text: isDark ? 'text-zinc-200' : 'text-gray-800', border: isDark ? 'border-zinc-700/30' : 'border-gray-200' },
    ok: { text: 'text-emerald-400', border: 'border-emerald-500/30' },
    warn: { text: 'text-amber-400', border: 'border-amber-500/30' },
    danger: { text: 'text-red-400', border: 'border-red-500/30' },
  };
  const c = colors[severity];
  return (
    <div className={`rounded-xl border ${c.border} ${isDark ? 'bg-zinc-900/60' : 'bg-white'} p-4`}>
      <div className={`text-xs uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{label}</div>
      <div className={`text-2xl font-bold mt-1 ${c.text}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {hint && <div className={`text-[11px] mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{hint}</div>}
    </div>
  );
}

// Chip pequeño para clase de duplicado.
function ClaseChip({ clase }: { clase: 'ENTRE_CLIENTES' | 'MISMO_CLIENTE_CAMP' | 'FILA_REPETIDA' }) {
  const map = {
    ENTRE_CLIENTES: { label: 'Entre clientes', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
    MISMO_CLIENTE_CAMP: { label: 'Mismo cliente, otra propuesta', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    FILA_REPETIDA: { label: 'Fila repetida', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  } as const;
  const c = map[clase];
  return <span className={`px-2 py-0.5 rounded-full text-[10px] border ${c.cls} whitespace-nowrap`}>{c.label}</span>;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AuditoriaReservasTab({ isDark }: { isDark: boolean }) {
  const [subTab, setSubTab] = useState<SubTab>('resumen');
  const [search, setSearch] = useState('');
  const [filterClase, setFilterClase] = useState<string>('');

  const summaryQuery = useQuery({
    queryKey: ['audit-reservas', 'summary'],
    queryFn: () => auditReservasService.getSummary(),
  });
  const dupQuery = useQuery({
    queryKey: ['audit-reservas', 'duplicados'],
    queryFn: () => auditReservasService.getDuplicados(),
    enabled: subTab === 'duplicados',
  });
  const huerQuery = useQuery({
    queryKey: ['audit-reservas', 'huerfanos'],
    queryFn: () => auditReservasService.getHuerfanos(),
    enabled: subTab === 'huerfanos',
  });
  const catQuery = useQuery({
    queryKey: ['audit-reservas', 'por-catorcena'],
    queryFn: () => auditReservasService.getPorCatorcena(),
    enabled: subTab === 'catorcena',
  });
  const cliQuery = useQuery({
    queryKey: ['audit-reservas', 'por-cliente'],
    queryFn: () => auditReservasService.getPorCliente(),
    enabled: subTab === 'cliente',
  });

  const dupFiltered = useMemo(() => {
    const list = dupQuery.data || [];
    const term = search.toLowerCase().trim();
    return list.filter(r => {
      if (filterClase && r.clase !== filterClase) return false;
      if (!term) return true;
      const hay = `${r.codigo_unico || ''} ${r.plaza || ''} ${r.clientes || ''} ${r.propuesta_ids || ''} ${r.articulos || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [dupQuery.data, search, filterClase]);

  const huerFiltered = useMemo(() => {
    const list = huerQuery.data || [];
    const term = search.toLowerCase().trim();
    if (!term) return list;
    return list.filter(r => {
      const hay = `${r.codigo_unico || ''} ${r.plaza || ''} ${r.cliente_nombre || ''} ${r.propuesta_id_text || ''} ${r.motivo}`.toLowerCase();
      return hay.includes(term);
    });
  }, [huerQuery.data, search]);

  const cliFiltered = useMemo(() => {
    const list = cliQuery.data || [];
    const term = search.toLowerCase().trim();
    if (!term) return list;
    return list.filter(r => {
      const hay = `${r.razon_social || ''} ${r.marca || ''} ${r.asesor || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [cliQuery.data, search]);

  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: 'resumen', label: 'Resumen', icon: <Database className="h-3.5 w-3.5" /> },
    { key: 'duplicados', label: 'Duplicados', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { key: 'huerfanos', label: 'Huérfanas', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { key: 'catorcena', label: 'Por catorcena', icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: 'cliente', label: 'Por cliente', icon: <Building2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className={`flex flex-wrap gap-1 p-1 rounded-xl ${isDark ? 'bg-zinc-900/60 border border-zinc-700/30' : 'bg-gray-100 border border-gray-200'}`}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setSubTab(t.key); setSearch(''); setFilterClase(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === t.key
                ? (isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-300')
                : (isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-700')
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Resumen */}
      {subTab === 'resumen' && (
        <div>
          {summaryQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 text-purple-400 animate-spin" /></div>
          ) : summaryQuery.data ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="Reservas activas" value={summaryQuery.data.total_reservas} isDark={isDark} severity="neutral" />
              <KpiCard label="En duplicado" value={summaryQuery.data.reservas_en_duplicado} isDark={isDark} severity={summaryQuery.data.reservas_en_duplicado > 0 ? 'warn' : 'ok'} hint="Mismo inv + periodo" />
              <KpiCard label="Entre clientes" value={summaryQuery.data.grupos_con_clientes_distintos} isDark={isDark} severity={summaryQuery.data.grupos_con_clientes_distintos > 0 ? 'danger' : 'ok'} hint="Grupos con > 1 cliente" />
              <KpiCard label="Huérfanas" value={summaryQuery.data.reservas_huerfanas} isDark={isDark} severity={summaryQuery.data.reservas_huerfanas > 0 ? 'warn' : 'ok'} hint="Sin propuesta válida" />
              <KpiCard label="Sin inventario" value={summaryQuery.data.reservas_sin_inventario} isDark={isDark} severity={summaryQuery.data.reservas_sin_inventario > 0 ? 'danger' : 'ok'} hint="FK rota a inventarios" />
              <KpiCard label="Catorcenas" value={summaryQuery.data.catorcenas_activas} isDark={isDark} severity="neutral" hint="Periodos distintos" />
            </div>
          ) : (
            <div className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'} p-4`}>Error cargando resumen</div>
          )}
        </div>
      )}

      {/* Duplicados */}
      {subTab === 'duplicados' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-900/60 border border-zinc-700/30' : 'bg-white border border-gray-200'} flex-1 max-w-md`}>
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por código, plaza, cliente, propuesta..."
                className={`bg-transparent flex-1 text-sm outline-none ${isDark ? 'text-zinc-100 placeholder-zinc-500' : 'text-gray-700 placeholder-gray-400'}`}
              />
            </div>
            <select
              value={filterClase}
              onChange={e => setFilterClase(e.target.value)}
              className={`px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-zinc-900/60 border border-zinc-700/30 text-zinc-200' : 'bg-white border border-gray-200 text-gray-700'} outline-none`}
            >
              <option value="">Todas las clases</option>
              <option value="ENTRE_CLIENTES">Entre clientes</option>
              <option value="MISMO_CLIENTE_CAMP">Mismo cliente, otra propuesta</option>
              <option value="FILA_REPETIDA">Fila repetida</option>
            </select>
            <span className={`text-xs px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-800/60 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>
              {dupFiltered.length} / {dupQuery.data?.length || 0} grupos
            </span>
          </div>

          {dupQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 text-purple-400 animate-spin" /></div>
          ) : (
            <div className={`rounded-xl border ${isDark ? 'border-zinc-700/30 bg-zinc-900/40' : 'border-gray-200 bg-white'} overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto`}>
              <table className="w-full text-sm">
                <thead className={`sticky top-0 ${isDark ? 'bg-zinc-900' : 'bg-gray-50'} z-10`}>
                  <tr className={`border-b ${isDark ? 'border-zinc-700/30' : 'border-gray-200'}`}>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Código</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Cara</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Plaza</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Periodo</th>
                    <th className={`text-center px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Veces</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Clase</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Clientes</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Propuestas</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Campañas</th>
                  </tr>
                </thead>
                <tbody>
                  {dupFiltered.map((r, i) => (
                    <tr key={`${r.inventario_id}-${r.fecha_inicio}-${i}`} className={`border-b ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <td className={`px-3 py-2 text-xs font-mono ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{r.codigo_unico || `inv ${r.inventario_id}`}</td>
                      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.tipo_de_cara || '-'}</td>
                      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.plaza || '-'}</td>
                      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} whitespace-nowrap`}>{formatDate(r.fecha_inicio)} – {formatDate(r.fecha_fin)}</td>
                      <td className={`px-3 py-2 text-xs text-center font-bold ${r.veces > 2 ? 'text-red-400' : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>{r.veces}</td>
                      <td className="px-3 py-2"><ClaseChip clase={r.clase} /></td>
                      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'} max-w-[250px] truncate`} title={r.clientes || ''}>{r.clientes || '-'}</td>
                      <td className={`px-3 py-2 text-[11px] font-mono ${isDark ? 'text-purple-300' : 'text-purple-600'} max-w-[140px] truncate`} title={r.propuesta_ids || ''}>{r.propuesta_ids || '-'}</td>
                      <td className={`px-3 py-2 text-[11px] font-mono ${isDark ? 'text-cyan-300' : 'text-cyan-600'} max-w-[140px] truncate`} title={r.campania_ids || ''}>{r.campania_ids || '-'}</td>
                    </tr>
                  ))}
                  {dupFiltered.length === 0 && (
                    <tr>
                      <td colSpan={9} className={`px-3 py-8 text-center text-sm italic ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                        {dupQuery.data?.length === 0 ? '✅ Sin duplicados detectados' : 'Sin coincidencias para el filtro'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Huérfanos */}
      {subTab === 'huerfanos' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-900/60 border border-zinc-700/30' : 'bg-white border border-gray-200'} flex-1 max-w-md`}>
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por código, cliente, propuesta..."
                className={`bg-transparent flex-1 text-sm outline-none ${isDark ? 'text-zinc-100 placeholder-zinc-500' : 'text-gray-700 placeholder-gray-400'}`}
              />
            </div>
            <span className={`text-xs px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-800/60 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>
              {huerFiltered.length} / {huerQuery.data?.length || 0} reservas
            </span>
          </div>

          {huerQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 text-purple-400 animate-spin" /></div>
          ) : (
            <div className={`rounded-xl border ${isDark ? 'border-zinc-700/30 bg-zinc-900/40' : 'border-gray-200 bg-white'} overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto`}>
              <table className="w-full text-sm">
                <thead className={`sticky top-0 ${isDark ? 'bg-zinc-900' : 'bg-gray-50'} z-10`}>
                  <tr className={`border-b ${isDark ? 'border-zinc-700/30' : 'border-gray-200'}`}>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Reserva ID</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Código inv.</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Plaza</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Cliente</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Propuesta (FK)</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Periodo</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {huerFiltered.map(r => (
                    <tr key={r.reserva_id} className={`border-b ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <td className={`px-3 py-2 text-xs font-mono ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{r.reserva_id}</td>
                      <td className={`px-3 py-2 text-xs font-mono ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{r.codigo_unico || `inv ${r.inventario_id}`}</td>
                      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.plaza || '-'}</td>
                      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{r.cliente_nombre || `cliente_id=${r.cliente_id}`}</td>
                      <td className={`px-3 py-2 text-xs font-mono ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>{r.propuesta_id_text || '-'}</td>
                      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} whitespace-nowrap`}>{formatDate(r.fecha_inicio)} – {formatDate(r.fecha_fin)}</td>
                      <td className={`px-3 py-2 text-xs`}>
                        <span className="px-2 py-0.5 rounded-full text-[10px] border bg-amber-500/20 text-amber-300 border-amber-500/30">
                          {r.motivo}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {huerFiltered.length === 0 && (
                    <tr>
                      <td colSpan={7} className={`px-3 py-8 text-center text-sm italic ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                        {huerQuery.data?.length === 0 ? '✅ Sin reservas huérfanas' : 'Sin coincidencias para el filtro'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Por catorcena */}
      {subTab === 'catorcena' && (
        <div>
          {catQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 text-purple-400 animate-spin" /></div>
          ) : (
            <div className={`rounded-xl border ${isDark ? 'border-zinc-700/30 bg-zinc-900/40' : 'border-gray-200 bg-white'} overflow-x-auto max-h-[calc(100vh-340px)] overflow-y-auto`}>
              <table className="w-full text-sm">
                <thead className={`sticky top-0 ${isDark ? 'bg-zinc-900' : 'bg-gray-50'} z-10`}>
                  <tr className={`border-b ${isDark ? 'border-zinc-700/30' : 'border-gray-200'}`}>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Periodo</th>
                    <th className={`text-right px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Reservas</th>
                    <th className={`text-right px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Inv. únicos</th>
                    <th className={`text-right px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Clientes</th>
                    <th className={`text-right px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Propuestas</th>
                    <th className={`text-right px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Duplicados</th>
                  </tr>
                </thead>
                <tbody>
                  {(catQuery.data || []).map((r, i) => (
                    <tr key={i} className={`border-b ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-200' : 'text-gray-700'} whitespace-nowrap`}>{formatDate(r.fecha_inicio)} – {formatDate(r.fecha_fin)}</td>
                      <td className={`px-3 py-2 text-xs text-right font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{r.total_reservas.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-xs text-right ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.inventarios_unicos.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-xs text-right ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.clientes_unicos.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-xs text-right ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.propuestas_unicas.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-xs text-right font-bold ${r.grupos_duplicados > 0 ? 'text-amber-400' : (isDark ? 'text-zinc-500' : 'text-gray-400')}`}>{r.grupos_duplicados.toLocaleString()}</td>
                    </tr>
                  ))}
                  {(catQuery.data || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className={`px-3 py-8 text-center text-sm italic ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Sin datos</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Por cliente */}
      {subTab === 'cliente' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-900/60 border border-zinc-700/30' : 'bg-white border border-gray-200'} flex-1 max-w-md`}>
              <Users className="h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por razón social, marca, asesor..."
                className={`bg-transparent flex-1 text-sm outline-none ${isDark ? 'text-zinc-100 placeholder-zinc-500' : 'text-gray-700 placeholder-gray-400'}`}
              />
            </div>
            <span className={`text-xs px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-800/60 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>
              {cliFiltered.length} / {cliQuery.data?.length || 0} clientes
            </span>
          </div>

          {cliQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 text-purple-400 animate-spin" /></div>
          ) : (
            <div className={`rounded-xl border ${isDark ? 'border-zinc-700/30 bg-zinc-900/40' : 'border-gray-200 bg-white'} overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto`}>
              <table className="w-full text-sm">
                <thead className={`sticky top-0 ${isDark ? 'bg-zinc-900' : 'bg-gray-50'} z-10`}>
                  <tr className={`border-b ${isDark ? 'border-zinc-700/30' : 'border-gray-200'}`}>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Cliente</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Marca</th>
                    <th className={`text-left px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Asesor</th>
                    <th className={`text-right px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Reservas</th>
                    <th className={`text-right px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Inv. únicos</th>
                    <th className={`text-right px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Propuestas</th>
                    <th className={`text-right px-3 py-2 text-[11px] font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Campañas</th>
                  </tr>
                </thead>
                <tbody>
                  {cliFiltered.map(r => (
                    <tr key={r.cliente_id} className={`border-b ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <td className={`px-3 py-2 text-xs font-medium ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{r.razon_social || `cliente_id=${r.cliente_id}`}</td>
                      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.marca || '-'}</td>
                      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.asesor || '-'}</td>
                      <td className={`px-3 py-2 text-xs text-right font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{r.total_reservas.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-xs text-right ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.inventarios_unicos.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-xs text-right ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.propuestas_unicas.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-xs text-right ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{r.campanias_unicas.toLocaleString()}</td>
                    </tr>
                  ))}
                  {cliFiltered.length === 0 && (
                    <tr>
                      <td colSpan={7} className={`px-3 py-8 text-center text-sm italic ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                        {cliQuery.data?.length === 0 ? 'Sin datos' : 'Sin coincidencias para el filtro'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
