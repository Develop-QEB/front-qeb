import { useMemo, useState, type DragEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase, Calendar, Search, X, RefreshCw, Circle, Pencil, ArrowRight, ArrowLeft,
  AlertTriangle, Building2, Tag, Layers,
} from 'lucide-react';
import { historialService, type ActividadComercialTarea } from '../../services/historial.service';
import { useAuthStore } from '../../store/authStore';
import { UserAvatar } from '../../components/ui/user-avatar';
import { formatDate } from '../../lib/utils';
import { NuevaActividadComercialModal } from '../notificaciones/NuevaActividadComercialModal';
import {
  COLUMNAS_AC, COLUMNA_LABEL, COLUMNA_DESCRIPCION, COLUMNA_COLOR, QK_ACTIVIDAD_COMERCIAL, type ColumnaAC,
  columnaDeEstatus, esCancelada, parseContenidoAC, tituloCorto, estaVencida, textoBusqueda,
} from './actividadComercial';

// Tablero CRM de Actividad Comercial: 3 columnas por estatus de la tarea,
// drag & drop entre columnas (HTML5 nativo, sin dependencias) y botones
// "mover" como alternativa. Muestra TODAS las actividades (de todos los
// usuarios): el tab vive en Historial de Acciones, que ya es solo para
// roles directivos/admin.
const DND_MIME = 'application/x-qeb-actividad-id';

interface Props {
  isDark: boolean;
}

