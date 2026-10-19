import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase, Calendar, Search, X, RefreshCw, Circle, Pencil, ArrowRight, ArrowLeft,
  AlertTriangle, Building2, Tag, Layers, Filter, User, Users, Hash,
} from 'lucide-react';
import { historialService, type ActividadComercialTarea } from '../../services/historial.service';
import { useAuthStore } from '../../store/authStore';
import { UserAvatar } from '../../components/ui/user-avatar';
import { formatDate } from '../../lib/utils';
import { NuevaActividadComercialModal } from '../notificaciones/NuevaActividadComercialModal';
import { FiltroMultiple } from './FiltroMultiple';
import { DetalleActividadModal } from './DetalleActividadModal';
import {
  COLUMNAS_AC, COLUMNA_LABEL, COLUMNA_DESCRIPCION, COLUMNA_COLOR, QK_ACTIVIDAD_COMERCIAL, type ColumnaAC,
  columnaDeEstatus, esCancelada, parseContenidoAC, tituloCorto, estaVencida, textoBusqueda, clienteDe, coincideId,
  type FiltroRapidoAC, FILTRO_RAPIDO_LABEL, COLUMNAS_POR_FILTRO,
} from './actividadComercial';

// Tablero CRM de Actividad Comercial: columnas por estatus de la tarea,
// drag & drop entre columnas (HTML5 nativo, sin dependencias) y botones
// "mover" como alternativa. Click en la tarjeta abre el detalle (ver, mover,
// editar). Muestra TODAS las actividades (de todos los usuarios): el tab vive
// en Historial de Acciones, que ya es solo para roles directivos/admin.
const DND_MIME = 'application/x-qeb-actividad-id';

const FILTROS_RAPIDOS: FiltroRapidoAC[] = ['todas', 'sin_finalizar', 'finalizadas'];

interface Props {
  isDark: boolean;
}

