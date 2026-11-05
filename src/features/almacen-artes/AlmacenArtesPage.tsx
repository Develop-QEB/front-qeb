// Pagina del modulo "Almacen Artes" (fase 1 MVP).
// Feedback Jos 2026-11-05.
//
// Lista el stock de artes fisicos por campaña, con disponible calculado
// (inicial + recibida - instalada - salidas_manuales). Permite entrada/salida
// manuales y ver historial de movimientos por arte.

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Search, Plus, Minus, History, X, Loader2 } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { almacenArtesService, AlmacenArteStock } from '../../services/almacenArtes.service';

export function AlmacenArtesPage() {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [estatusFilter, setEstatusFilter] = useState<string>('');
  const [selected, setSelected] = useState<AlmacenArteStock | null>(null);
  const [modal, setModal] = useState<'entrada' | 'salida' | 'historial' | null>(null);

  const listQuery = useQuery({
    queryKey: ['almacen-artes', search, estatusFilter],
    queryFn: () => almacenArtesService.list({
      search: search || undefined,
      estatus_operaciones: estatusFilter || undefined,
    }),
  });

  const estatusOpciones = useMemo(() => {
    const set = new Set<string>();
    (listQuery.data || []).forEach(r => { if (r.estatus_operaciones) set.add(r.estatus_operaciones); });
    return [...set].sort();
  }, [listQuery.data]);

  const kpis = useMemo(() => {
    const rows = listQuery.data || [];
    return {
      artes: rows.length,
      disponible: rows.reduce((a, r) => a + r.cantidad_disponible, 0),
      recibida: rows.reduce((a, r) => a + r.cantidad_recibida, 0),
      instalada: rows.reduce((a, r) => a + r.cantidad_instalada, 0),
    };
  }, [listQuery.data]);

  const bg = isDark ? 'bg-zinc-900' : 'bg-white';
  const border = isDark ? 'border-zinc-800' : 'border-gray-200';
  const text = isDark ? 'text-zinc-100' : 'text-gray-900';
  const subtext = isDark ? 'text-zinc-400' : 'text-gray-500';
  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'}`;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-zinc-950' : 'bg-gray-50'} p-6`}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/15' : 'bg-amber-50'}`}>
              <Archive className={`h-5 w-5 ${isDark ? 'text-amber-300' : 'text-amber-600'}`} />
            </div>
            <div>
              <h1 className={`text-xl font-semibold ${text}`}>Almacén Artes</h1>
              <p className={`text-xs ${subtext}`}>Inventario físico de artes por campaña</p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Artes en biblioteca', value: kpis.artes, color: 'violet' },
            { label: 'Disponible', value: kpis.disponible, color: 'emerald' },
            { label: 'Recibida', value: kpis.recibida, color: 'cyan' },
            { label: 'Instalada', value: kpis.instalada, color: 'amber' },
          ].map(k => (
            <div key={k.label} className={`rounded-xl border ${border} ${bg} p-4`}>
              <div className={`text-[11px] uppercase tracking-wide ${subtext}`}>{k.label}</div>
              <div className={`text-2xl font-semibold mt-1 ${text}`}>{k.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className={`rounded-xl border ${border} ${bg} p-3 flex flex-wrap items-center gap-3`}>
          <div className="relative flex-1 min-w-[260px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${subtext}`} />
            <input
              className={`${inputCls} pl-9`}
              placeholder="Buscar por nombre de arte, ID campaña, cliente o marca..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className={inputCls + ' w-auto min-w-[180px]'}
            value={estatusFilter}
            onChange={e => setEstatusFilter(e.target.value)}
          >
            <option value="">Todos los estatus</option>
            {estatusOpciones.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {/* Tabla */}
        <div className={`rounded-xl border ${border} ${bg} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${isDark ? 'bg-zinc-800/40' : 'bg-gray-50'} ${subtext}`}>
                  <th className="text-left px-3 py-2 font-medium">Arte</th>
                  <th className="text-left px-3 py-2 font-medium">Campaña</th>
                  <th className="text-left px-3 py-2 font-medium">Cliente / Marca</th>
                  <th className="text-left px-3 py-2 font-medium">Asesor</th>
                  <th className="text-left px-3 py-2 font-medium">Estatus</th>
                  <th className="text-right px-3 py-2 font-medium">Inicial</th>
                  <th className="text-right px-3 py-2 font-medium">Recibida</th>
                  <th className="text-right px-3 py-2 font-medium">Instalada</th>
                  <th className="text-right px-3 py-2 font-medium">Disponible</th>
                  <th className="text-right px-3 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && (
                  <tr><td colSpan={10} className={`px-3 py-8 text-center ${subtext}`}>
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" /> Cargando...
                  </td></tr>
                )}
                {!listQuery.isLoading && (listQuery.data?.length ?? 0) === 0 && (
                  <tr><td colSpan={10} className={`px-3 py-8 text-center ${subtext}`}>
                    Sin artes en el almacén. Los artes aparecen aquí al cargarse en una campaña.
                  </td></tr>
                )}
                {(listQuery.data || []).map(row => (
                  <tr key={row.biblioteca_artes_id} className={`border-t ${border}`}>
                    <td className={`px-3 py-2 ${text}`}>
                      <div className="font-medium truncate max-w-[220px]" title={row.nombre_arte}>{row.nombre_arte}</div>
                      <div className={`text-[10px] ${subtext}`}>{row.tipo === 'digital' ? 'Digital' : 'Tradicional'}</div>
                    </td>
                    <td className={`px-3 py-2 ${subtext}`}>
                      <div className="truncate max-w-[180px]" title={row.campania_nombre || ''}>{row.campania_nombre || '-'}</div>
                      <div className="text-[10px]">#{row.campania_id}</div>
                    </td>
                    <td className={`px-3 py-2 ${subtext}`}>
                      <div className="truncate max-w-[180px]" title={row.cliente || ''}>{row.cliente || '-'}</div>
                      <div className="text-[10px]">{row.marca || ''}</div>
                    </td>
                    <td className={`px-3 py-2 ${subtext} truncate max-w-[160px]`} title={row.asesor || ''}>{row.asesor || '-'}</td>
                    <td className={`px-3 py-2`}>
                      {row.estatus_operaciones ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>
                          {row.estatus_operaciones}
                        </span>
                      ) : '-'}
                    </td>
                    <td className={`px-3 py-2 text-right ${text}`}>{row.cantidad_inicial}</td>
                    <td className={`px-3 py-2 text-right text-cyan-400`}>{row.cantidad_recibida}</td>
                    <td className={`px-3 py-2 text-right text-amber-400`}>{row.cantidad_instalada}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.cantidad_disponible > 0 ? 'text-emerald-400' : subtext}`}>
                      {row.cantidad_disponible}
                    </td>
                    <td className={`px-3 py-2`}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => { setSelected(row); setModal('entrada'); }}
                          className={`p-1.5 rounded ${isDark ? 'hover:bg-emerald-500/20 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-700'}`}
                          title="Entrada manual"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelected(row); setModal('salida'); }}
                          className={`p-1.5 rounded ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-700'}`}
                          title="Salida manual"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelected(row); setModal('historial'); }}
                          className={`p-1.5 rounded ${isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-gray-100 text-gray-600'}`}
                          title="Historial"
                        >
                          <History className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modales */}
      {modal === 'entrada' && selected && (
        <MovimientoModal
          mode="entrada"
          row={selected}
          onClose={() => { setModal(null); setSelected(null); }}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['almacen-artes'] }); setModal(null); setSelected(null); }}
        />
      )}
      {modal === 'salida' && selected && (
        <MovimientoModal
          mode="salida"
          row={selected}
          onClose={() => { setModal(null); setSelected(null); }}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['almacen-artes'] }); setModal(null); setSelected(null); }}
        />
      )}
      {modal === 'historial' && selected && (
        <HistorialModal
          row={selected}
          onClose={() => { setModal(null); setSelected(null); }}
        />
      )}
    </div>
  );
}

