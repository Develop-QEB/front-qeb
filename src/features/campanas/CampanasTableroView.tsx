import { useCallback, useMemo } from 'react';
import { Building2, Calendar, DollarSign, History, Megaphone } from 'lucide-react';
import { Campana } from '../../types';
import { formatCurrency, formatDate, formatDateCompact } from '../../lib/utils';
import { TableroBoard, TableroCard, type TableroColumna } from '../../components/tablero/TableroBoard';
import { buildMapaColumnas, normalizaEstatus } from '../../lib/tableroVistas';
import { esCampanaIncompleta, IncompletaBadge } from './campanaCompletitud';

// Vista Tablero de Campanas: una columna por estatus.
//
// Solo lectura en cuanto a mover tarjetas: el estatus se cambia con el mismo
// StatusCampanaModal de la tabla, que valida permisos y bloquea pasos como
// "Aprobada" cuando faltan autorizaciones. Arrastrar se brincaria eso.

// Las claves canonicas son las que estan en BD. Ojo con la caja: campanas
// guarda 'por iniciar' y 'finalizada' en minusculas (capas historicas) pero
// 'Ajuste CTO Cliente', 'Atendido' y 'Aprobada' capitalizados, por eso el
// match va normalizado (ver normalizaEstatus).
export const CAMPANAS_COLUMNAS: readonly TableroColumna[] = [
  {
    key: 'por iniciar',
    label: 'Por Iniciar',
    descripcion: 'Aún no arranca',
    alias: ['Por Iniciar', 'Por iniciar'],
    color: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' },
  },
  {
    key: 'Ajuste Comercial',
    label: 'Ajuste Comercial',
    descripcion: 'Regresó a comercial',
    color: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-500' },
  },
  {
    key: 'Ajuste CTO Cliente',
    label: 'Ajuste CTO Cliente',
    descripcion: 'Ajuste pedido por el cliente',
    // Propuestas lo escribe con guion; aqui caen los dos.
    alias: ['Ajuste Cto-Cliente', 'Ajuste Cto Cliente'],
    color: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', dot: 'bg-rose-500' },
  },
  {
    key: 'Atendido',
    label: 'Atendido',
    descripcion: 'Trabajada',
    color: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' },
  },
  {
    key: 'Aprobada',
    label: 'Aprobada',
    descripcion: 'Aprobada por el cliente',
    color: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  },
  {
    key: 'finalizada',
    label: 'Finalizada',
    descripcion: 'Cerrada',
    alias: ['Finalizada'],
    color: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', dot: 'bg-cyan-500' },
  },
];

export const CAMPANAS_COLUMNAS_KEYS: string[] = CAMPANAS_COLUMNAS.map(c => c.key);

const MAPA_COLUMNAS = buildMapaColumnas(CAMPANAS_COLUMNAS);

/**
 * Columna a la que pertenece la campana, o null si su estatus no tiene columna.
 *
 * Devuelven null estatus reales que negocio no pidio en el tablero ('en curso',
 * 'inactiva', 'Rechazada', 'pausada'). El tablero avisa cuantas quedaron fuera
 * en vez de esconderlas sin decir nada.
 */
export function columnaDeCampana(status: string | null | undefined): string | null {
  return MAPA_COLUMNAS.get(normalizaEstatus(status)) ?? null;
}

interface CampanasTableroViewProps {
  /** Ya filtradas y ordenadas por la pagina (misma fuente que la tabla). */
  items: Campana[];
  columnasVisibles: string[];
  isDark: boolean;
  isLoading: boolean;
  puedeEditarStatus: boolean;
  onStatus: (c: Campana) => void;
  onAbrir: (c: Campana) => void;
}

export default function CampanasTableroView({
  items,
  columnasVisibles,
  isDark,
  isLoading,
  puedeEditarStatus,
  onStatus,
  onAbrir,
}: CampanasTableroViewProps) {
  const columnas = useMemo(
    () => CAMPANAS_COLUMNAS.filter(c => columnasVisibles.includes(c.key)),
    [columnasVisibles],
  );

  const getColumnaKey = useCallback((c: Campana) => columnaDeCampana(c.status), []);
  const getId = useCallback((c: Campana) => c.id, []);

  const renderCard = useCallback((c: Campana) => (
    <TarjetaCampana
      campana={c}
      isDark={isDark}
      puedeEditarStatus={puedeEditarStatus}
      onStatus={() => onStatus(c)}
      onAbrir={() => onAbrir(c)}
    />
  ), [isDark, puedeEditarStatus, onStatus, onAbrir]);

  return (
    <TableroBoard
      columnas={columnas}
      items={items}
      getColumnaKey={getColumnaKey}
      getId={getId}
      renderCard={renderCard}
      isDark={isDark}
      isLoading={isLoading}
      entidadPlural="campañas"
    />
  );
}