export function ActividadComercialBoard({ isDark }: Props) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? null;
  // Mismo criterio que el back (editarActividadComercial): creador o Admin/DEV.
  const esAdmin = user?.rol === 'Administrador' || user?.rol === 'DEV';
  const puedeEditar = (t: ActividadComercialTarea) => esAdmin || (currentUserId != null && t.id_responsable === currentUserId);

  // Filtros
  const [search, setSearch] = useState('');
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapidoAC>('todas');
  const [responsables, setResponsables] = useState<string[]>([]);
  const [clientes, setClientes] = useState<string[]>([]);
  const [asesores, setAsesores] = useState<string[]>([]);
  const [cuic, setCuic] = useState('');
  const [idFiltro, setIdFiltro] = useState('');
  const [ocultarCanceladas, setOcultarCanceladas] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // DnD / modales
  const [dragOverCol, setDragOverCol] = useState<ColumnaAC | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const arrastrando = useRef(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ActividadComercialTarea | null>(null);

  const { data = [], isLoading, isFetching } = useQuery({
    queryKey: QK_ACTIVIDAD_COMERCIAL,
    queryFn: () => historialService.getActividadesComerciales(),
  });

  // Mover con actualizacion optimista: la tarjeta cambia de columna al
  // instante y se revierte si el back falla.
  const moverMutation = useMutation({
    mutationFn: ({ id, columna }: { id: number; columna: ColumnaAC }) =>
      historialService.moverActividadComercial(id, columna),
    onMutate: async ({ id, columna }) => {
      await queryClient.cancelQueries({ queryKey: QK_ACTIVIDAD_COMERCIAL });
      const previo = queryClient.getQueryData<ActividadComercialTarea[]>(QK_ACTIVIDAD_COMERCIAL);
      const estatusOptimista = columna === 'Finalizado' ? 'Atendido' : columna;
      queryClient.setQueryData<ActividadComercialTarea[]>(QK_ACTIVIDAD_COMERCIAL, (old) =>
        (old || []).map(t => (t.id === id ? { ...t, estatus: estatusOptimista } : t)),
      );
      return { previo };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previo) queryClient.setQueryData(QK_ACTIVIDAD_COMERCIAL, ctx.previo);
      window.alert(err instanceof Error ? err.message : 'No se pudo mover la actividad');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QK_ACTIVIDAD_COMERCIAL });
      queryClient.invalidateQueries({ queryKey: ['historial-acciones'] });
    },
  });

  // Opciones de los multiselects, derivadas de los datos.
  const opciones = useMemo(() => {
    const r = new Set<string>(); const c = new Set<string>(); const a = new Set<string>();
    data.forEach(t => {
      if (t.responsable) r.add(t.responsable);
      const cl = clienteDe(t); if (cl) c.add(cl);
      if (t.asesor) a.add(t.asesor);
    });
    const ord = (s: Set<string>) => Array.from(s).sort((x, y) => x.localeCompare(y, 'es'));
    return { responsables: ord(r), clientes: ord(c), asesores: ord(a) };
  }, [data]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cuicQ = cuic.trim();
    const setR = new Set(responsables); const setC = new Set(clientes); const setA = new Set(asesores);
    return data.filter(t => {
      if (setR.size && !(t.responsable && setR.has(t.responsable))) return false;
      if (setC.size) { const cl = clienteDe(t); if (!cl || !setC.has(cl)) return false; }
      if (setA.size && !(t.asesor && setA.has(t.asesor))) return false;
      if (cuicQ && !(t.cuic || '').includes(cuicQ)) return false;
      if (!coincideId(t, idFiltro)) return false;
      if (ocultarCanceladas && esCancelada(t)) return false;
      if (q && !textoBusqueda(t).includes(q)) return false;
      return true;
    });
  }, [data, search, responsables, clientes, asesores, cuic, idFiltro, ocultarCanceladas]);

  const columnasVisibles = COLUMNAS_POR_FILTRO[filtroRapido];

  const porColumna = useMemo(() => {
    const g: Record<ColumnaAC, ActividadComercialTarea[]> = { Abierto: [], Activo: [], Finalizado: [] };
    filtradas.forEach(t => g[columnaDeEstatus(t.estatus)].push(t));
    // Finalizadas: las mas recientes arriba. Resto: por fecha de entrega (ya viene asi del back).
    g.Finalizado.sort((a, b) => b.id - a.id);
    return g;
  }, [filtradas]);

  const totalVisible = columnasVisibles.reduce((n, col) => n + porColumna[col].length, 0);
  const conteoRapido: Record<FiltroRapidoAC, number> = {
    todas: filtradas.length,
    sin_finalizar: porColumna.Abierto.length + porColumna.Activo.length,
    finalizadas: porColumna.Finalizado.length,
  };

  const hayFiltros = !!(responsables.length || clientes.length || asesores.length || cuic.trim() || idFiltro.trim() || ocultarCanceladas);
  const limpiarFiltros = () => {
    setSearch(''); setResponsables([]); setClientes([]); setAsesores([]);
    setCuic(''); setIdFiltro(''); setOcultarCanceladas(false);
  };

  const mover = (id: number, columna: ColumnaAC) => {
    const t = data.find(x => x.id === id);
    if (!t || columnaDeEstatus(t.estatus) === columna) return;
    moverMutation.mutate({ id, columna });
  };

  // El detalle se lee de `data` para que refleje el movimiento sin cerrar el modal.
  const detalle = detalleId != null ? data.find(t => t.id === detalleId) ?? null : null;

  // ---- Drag & drop (HTML5) ----
  const onDragStart = (e: DragEvent, id: number) => {
    e.dataTransfer.setData(DND_MIME, String(id));
    e.dataTransfer.effectAllowed = 'move';
    arrastrando.current = true;
    setDraggingId(id);
  };
  const onDragEnd = () => {
    setDraggingId(null); setDragOverCol(null);
    // El click de soltar llega despues del dragend: se ignora en el siguiente tick.
    setTimeout(() => { arrastrando.current = false; }, 0);
  };
  const onDragOver = (e: DragEvent, col: ColumnaAC) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== col) setDragOverCol(col);
  };
  const onDrop = (e: DragEvent, col: ColumnaAC) => {
    e.preventDefault();
    const id = parseInt(e.dataTransfer.getData(DND_MIME), 10);
    setDragOverCol(null);
    setDraggingId(null);
    if (Number.isFinite(id)) mover(id, col);
  };

  const subText = isDark ? 'text-zinc-400' : 'text-gray-500';
  const cardBg = isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-gray-200';
  const inputCls = isDark
    ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400';
  const btnSecondary = isDark
    ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
    : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600';

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className={`rounded-xl border ${cardBg}`}>
        <div className="p-4 flex flex-wrap items-center gap-2.5">
          {/* Filtros rapidos */}
          <div className={`flex items-center rounded-lg border p-0.5 ${isDark ? 'border-zinc-700 bg-zinc-800/60' : 'border-gray-200 bg-gray-50'}`}>
            {FILTROS_RAPIDOS.map(f => {
              const on = filtroRapido === f;
              return (
                <button
                  key={f}
                  onClick={() => setFiltroRapido(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    on
                      ? 'bg-purple-600 text-white shadow-sm'
                      : isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {FILTRO_RAPIDO_LABEL[f]}
                  <span className={`px-1.5 py-px rounded-full text-[10px] ${on ? 'bg-white/20' : isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-200 text-gray-600'}`}>
                    {conteoRapido[f]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Busqueda */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${subText}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, marca, descripción, responsable, CUIC, #ref..."
              className={`w-full rounded-lg border pl-9 pr-8 py-2 text-sm ${inputCls}`}
            />
            {search && (
              <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${subText}`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <FiltroMultiple
            label="Responsables"
            icon={User}
            options={opciones.responsables}
            selected={responsables}
            onChange={setResponsables}
            isDark={isDark}
            placeholder="Buscar responsable..."
          />

          <span className={`text-xs ${subText}`}>{totalVisible} de {data.length}</span>

          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: QK_ACTIVIDAD_COMERCIAL })}
            className={`p-2 rounded-lg border transition-colors ${btnSecondary}`}
            title="Refrescar"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowMoreFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
              showMoreFilters || hayFiltros ? 'border-purple-500 text-purple-500' : btnSecondary
            }`}
            title="Más filtros"
          >
            <Filter className="h-4 w-4" />
            {hayFiltros && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] font-bold">
                {[responsables.length, clientes.length, asesores.length, cuic.trim(), idFiltro.trim(), ocultarCanceladas].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {showMoreFilters && (
          <div className="px-4 pb-4 pt-0">
            <div className={`flex flex-wrap items-end gap-3 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Cliente</label>
                <FiltroMultiple label="Clientes" icon={Building2} options={opciones.clientes} selected={clientes} onChange={setClientes} isDark={isDark} placeholder="Buscar cliente..." />
              </div>
              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>Asesor de la cuenta</label>
                <FiltroMultiple label="Asesores" icon={Users} options={opciones.asesores} selected={asesores} onChange={setAsesores} isDark={isDark} placeholder="Buscar asesor..." />
              </div>
              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>CUIC</label>
                <div className="relative">
                  <Hash className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${subText}`} />
                  <input
                    type="text"
                    value={cuic}
                    onChange={(e) => setCuic(e.target.value)}
                    placeholder="Contiene..."
                    className={`rounded-lg border pl-8 pr-3 py-1.5 text-sm w-36 ${inputCls}`}
                  />
                </div>
              </div>
              <div>
                <label className={`text-xs font-medium mb-1 block ${subText}`}>ID</label>
                <input
                  type="text"
                  value={idFiltro}
                  onChange={(e) => setIdFiltro(e.target.value)}
                  placeholder="Tarea, campaña o propuesta"
                  title="Coincidencia exacta con el # de tarea, campaña, propuesta o referencia"
                  className={`rounded-lg border px-3 py-1.5 text-sm w-44 ${inputCls}`}
                />
              </div>
              <label className={`flex items-center gap-2 text-xs cursor-pointer pb-2 ${subText}`}>
                <input
                  type="checkbox"
                  checked={ocultarCanceladas}
                  onChange={(e) => setOcultarCanceladas(e.target.checked)}
                  className="h-3.5 w-3.5 accent-purple-600"
                />
                Ocultar canceladas
              </label>
              {(hayFiltros || search) && (
                <button
                  onClick={limpiarFiltros}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-500 hover:text-purple-400 border border-purple-500/30 hover:border-purple-500/50 transition-colors"
                >
                  Limpiar todo
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tablero */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 items-start ${columnasVisibles.length === 3 ? 'md:grid-cols-3' : columnasVisibles.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {columnasVisibles.map(col => {
            const c = COLUMNA_COLOR[col];
            const items = porColumna[col];
            const activa = dragOverCol === col;
            // Con una sola columna (Finalizadas) las tarjetas van en rejilla para no hacer una tira infinita.
            const unaColumna = columnasVisibles.length === 1;
            return (
              <div
                key={col}
                onDragOver={(e) => onDragOver(e, col)}
                onDragLeave={() => { if (dragOverCol === col) setDragOverCol(null); }}
                onDrop={(e) => onDrop(e, col)}
                className={`rounded-xl border transition-shadow ${c.border} ${activa ? `ring-2 ${c.drop}` : ''}`}
              >
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${c.bg}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                      <span className={`text-sm font-semibold ${c.text}`}>{COLUMNA_LABEL[col]}</span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${subText}`}>{COLUMNA_DESCRIPCION[col]}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                    {items.length}
                  </span>
                </div>
                <div className={`p-2 rounded-b-xl min-h-[240px] max-h-[calc(100vh-320px)] overflow-y-auto ${isDark ? 'bg-zinc-900/30' : 'bg-gray-50/60'} ${unaColumna ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 content-start' : 'space-y-2'}`}>
                  {items.map(t => (
                    <TarjetaActividad
                      key={t.id}
                      tarea={t}
                      columna={col}
                      isDark={isDark}
                      dragging={draggingId === t.id}
                      puedeEditar={puedeEditar(t)}
                      moviendo={moverMutation.isPending && moverMutation.variables?.id === t.id}
                      onDragStart={(e) => onDragStart(e, t.id)}
                      onDragEnd={onDragEnd}
                      onMover={(destino) => mover(t.id, destino)}
                      onEditar={() => setEditing(t)}
                      onAbrir={() => { if (!arrastrando.current) setDetalleId(t.id); }}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className={`flex flex-col items-center justify-center py-10 ${unaColumna ? 'col-span-full' : ''} ${isDark ? 'text-zinc-600' : 'text-gray-300'}`}>
                      <Circle className="h-8 w-8 mb-2 opacity-50" />
                      <span className="text-xs">{activa ? 'Suelta aquí' : 'Sin actividades'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detalle (click en tarjeta) */}
      {detalle && (
        <DetalleActividadModal
          tarea={detalle}
          isDark={isDark}
          puedeEditar={puedeEditar(detalle)}
          moviendo={moverMutation.isPending && moverMutation.variables?.id === detalle.id}
          onClose={() => setDetalleId(null)}
          onMover={(col) => mover(detalle.id, col)}
          onEditar={() => setEditing(detalle)}
        />
      )}

      {/* Edicion: reusa el modal de Notificaciones (creador o Admin/DEV; el back re-valida). */}
      <NuevaActividadComercialModal
        isOpen={!!editing}
        onClose={() => {
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: QK_ACTIVIDAD_COMERCIAL });
        }}
        editing={editing ? { id: editing.id, descripcion: editing.descripcion, fecha_fin: editing.fecha_fin, contenido: editing.contenido } : null}
      />
    </div>
  );
}

// ---------- Tarjeta ----------

function TarjetaActividad({
  tarea, columna, isDark, dragging, puedeEditar, moviendo, onDragStart, onDragEnd, onMover, onEditar, onAbrir,
}: {
  tarea: ActividadComercialTarea;
  columna: ColumnaAC;
  isDark: boolean;
  dragging: boolean;
  puedeEditar: boolean;
  moviendo: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onMover: (destino: ColumnaAC) => void;
  onEditar: () => void;
  onAbrir: () => void;
}) {
  const c = parseContenidoAC(tarea.contenido);
  const cancelada = esCancelada(tarea);
  const vencida = estaVencida(tarea);
  const idx = COLUMNAS_AC.indexOf(columna);
  const anterior = idx > 0 ? COLUMNAS_AC[idx - 1] : null;
  const siguiente = idx < COLUMNAS_AC.length - 1 ? COLUMNAS_AC[idx + 1] : null;
  const cliente = clienteDe(tarea);

  const chips: { icon: typeof Tag; text: string }[] = [];
  if (cliente) chips.push({ icon: Building2, text: c.marca ? `${cliente} · ${c.marca}` : cliente });
  else if (c.marca) chips.push({ icon: Building2, text: c.marca });
  if (c.subtipo) chips.push({ icon: Tag, text: c.ref_id != null ? `${c.subtipo} #${c.ref_id}` : c.subtipo });
  if (c.catorcena || c.anio) chips.push({ icon: Layers, text: [c.catorcena ? `Cat ${c.catorcena}` : null, c.anio].filter(Boolean).join(' / ') });
  if (c.base) chips.push({ icon: Tag, text: c.base });
  if (tarea.cuic) chips.push({ icon: Hash, text: `CUIC ${tarea.cuic}` });

  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';
  const txt = isDark ? 'text-white' : 'text-gray-900';
  const iconBtn = isDark ? 'text-zinc-500 hover:text-white hover:bg-zinc-700' : 'text-gray-400 hover:text-gray-800 hover:bg-gray-200';

  return (
    <div
      draggable={!moviendo}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onAbrir}
      title="Click para ver el detalle · arrastra para cambiar de columna"
      className={`group rounded-xl border p-3 transition-all ${
        isDark ? 'bg-zinc-800/60 border-zinc-700/60 hover:border-zinc-600' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
      } ${dragging ? 'opacity-40' : ''} ${cancelada ? 'opacity-60' : ''} ${moviendo ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-500 border border-amber-500/30">
          <Briefcase className="h-3 w-3" />
          Actividad Comercial
        </span>
        <div className="flex items-center gap-1">
          {cancelada && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-200 text-gray-600'}`}>Cancelada</span>
          )}
          {vencida && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400" title="Fecha de entrega vencida">
              <AlertTriangle className="h-3 w-3" /> Vencida
            </span>
          )}
          <span className={`text-[10px] font-mono ${sub}`}>#{tarea.id}</span>
        </div>
      </div>

      <h4 className={`text-sm font-medium leading-snug ${txt}`}>{tituloCorto(tarea.titulo)}</h4>
      {tarea.descripcion && (
        <p className={`text-xs mt-1 line-clamp-3 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{tarea.descripcion}</p>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {chips.map((ch, i) => (
            <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${isDark ? 'bg-zinc-900/60 border-zinc-700 text-zinc-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
              <ch.icon className="h-3 w-3 opacity-70" />
              {ch.text}
            </span>
          ))}
        </div>
      )}

      <div className={`flex items-center justify-between gap-2 mt-2.5 pt-2 border-t ${isDark ? 'border-zinc-700/60' : 'border-gray-100'}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {tarea.responsable && <UserAvatar nombre={tarea.responsable} size="sm" />}
          <span className={`text-[11px] truncate ${sub}`} title={tarea.responsable || ''}>{tarea.responsable || '—'}</span>
        </div>
        <div className={`flex items-center gap-1 text-[10px] shrink-0 ${vencida ? 'text-red-400' : sub}`} title="Inicio → entrega">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(tarea.fecha_inicio)}</span>
          <ArrowRight className="h-2.5 w-2.5 opacity-60" />
          <span>{formatDate(tarea.fecha_fin)}</span>
        </div>
      </div>

      {/* Acciones (alternativa al arrastre; visibles al pasar el mouse). stopPropagation: no abrir el detalle. */}
      <div className="flex items-center justify-between gap-1 mt-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <div className="flex items-center gap-1">
          {anterior && (
            <button
              onClick={(e) => { e.stopPropagation(); onMover(anterior); }}
              disabled={moviendo}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-colors disabled:opacity-50 ${isDark ? 'border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700' : 'border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
              title={`Mover a ${COLUMNA_LABEL[anterior]}`}
            >
              <ArrowLeft className="h-3 w-3" /> {COLUMNA_LABEL[anterior]}
            </button>
          )}
          {siguiente && (
            <button
              onClick={(e) => { e.stopPropagation(); onMover(siguiente); }}
              disabled={moviendo}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-colors disabled:opacity-50 ${COLUMNA_COLOR[siguiente].border} ${COLUMNA_COLOR[siguiente].text}`}
              title={`Mover a ${COLUMNA_LABEL[siguiente]}`}
            >
              {COLUMNA_LABEL[siguiente]} <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
        {puedeEditar && (
          <button onClick={(e) => { e.stopPropagation(); onEditar(); }} className={`p-1 rounded-md transition-colors ${iconBtn}`} title="Editar actividad">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
