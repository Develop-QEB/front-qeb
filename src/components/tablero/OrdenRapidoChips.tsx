import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpDown, Check, ChevronDown, Search, Star } from 'lucide-react';
import {
  ORDEN_RAPIDO_OPCIONES,
  ORDEN_RAPIDO_DEFAULT,
  type OrdenRapido,
  type CambioOpcion,
  type CambioGrupo,
} from '../../lib/tableroVistas';

// Filtros rapidos de orden + "solo incompletos". Van en la barra de filtros de
// la pagina, no dentro del tablero, porque aplican igual a la Vista Tabla y a
// la Vista Tablero: el usuario no deberia tener que reordenar al cambiar de
// vista.
//
// El chip "Último cambio" abre un popover con buscador para elegir QUÉ
// cambios cuentan para ese orden (edición de datos, cambios de estatus de la
// entidad y cambios de autorización de los circuitos). Por default cuentan
// todos. Ver fechaUltimoCambio en lib/tableroVistas.

interface OrdenRapidoChipsProps {
  isDark: boolean;
  orden: OrdenRapido;
  onOrdenChange: (orden: OrdenRapido) => void;
  soloIncompletos: boolean;
  onSoloIncompletosChange: (valor: boolean) => void;
  /** Texto del tooltip del filtro de incompletos ("propuestas" / "campanas"). */
  entidadPlural: string;
  /**
   * Que significa "incompleta" en este modulo. Propuestas y Campanas comparten
   * el criterio de reservas vs caras esperadas; Solicitudes no tiene reservas
   * todavia, asi que ahi es "sin circuitos cargados".
   */
  incompletosHint?: string;
  /** Cambios que puede considerar "Último cambio" (ver construirOpcionesCambio). */
  cambiosOpciones?: CambioOpcion[];
  /** Claves seleccionadas; null = todos los cambios cuentan. */
  cambiosSeleccion?: string[] | null;
  onCambiosSeleccionChange?: (seleccion: string[] | null) => void;
}

const GRUPO_LABEL: Record<CambioGrupo, string> = {
  edicion: 'Edición',
  estatus: 'Cambio de estatus',
  autorizacion: 'Autorización de circuitos',
};
const GRUPO_ORDEN: CambioGrupo[] = ['edicion', 'estatus', 'autorizacion'];

