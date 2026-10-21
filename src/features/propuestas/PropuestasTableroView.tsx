import { useCallback, useMemo } from 'react';
import { Building2, Calendar, DollarSign, History, User } from 'lucide-react';
import { Propuesta } from '../../types';
import { formatCurrency, formatDate, formatDateCompact } from '../../lib/utils';
import { TableroBoard, TableroCard, type TableroColumna } from '../../components/tablero/TableroBoard';
import { buildMapaColumnas, normalizaEstatus } from '../../lib/tableroVistas';
import { getStatusColor, esPropuestaIncompleta, IncompletaBadge } from './propuestaEstatus';

// Vista Tablero de Propuestas: una columna por estatus del flujo comercial.
//
// Es de solo lectura en cuanto a mover tarjetas: el estatus se cambia con el
// mismo modal de la tabla (valida permisos, bloqueos por rol y comentario de
// cambio de estado). Arrastrar entre columnas se brincaria esas reglas.

// Orden canonico = el flujo real de la propuesta, de abierta a aprobada.
// `key` es el valor tal como vive en BD; `label` es como lo pidio negocio.
export const PROPUESTAS_COLUMNAS: readonly TableroColumna[] = [
  {
    key: 'Abierto',
    label: 'Abierto',
    descripcion: 'Sin atender',
    color: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' },
  },
  {
    key: 'Atendido',
    label: 'Atendido',
    descripcion: 'Trabajada por inventarios',
    color: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', dot: 'bg-cyan-500' },
  },
  {
    key: 'Ajuste Comercial',
    label: 'Ajuste Comercial',
    descripcion: 'Regreso a comercial',
    color: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' },
  },
  {
    key: 'Ajuste Cto-Cliente',
    label: 'Ajuste CTO Cliente',
    descripcion: 'Ajuste pedido por el cliente',
    // En BD convive con la escritura de campanas ('Ajuste CTO Cliente').
    alias: ['Ajuste CTO Cliente', 'Ajuste Cto Cliente'],
    color: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-500' },
  },
  {
    key: 'Ajuste Inventario',
    label: 'Ajuste Inventario',
    descripcion: 'Ajuste de disponibilidad',
    color: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', dot: 'bg-rose-500' },
  },
  {
    key: 'Pase a ventas',
    label: 'Pase a Ventas',
    descripcion: 'Lista para cerrar',
    alias: ['Pase a Ventas'],
    color: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  },
  {
    key: 'Aprobada',
    label: 'Aprobada',
    descripcion: 'Cerrada y aprobada',
    color: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-500' },
  },
];

export const PROPUESTAS_COLUMNAS_KEYS: string[] = PROPUESTAS_COLUMNAS.map(c => c.key);

const MAPA_COLUMNAS = buildMapaColumnas(PROPUESTAS_COLUMNAS);

/** Columna a la que pertenece la propuesta, o null si su estatus no tiene columna. */
export function columnaDePropuesta(status: string | null | undefined): string | null {
  return MAPA_COLUMNAS.get(normalizaEstatus(status)) ?? null;
}

interface PropuestasTableroViewProps {
  /** Ya filtradas y ordenadas por la pagina (misma fuente que la tabla). */
  items: Propuesta[];
  columnasVisibles: string[];
  isDark: boolean;
  isLoading: boolean;
  /** Si el usuario puede abrir el modal de cambio de estatus para esta propuesta. */
  puedeEditarStatus: (p: Propuesta) => boolean;
  onStatus: (p: Propuesta) => void;
  onAssign: (p: Propuesta) => void;
}

export default function PropuestasTableroView({
  items,
  columnasVisibles,
  isDark,
  isLoading,
  puedeEditarStatus,
  onStatus,
  onAssign,
}: PropuestasTableroViewProps) {
  const columnas = useMemo(
    () => PROPUESTAS_COLUMNAS.filter(c => columnasVisibles.includes(c.key)),
    [columnasVisibles],
  );

  const getColumnaKey = useCallback((p: Propuesta) => columnaDePropuesta(p.status), []);
  const getId = useCallback((p: Propuesta) => p.id, []);

  const renderCard = useCallback((p: Propuesta) => (
    <TarjetaPropuesta
      propuesta={p}
      isDark={isDark}
      puedeEditarStatus={puedeEditarStatus(p)}
      onStatus={() => onStatus(p)}
      onAbrir={() => onAssign(p)}
    />
  ), [isDark, puedeEditarStatus, onStatus, onAssign]);

  return (
    <TableroBoard
      columnas={columnas}
      items={items}
      getColumnaKey={getColumnaKey}
      getId={getId}
      renderCard={renderCard}
      isDark={isDark}
      isLoading={isLoading}
      entidadPlural="propuestas"
    />
  );
}