// ---------- Tarjeta ----------

function TarjetaCampana({
  campana, isDark, puedeEditarStatus, onStatus, onAbrir,
}: {
  campana: Campana;
  isDark: boolean;
  puedeEditarStatus: boolean;
  onStatus: () => void;
  onAbrir: () => void;
}) {
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';
  const txt = isDark ? 'text-white' : 'text-gray-900';
  const soft = isDark ? 'text-zinc-400' : 'text-gray-500';

  const cliente = campana.cliente_nombre || campana.cliente_razon_social || campana.T0_U_Cliente;
  const marca = campana.T2_U_Marca || campana.articulo;

  const catorcena = campana.catorcena_inicio_num
    ? `Cat ${String(campana.catorcena_inicio_num).padStart(2, '0')}${
        campana.catorcena_fin_num && campana.catorcena_fin_num !== campana.catorcena_inicio_num
          ? `-${String(campana.catorcena_fin_num).padStart(2, '0')}`
          : ''
      }${campana.catorcena_inicio_anio ? ` / ${campana.catorcena_inicio_anio}` : ''}`
    : null;

  return (
    <TableroCard isDark={isDark} onClick={onAbrir} title="Abrir detalle de la campaña">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-purple-500/10 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>
          #{campana.id}
        </span>
        {/* Fecha de ultima edicion. Requiere la columna campania.updated_at:
            mientras no exista en esa BD llega vacia y se muestra "—" en vez de
            inventar una fecha con fecha_inicio, que no es una edicion. */}
        <span
          className={`inline-flex items-center gap-1 text-[10px] ${sub}`}
          title={campana.updated_at ? `Última edición: ${formatDate(campana.updated_at)}` : 'Sin registro de edición'}
        >
          <History className="h-3 w-3" />
          {campana.updated_at ? formatDateCompact(campana.updated_at) : '—'}
        </span>
      </div>

      <p className={`text-xs font-semibold truncate ${txt}`} title={campana.nombre}>
        <Megaphone className="h-3 w-3 inline mr-1 opacity-60" />
        {campana.nombre}
      </p>
      {cliente && (
        <p className={`text-[11px] truncate mt-0.5 ${soft}`} title={cliente}>{cliente}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {catorcena && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${sub}`}>
            <Calendar className="h-3 w-3" />
            {catorcena}
          </span>
        )}
        {campana.inversion != null && Number(campana.inversion) > 0 && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${sub}`}>
            <DollarSign className="h-3 w-3" />
            {formatCurrency(Number(campana.inversion))}
          </span>
        )}
      </div>

      {marca && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`inline-flex items-center gap-1 text-[10px] truncate max-w-full ${sub}`} title={`Marca: ${marca}`}>
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{marca}</span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap mt-2">
        {puedeEditarStatus ? (
          <button
            onClick={(e) => { e.stopPropagation(); onStatus(); }}
            className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap border transition-opacity hover:opacity-80 ${
              isDark ? 'bg-zinc-700/60 text-zinc-200 border-zinc-600' : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}
            title="Cambiar estatus"
          >
            {campana.status}
          </button>
        ) : (
          <span className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap border ${
            isDark ? 'bg-zinc-700/60 text-zinc-200 border-zinc-600' : 'bg-gray-100 text-gray-700 border-gray-200'
          }`}>
            {campana.status}
          </span>
        )}
        {campana.has_aps ? (
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'} border border-emerald-500/30`}>
            APS
          </span>
        ) : null}
        {esCampanaIncompleta(campana) && (
          <span onClick={(e) => e.stopPropagation()}>
            <IncompletaBadge campana={campana} isDark={isDark} />
          </span>
        )}
      </div>
    </TableroCard>
  );
}