function MovimientoModal({ mode, row, onClose, onSuccess }: {
  mode: 'entrada' | 'salida';
  row: AlmacenArteStock;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const [cantidad, setCantidad] = useState<string>('');
  const [nota, setNota] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const cant = Number(cantidad);
      if (!Number.isFinite(cant) || cant <= 0) throw new Error('Cantidad debe ser > 0');
      if (mode === 'salida') {
        if (!nota.trim()) throw new Error('Motivo requerido');
        if (cant > row.cantidad_disponible) throw new Error(`Solo hay ${row.cantidad_disponible} disponibles`);
        await almacenArtesService.salidaManual(row.biblioteca_artes_id, cant, nota.trim());
      } else {
        await almacenArtesService.entradaManual(row.biblioteca_artes_id, cant, nota.trim() || undefined);
      }
    },
    onSuccess,
    onError: (e: Error) => setErr(e.message),
  });

  const isEntrada = mode === 'entrada';
  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <h3 className={`text-base font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
            {isEntrada ? 'Entrada manual' : 'Salida manual'}
          </h3>
          <button onClick={onClose} className={`p-1.5 rounded ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Arte</div>
            <div className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{row.nombre_arte}</div>
            <div className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Campaña #{row.campania_id} · Disponible: {row.cantidad_disponible}</div>
          </div>
          <div>
            <label className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Cantidad *</label>
            <input type="number" min={1} className={inputCls} value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              {isEntrada ? 'Nota (opcional)' : 'Motivo *'}
            </label>
            <textarea className={inputCls} rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder={isEntrada ? 'Ingreso adicional, ajuste, etc.' : 'Por qué sale del almacén'} />
          </div>
          {err && (
            <div className={`text-xs px-2 py-1.5 rounded ${isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'}`}>{err}</div>
          )}
        </div>
        <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <button type="button" onClick={onClose} className={`px-3 py-1.5 text-sm rounded ${isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'}`}>Cancelar</button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => { setErr(null); mutation.mutate(); }}
            className={`px-4 py-1.5 text-sm rounded font-medium ${isEntrada ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white disabled:opacity-50`}
          >
            {mutation.isPending ? 'Guardando...' : isEntrada ? 'Registrar entrada' : 'Registrar salida'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistorialModal({ row, onClose }: { row: AlmacenArteStock; onClose: () => void }) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const query = useQuery({
    queryKey: ['almacen-historial', row.biblioteca_artes_id],
    queryFn: () => almacenArtesService.historial(row.biblioteca_artes_id),
  });

  const tipoLabel: Record<string, string> = {
    alta_inicial: 'Alta inicial',
    entrada_recepcion: 'Recepción',
    salida_instalacion: 'Instalación',
    entrada_manual: 'Entrada manual',
    salida_manual: 'Salida manual',
    ajuste: 'Ajuste',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border max-h-[85vh] overflow-hidden flex flex-col ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div>
            <h3 className={`text-base font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Historial de movimientos</h3>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{row.nombre_arte} · Campaña #{row.campania_id}</p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {query.isLoading && (
            <div className={`px-3 py-6 text-center text-sm ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" /> Cargando...
            </div>
          )}
          {!query.isLoading && (query.data?.length ?? 0) === 0 && (
            <div className={`px-3 py-6 text-center text-sm ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              Sin movimientos registrados.
            </div>
          )}
          <ul className="space-y-1.5">
            {(query.data || []).map(m => {
              const esSalida = m.cantidad < 0;
              return (
                <li key={m.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${isDark ? 'border-zinc-800 bg-zinc-800/40' : 'border-gray-200 bg-gray-50'}`}>
                  <div className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${esSalida ? (isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-700') : (isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700')}`}>
                    {esSalida ? '-' : '+'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                        {tipoLabel[m.tipo] || m.tipo} · {Math.abs(m.cantidad)}
                      </span>
                      <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                        {new Date(m.fecha_hora).toLocaleString('es-MX')}
                      </span>
                    </div>
                    <div className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'} truncate`}>
                      {m.usuario_nombre ? `Por ${m.usuario_nombre}` : 'Automático'}
                      {m.tarea_id ? ` · Tarea #${m.tarea_id}` : ''}
                      {m.reserva_id ? ` · Reserva #${m.reserva_id}` : ''}
                    </div>
                    {m.nota && (
                      <div className={`text-[11px] mt-1 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>{m.nota}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