export function ActividadComercialBoard({ isDark }: Props) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? null;

  const [search, setSearch] = useState('');
  const [responsable, setResponsable] = useState('');
  const [ocultarCanceladas, setOcultarCanceladas] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<ColumnaAC | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
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

  const responsables = useMemo(() => {
    const set = new Set<string>();
    data.forEach(t => { if (t.responsable) set.add(t.responsable); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [data]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter(t => {
      if (responsable && t.responsable !== responsable) return false;
      if (ocultarCanceladas && esCancelada(t)) return false;
      if (q && !textoBusqueda(t).includes(q)) return false;
      return true;
    });
  }, [data, search, responsable, ocultarCanceladas]);

  const porColumna = useMemo(() => {
    const g: Record<ColumnaAC, ActividadComercialTarea[]> = { Abierto: [], Activo: [], Finalizado: [] };
    filtradas.forEach(t => g[columnaDeEstatus(t.estatus)].push(t));
    // Finalizadas: las mas recientes arriba. Resto: por fecha de entrega (ya viene asi del back).
    g.Finalizado.sort((a, b) => b.id - a.id);
    return g;
  }, [filtradas]);

  const mover = (id: number, columna: ColumnaAC) => {
    const t = data.find(x => x.id === id);
    if (!t || columnaDeEstatus(t.estatus) === columna) return;
    moverMutation.mutate({ id, columna });
  };

  // ---- Drag & drop (HTML5) ----
  const onDragStart = (e: DragEvent, id: number) => {
    e.dataTransfer.setData(DND_MIME, String(id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };
  const onDragEnd = () => { setDraggingId(null); setDragOverCol(null); };
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
  const inputCls = isDark
    ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400';
  const btnSecondary = isDark
    ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
    : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600';

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-2.5 ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-gray-200'}`}>
        <div className="relative flex-1 min-w-[220px]">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${subText}`} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, marca, descripción, responsable, #ref..."
            className={`w-full rounded-lg border pl-9 pr-8 py-2 text-sm ${inputCls}`}
          />
          {search && (
            <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${subText}`}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={responsable}
          onChange={(e) => setResponsable(e.target.value)}
          className={`rounded-lg border px-3 py-2 text-sm min-w-[180px] ${inputCls}`}
        >
          <option value="">Todos los responsables</option>
          {responsables.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <label className={`flex items-center gap-2 text-xs cursor-pointer ${subText}`}>
          <input
            type="checkbox"
            checked={ocultarCanceladas}
            onChange={(e) => setOcultarCanceladas(e.target.checked)}
            className="h-3.5 w-3.5 accent-purple-600"
          />
          Ocultar canceladas
        </label>

        <span className={`text-xs ml-auto ${subText}`}>
          {filtradas.length} de {data.length}
        </span>

        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: QK_ACTIVIDAD_COMERCIAL })}
          className={`p-2 rounded-lg border transition-colors ${btnSecondary}`}
          title="Refrescar"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tablero */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {COLUMNAS_AC.map(col => {
            const c = COLUMNA_COLOR[col];
            const items = porColumna[col];
            const activa = dragOverCol === col;
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
                <div className={`p-2 rounded-b-xl min-h-[240px] max-h-[calc(100vh-320px)] overflow-y-auto space-y-2 ${isDark ? 'bg-zinc-900/30' : 'bg-gray-50/60'}`}>
                  {items.map(t => (
                    <TarjetaActividad
                      key={t.id}
                      tarea={t}
                      columna={col}
                      isDark={isDark}
                      dragging={draggingId === t.id}
                      puedeEditar={currentUserId != null && t.id_responsable === currentUserId}
                      moviendo={moverMutation.isPending && moverMutation.variables?.id === t.id}
                      onDragStart={(e) => onDragStart(e, t.id)}
                      onDragEnd={onDragEnd}
                      onMover={(destino) => mover(t.id, destino)}
                      onEditar={() => setEditing(t)}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className={`flex flex-col items-center justify-center py-10 ${isDark ? 'text-zinc-600' : 'text-gray-300'}`}>
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

      {/* Edicion: reusa el modal de Notificaciones (solo el creador; el back re-valida rol). */}
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
  tarea, columna, isDark, dragging, puedeEditar, moviendo, onDragStart, onDragEnd, onMover, onEditar,
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
}) {
  const c = parseContenidoAC(tarea.contenido);
  const cancelada = esCancelada(tarea);
  const vencida = estaVencida(tarea);
  const idx = COLUMNAS_AC.indexOf(columna);
  const anterior = idx > 0 ? COLUMNAS_AC[idx - 1] : null;
  const siguiente = idx < COLUMNAS_AC.length - 1 ? COLUMNAS_AC[idx + 1] : null;

  const chips: { icon: typeof Tag; text: string }[] = [];
  if (c.cliente) chips.push({ icon: Building2, text: c.marca ? `${c.cliente} · ${c.marca}` : c.cliente });
  else if (c.marca) chips.push({ icon: Building2, text: c.marca });
  if (c.subtipo) chips.push({ icon: Tag, text: c.ref_id != null ? `${c.subtipo} #${c.ref_id}` : c.subtipo });
  if (c.catorcena || c.anio) chips.push({ icon: Layers, text: [c.catorcena ? `Cat ${c.catorcena}` : null, c.anio].filter(Boolean).join(' / ') });
  if (c.base) chips.push({ icon: Tag, text: c.base });

  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';
  const txt = isDark ? 'text-white' : 'text-gray-900';
  const iconBtn = isDark ? 'text-zinc-500 hover:text-white hover:bg-zinc-700' : 'text-gray-400 hover:text-gray-800 hover:bg-gray-200';

  return (
    <div
      draggable={!moviendo}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
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

      {/* Acciones (alternativa al arrastre; visibles al pasar el mouse) */}
      <div className="flex items-center justify-between gap-1 mt-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <div className="flex items-center gap-1">
          {anterior && (
            <button
              onClick={() => onMover(anterior)}
              disabled={moviendo}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-colors disabled:opacity-50 ${isDark ? 'border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700' : 'border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
              title={`Mover a ${COLUMNA_LABEL[anterior]}`}
            >
              <ArrowLeft className="h-3 w-3" /> {COLUMNA_LABEL[anterior]}
            </button>
          )}
          {siguiente && (
            <button
              onClick={() => onMover(siguiente)}
              disabled={moviendo}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-colors disabled:opacity-50 ${COLUMNA_COLOR[siguiente].border} ${COLUMNA_COLOR[siguiente].text} hover:${COLUMNA_COLOR[siguiente].bg}`}
              title={`Mover a ${COLUMNA_LABEL[siguiente]}`}
            >
              {COLUMNA_LABEL[siguiente]} <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
        {puedeEditar && (
          <button onClick={onEditar} className={`p-1 rounded-md transition-colors ${iconBtn}`} title="Editar actividad">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