// ---------- Tarjeta ----------

function TarjetaPropuesta({
  propuesta, isDark, puedeEditarStatus, onStatus, onAbrir,
}: {
  propuesta: Propuesta;
  isDark: boolean;
  puedeEditarStatus: boolean;
  onStatus: () => void;
  onAbrir: () => void;
}) {
  const statusColor = getStatusColor(propuesta.status, isDark);
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';
  const txt = isDark ? 'text-white' : 'text-gray-900';
  const soft = isDark ? 'text-zinc-400' : 'text-gray-500';

  const titulo = propuesta.marca_nombre || propuesta.nombre_comercial || propuesta.articulo || 'Sin marca';
  const campana = propuesta.campana_nombre || propuesta.nombre_campania || propuesta.descripcion;

  const catorcena = propuesta.catorcena_inicio
    ? `Cat ${String(propuesta.catorcena_inicio).padStart(2, '0')}${
        propuesta.catorcena_fin && propuesta.catorcena_fin !== propuesta.catorcena_inicio
          ? `-${String(propuesta.catorcena_fin).padStart(2, '0')}`
          : ''
      }${propuesta.anio_inicio ? ` / ${propuesta.anio_inicio}` : ''}`
    : null;

  return (
    <TableroCard isDark={isDark} onClick={onAbrir} title="Abrir inventario de la propuesta">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-purple-500/10 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>
          #{propuesta.campania_id || propuesta.id}
        </span>
        {/* Fecha de ultima edicion: lo que el tablero usa para ordenar por
            "ultimo cambio". Sin dato, se dice, no se inventa. */}
        <span
          className={`inline-flex items-center gap-1 text-[10px] ${sub}`}
          title={propuesta.updated_at ? `Última edición: ${formatDate(propuesta.updated_at)}` : 'Sin registro de edición'}
        >
          <History className="h-3 w-3" />
          {propuesta.updated_at ? formatDateCompact(propuesta.updated_at) : '—'}
        </span>
      </div>

      <p className={`text-xs font-semibold truncate ${txt}`} title={titulo}>{titulo}</p>
      {campana && (
        <p className={`text-[11px] truncate mt-0.5 ${soft}`} title={campana}>{campana}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {catorcena && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${sub}`}>
            <Calendar className="h-3 w-3" />
            {catorcena}
          </span>
        )}
        {propuesta.inversion != null && Number(propuesta.inversion) > 0 && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${sub}`}>
            <DollarSign className="h-3 w-3" />
            {formatCurrency(Number(propuesta.inversion))}
          </span>
        )}
      </div>

      {(propuesta.asesor || propuesta.asignado) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {propuesta.asesor && (
            <span className={`inline-flex items-center gap-1 text-[10px] truncate max-w-full ${sub}`} title={`Asesor: ${propuesta.asesor}`}>
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{propuesta.asesor}</span>
            </span>
          )}
          {propuesta.asignado && (
            <span className={`inline-flex items-center gap-1 text-[10px] truncate max-w-full ${sub}`} title={`Asignado: ${propuesta.asignado}`}>
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{propuesta.asignado}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap mt-2">
        {puedeEditarStatus ? (
          <button
            onClick={(e) => { e.stopPropagation(); onStatus(); }}
            className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap ${statusColor.bg} ${statusColor.text} border ${statusColor.border} hover:opacity-80 transition-opacity`}
            title="Cambiar estatus"
          >
            {propuesta.status}
          </button>
        ) : (
          <span className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
            {propuesta.status}
          </span>
        )}
        {esPropuestaIncompleta(propuesta) && (
          <span onClick={(e) => e.stopPropagation()}>
            <IncompletaBadge propuesta={propuesta} isDark={isDark} />
          </span>
        )}
      </div>
    </TableroCard>
  );
}
