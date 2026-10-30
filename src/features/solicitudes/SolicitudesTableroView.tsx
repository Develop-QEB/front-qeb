import { useCallback, useMemo } from 'react';
import { Building2, Calendar, DollarSign, History, LayoutList, User } from 'lucide-react';
import { Solicitud } from '../../types';
import { formatCurrency, formatDate, formatDateCompact } from '../../lib/utils';
import { TableroBoard, TableroCard, type TableroColumna } from '../../components/tablero/TableroBoard';
import { buildMapaColumnas, normalizaEstatus } from '../../lib/tableroVistas';
import { SolicitudAcciones, puedeCambiarStatusSolicitud, type SolicitudAccionesProps } from './SolicitudAcciones';

/** Permisos y callbacks de la fila de acciones; los mismos que recibe la fila de la tabla. */
export type SolicitudAccionesCtx = Omit<SolicitudAccionesProps, 'item' | 'isDark' | 'compact'>;

// Vista Tablero de Solicitudes: una columna por estatus.
//
// Solo lectura en cuanto a mover tarjetas. Clic en la tarjeta abre el mismo
// ViewSolicitudModal de la tabla (que ya decide si se puede editar / atender
// segun estatus); el badge abre el StatusModal, que se pone en solo lectura
// para 'Atendida' igual que en la tabla.

// Flujo real de la solicitud. 'Rechazada' no tiene columna porque el listado
// la oculta por default (igual que la tabla); 'Desactivada' es historico.
export const SOLICITUDES_COLUMNAS: readonly TableroColumna[] = [
  {
    key: 'Pendiente',
    label: 'Pendiente',
    descripcion: 'Por revisar',
    color: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' },
  },
  {
    key: 'Ajustar',
    label: 'Ajustar',
    descripcion: 'Regresó con ajustes',
    color: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-500' },
  },
  {
    key: 'Aprobada',
    label: 'Aprobada',
    descripcion: 'Lista para atender',
    color: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  },
  {
    key: 'Atendida',
    label: 'Atendida',
    descripcion: 'Ya se fue a propuestas',
    color: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', dot: 'bg-cyan-500' },
  },
];

export const SOLICITUDES_COLUMNAS_KEYS: string[] = SOLICITUDES_COLUMNAS.map(c => c.key);

const MAPA_COLUMNAS = buildMapaColumnas(SOLICITUDES_COLUMNAS);

export function columnaDeSolicitud(status: string | null | undefined): string | null {
  return MAPA_COLUMNAS.get(normalizaEstatus(status)) ?? null;
}

/**
 * "Incompleta" en Solicitudes = sin circuitos cargados.
 *
 * Una solicitud no tiene reservas todavia (eso es de propuestas/campanas), asi
 * que el criterio de "reservas vs caras esperadas" no aplica. Lo que si puede
 * faltarle es el contenido: `formatos` lo arma el listado con los
 * solicitudCaras de la propuesta ligada (que nace en la misma transaccion que
 * la solicitud), asi que vacio significa que nadie le ha cargado circuitos.
 */
export function esSolicitudIncompleta(s: Pick<Solicitud, 'formatos'>): boolean {
  return !s.formatos || !s.formatos.trim();
}

interface SolicitudesTableroViewProps {
  /** Ya filtradas y ordenadas por la pagina (misma fuente que la tabla). */
  items: Solicitud[];
  columnasVisibles: string[];
  isDark: boolean;
  isLoading: boolean;
  onStatus: (s: Solicitud) => void;
  onAbrir: (s: Solicitud) => void;
  /** Fila de iconos de accion al pie de la tarjeta (misma que la tabla). */
  acciones: SolicitudAccionesCtx;
}

export default function SolicitudesTableroView({
  items,
  columnasVisibles,
  isDark,
  isLoading,
  onStatus,
  onAbrir,
  acciones,
}: SolicitudesTableroViewProps) {
  const columnas = useMemo(
    () => SOLICITUDES_COLUMNAS.filter(c => columnasVisibles.includes(c.key)),
    [columnasVisibles],
  );

  const getColumnaKey = useCallback((s: Solicitud) => columnaDeSolicitud(s.status), []);
  const getId = useCallback((s: Solicitud) => s.id, []);

  const renderCard = useCallback((s: Solicitud) => (
    <TarjetaSolicitud
      solicitud={s}
      isDark={isDark}
      onStatus={puedeCambiarStatusSolicitud(s) ? () => onStatus(s) : undefined}
      onAbrir={() => onAbrir(s)}
      acciones={acciones}
    />
  ), [isDark, onStatus, onAbrir, acciones]);

  return (
    <TableroBoard
      columnas={columnas}
      items={items}
      getColumnaKey={getColumnaKey}
      getId={getId}
      renderCard={renderCard}
      isDark={isDark}
      isLoading={isLoading}
      entidadPlural="solicitudes"
    />
  );
}

// ---------- Tarjeta ----------