export function OrdenRapidoChips({
  isDark,
  orden,
  onOrdenChange,
  soloIncompletos,
  onSoloIncompletosChange,
  entidadPlural,
  incompletosHint,
  cambiosOpciones,
  cambiosSeleccion = null,
  onCambiosSeleccionChange,
}: OrdenRapidoChipsProps) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const chipBase = 'flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all border';
  const chipOff = isDark
    ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
    : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-300';
  const chipOn = isDark
    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
    : 'bg-purple-100 text-purple-700 border-purple-200';
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';

  const tienePopover = !!cambiosOpciones && cambiosOpciones.length > 0 && !!onCambiosSeleccionChange;
  const totalOpciones = cambiosOpciones?.length ?? 0;
  // null = todos. Para pintar checks y contar, lo resolvemos a un Set.
  const seleccionSet = useMemo(
    () => new Set(cambiosSeleccion === null ? (cambiosOpciones ?? []).map(o => o.key) : cambiosSeleccion),
    [cambiosSeleccion, cambiosOpciones],
  );
  const todosSeleccionados = cambiosSeleccion === null || seleccionSet.size === totalOpciones;

  const opcionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = cambiosOpciones ?? [];
    return q ? lista.filter(o => o.label.toLowerCase().includes(q)) : lista;
  }, [cambiosOpciones, busqueda]);

  const emitir = (next: Set<string>) => {
    if (!onCambiosSeleccionChange) return;
    // Si quedan todos marcados volvemos a null (= todos) para que el default
    // no cuente como filtro activo.
    if (next.size === totalOpciones) onCambiosSeleccionChange(null);
    else onCambiosSeleccionChange(Array.from(next));
  };
  const toggle = (key: string) => {
    const next = new Set(seleccionSet);
    if (next.has(key)) next.delete(key); else next.add(key);
    emitir(next);
  };
  const marcarTodos = () => onCambiosSeleccionChange?.(null);
  const marcarNinguno = () => onCambiosSeleccionChange?.([]);
  // Marcar/desmarcar en bloque solo lo visible por la busqueda.
  const marcarVisibles = (marcar: boolean) => {
    const next = new Set(seleccionSet);
    opcionesFiltradas.forEach(o => { if (marcar) next.add(o.key); else next.delete(o.key); });
    emitir(next);
  };

  const inputCls = `w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'}`;
  const linkCls = `text-[10px] font-medium ${isDark ? 'text-purple-300 hover:text-purple-200' : 'text-purple-700 hover:text-purple-900'}`;

  return (
    <>
      <span className={`text-xs ${sub} mr-1 inline-flex items-center gap-1`}>
        <ArrowUpDown className="h-3 w-3" />
        Ordenar:
      </span>
      {ORDEN_RAPIDO_OPCIONES.map(opt => {
        const activo = orden === opt.value;
        // "Último cambio": ademas de ordenar, abre la lista de cambios a considerar.
        if (opt.value === 'reciente' && tienePopover) {
          return (
            <div key={opt.value} className="relative">
              <button
                onClick={() => {
                  if (!activo) onOrdenChange(opt.value);
                  setOpen(prev => (activo ? !prev : true));
                }}
                title={todosSeleccionados
                  ? `${opt.hint}. Clic para elegir qué cambios cuentan.`
                  : `${opt.hint}. Considerando ${seleccionSet.size} de ${totalOpciones} tipos de cambio.`}
                className={`${chipBase} ${activo ? chipOn : chipOff}`}
              >
                <Star className="h-3 w-3" />
                {opt.label}
                {!todosSeleccionados && (
                  <span className={`px-1 rounded text-[10px] font-semibold ${isDark ? 'bg-purple-500/30 text-purple-200' : 'bg-purple-200 text-purple-800'}`}>
                    {seleccionSet.size}/{totalOpciones}
                  </span>
                )}
                <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                  <div className={`absolute top-full left-0 mt-1.5 z-50 w-72 rounded-xl border shadow-2xl overflow-hidden ${isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-purple-200 bg-white'}`}>
                    <div className={`p-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                      <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                        <Star className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                        ¿Qué cambios cuentan?
                      </h3>
                      <p className={`text-[10px] mt-1 ${sub}`}>
                        Arriba lo que cambió más recientemente a alguno de los seleccionados.
                      </p>
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="relative">
                        <Search className={`absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 ${sub}`} />
                        <input
                          type="text"
                          value={busqueda}
                          onChange={e => setBusqueda(e.target.value)}
                          placeholder="Buscar cambio..."
                          className={inputCls}
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={marcarTodos} className={linkCls}>Todos</button>
                          <span className={`text-[10px] ${sub}`}>·</span>
                          <button type="button" onClick={marcarNinguno} className={linkCls}>Ninguno</button>
                        </div>
                        {busqueda.trim() && opcionesFiltradas.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => marcarVisibles(true)} className={linkCls}>Marcar visibles</button>
                            <span className={`text-[10px] ${sub}`}>·</span>
                            <button type="button" onClick={() => marcarVisibles(false)} className={linkCls}>Quitar visibles</button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto px-2 pb-2">
                      {opcionesFiltradas.length === 0 && (
                        <p className={`px-2 py-3 text-xs text-center ${sub}`}>Sin coincidencias</p>
                      )}
                      {GRUPO_ORDEN.map(grupo => {
                        const items = opcionesFiltradas.filter(o => o.grupo === grupo);
                        if (items.length === 0) return null;
                        return (
                          <div key={grupo} className="mb-1">
                            <div className={`px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide ${sub}`}>
                              {GRUPO_LABEL[grupo]}
                            </div>
                            {items.map(o => {
                              const marcado = seleccionSet.has(o.key);
                              return (
                                <button
                                  key={o.key}
                                  type="button"
                                  onClick={() => toggle(o.key)}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-gray-100 text-gray-800'}`}
                                >
                                  <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${marcado
                                    ? 'bg-purple-600 border-purple-500 text-white'
                                    : isDark ? 'border-zinc-600' : 'border-gray-300'}`}>
                                    {marcado && <Check className="h-2.5 w-2.5" />}
                                  </span>
                                  <span className="truncate">{o.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    <div className={`px-3 py-1.5 border-t text-[10px] ${isDark ? 'border-zinc-800 text-zinc-500' : 'border-gray-200 text-gray-400'}`}>
                      {todosSeleccionados ? 'Cuentan todos los cambios' : `${seleccionSet.size} de ${totalOpciones} tipos de cambio`}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        }
        return (
          <button
            key={opt.value}
            onClick={() => onOrdenChange(opt.value)}
            title={opt.hint}
            className={`${chipBase} ${activo ? chipOn : chipOff}`}
          >
            {/* La estrella marca el orden fijo del tablero (ultimo cambio arriba). */}
            {opt.value === ORDEN_RAPIDO_DEFAULT && <Star className="h-3 w-3" />}
            {opt.label}
          </button>
        );
      })}

      <div className={`h-4 w-px mx-1 ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200'}`} />

      <button
        onClick={() => onSoloIncompletosChange(!soloIncompletos)}
        title={incompletosHint ?? `Solo ${entidadPlural} con menos reservas que caras esperadas`}
        className={`${chipBase} ${soloIncompletos
          ? (isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-700 border-amber-300')
          : chipOff}`}
      >
        <AlertTriangle className="h-3 w-3" />
        Solo incompletos
      </button>
    </>
  );
}