function TarjetaSolicitud({
  solicitud, isDark, onStatus, onAbrir, acciones,
}: {
  solicitud: Solicitud;
  isDark: boolean;
  /** undefined = Atendida, el estatus ya no se cambia desde este modulo. */
  onStatus?: () => void;
  onAbrir: () => void;
  acciones: SolicitudAccionesCtx;
}) {
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';
  const txt = isDark ? 'text-white' : 'text-gray-900';
  const soft = isDark ? 'text-zinc-400' : 'text-gray-500';

  const titulo = solicitud.razon_social || solicitud.marca_nombre || 'Sin cliente';
  const subtitulo = solicitud.nombre_campania || solicitud.marca_nombre || solicitud.descripcion;

  const catorcena = solicitud.catorcena_inicio
    ? `Cat ${String(solicitud.catorcena_inicio).padStart(2, '0')}${
        solicitud.catorcena_fin && solicitud.catorcena_fin !== solicitud.catorcena_inicio
          ? `-${String(solicitud.catorcena_fin).padStart(2, '0')}`
          : ''
      }${solicitud.anio_inicio ? ` / ${solicitud.anio_inicio}` : ''}`
    : null;

  const incompleta = esSolicitudIncompleta(solicitud);

  return (
    <TableroCard isDark={isDark} onClick={onAbrir} title="Ver detalle de la solicitud">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-purple-500/10 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>
          #{solicitud.campania_id || solicitud.id}
        </span>
        {/* Fecha de ultima edicion. Requiere solicitud.updated_at (columna +
            schema de prisma): mientras no exista llega vacia y se dice "—". */}
        <span
          className={`inline-flex items-center gap-1 text-[10px] ${sub}`}
          title={solicitud.updated_at ? `Última edición: ${formatDate(solicitud.updated_at)}` : 'Sin registro de edición'}
        >
          <History className="h-3 w-3" />
          {solicitud.updated_at ? formatDateCompact(solicitud.updated_at) : '—'}
        </span>
      </div>

      <p className={`text-xs font-semibold truncate ${txt}`} title={titulo}>{titulo}</p>
      {subtitulo && subtitulo !== titulo && (
        <p className={`text-[11px] truncate mt-0.5 ${soft}`} title={subtitulo}>{subtitulo}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className={`inline-flex items-center gap-1 text-[10px] ${sub}`} title="Fecha de creación">
          <Calendar className="h-3 w-3" />
          {formatDate(solicitud.fecha)}
        </span>
        {catorcena && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${sub}`}>
            <Calendar className="h-3 w-3" />
            {catorcena}
          </span>
        )}
        {Number(solicitud.presupuesto) > 0 && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${sub}`}>
            <DollarSign className="h-3 w-3" />
            {formatCurrency(Number(solicitud.presupuesto))}
          </span>
        )}
      </div>

      {(solicitud.asesor || solicitud.nombre_usuario) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {solicitud.asesor && (
            <span className={`inline-flex items-center gap-1 text-[10px] truncate max-w-full ${sub}`} title={`Asesor: ${solicitud.asesor}`}>
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{solicitud.asesor}</span>
            </span>
          )}
          {solicitud.nombre_usuario && (
            <span className={`inline-flex items-center gap-1 text-[10px] truncate max-w-full ${sub}`} title={`Creador: ${solicitud.nombre_usuario}`}>
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{solicitud.nombre_usuario}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap mt-2">
        {onStatus ? (
          <button
            onClick={(e) => { e.stopPropagation(); onStatus(); }}
            className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap border transition-opacity hover:opacity-80 ${
              isDark ? 'bg-zinc-700/60 text-zinc-200 border-zinc-600' : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}
            title="Ver / cambiar estatus"
          >
            {solicitud.status}
          </button>
        ) : (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap border ${
              isDark ? 'bg-zinc-700/60 text-zinc-200 border-zinc-600' : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}
            title="Atendida: ya se fue a propuestas, el estatus no se cambia desde aquí"
          >
            {solicitud.status}
          </span>
        )}
        {solicitud.formatos && (
          <span className={`inline-flex items-center gap-1 text-[10px] truncate max-w-[150px] ${sub}`} title={`Formatos: ${solicitud.formatos}`}>
            <LayoutList className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{solicitud.formatos}</span>
          </span>
        )}
        {incompleta && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[9px] border border-yellow-500/30 ${isDark ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-50 text-yellow-700'}`}
            title="Sin circuitos cargados"
          >
            Sin circuitos
          </span>
        )}
      </div>

      {/* Fila de acciones al pie, como en una tarjeta de CRM. Es el MISMO
          componente que la celda Acciones de la tabla: mismos permisos y
          candados (Atendida: ni editar, ni estatus, ni rechazar).
          stopPropagation para que un clic en un boton no abra ademas la
          tarjeta. */}
      <div
        className={`mt-2 pt-2 border-t ${isDark ? 'border-zinc-700/60' : 'border-gray-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <SolicitudAcciones item={solicitud} isDark={isDark} compact {...acciones} />
      </div>
    </TableroCard>
  );
}
