import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Check, ChevronDown, Pencil, Star, Trash2, X } from 'lucide-react';
import {
  ORDEN_RAPIDO_OPCIONES, loadVistas, saveVistas, nuevaVistaId,
  type FiltrosDatos, type OrdenRapido, type TableroScope, type VistaTablero,
} from '../../lib/tableroVistas';

// Menu "Vistas" del modulo: guarda con nombre TODO lo que el usuario tiene
// configurado (columnas del tablero + orden + "solo incompletos" + la foto
// completa de la barra de filtros), lo vuelve a aplicar con un clic y deja
// renombrar, actualizar, borrar y marcar una vista como fija (se aplica sola
// al entrar al modulo).
//
// Vive junto al boton "Filtros", en la fila superior, para que este
// disponible en Tabla, Desglose y Tablero: una vista es la misma en las tres,
// solo que las columnas nada mas se notan en el tablero. El selector de
// columnas sigue sobre el tablero (TableroVistasControls).
//
// La foto de filtros es un JSON plano que arma y lee la pagina (ver
// lib/filtrosGuardados para los helpers de lectura defensiva).

interface VistasGuardadasMenuProps {
  isDark: boolean;
  scope: TableroScope;
  userId: number | string | null | undefined;
  /** Claves validas de columnas del tablero del modulo (para descartar viejas). */
  columnasValidas: readonly string[];
  columnasVisibles: string[];
  onColumnasChange: (columnas: string[]) => void;
  orden: OrdenRapido;
  onOrdenChange: (orden: OrdenRapido) => void;
  soloIncompletos: boolean;
  onSoloIncompletosChange: (valor: boolean) => void;
  /** Foto actual de la barra de filtros (sin orden ni incompletos: van aparte). */
  filtrosActuales: FiltrosDatos;
  /**
   * Aplica una foto de filtros a la pagina. Debe ser estable (useCallback):
   * la vista fija se aplica desde un efecto que depende de esta funcion.
   */
  onAplicarFiltros: (datos: FiltrosDatos) => void;
}

function stringifyEstable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stringifyEstable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => `${JSON.stringify(k)}:${stringifyEstable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

function tieneFiltros(f: FiltrosDatos | undefined): boolean {
  if (!f) return false;
  return Object.values(f).some(v => {
    if (v === null || v === undefined || v === '' || v === false) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v as object).length > 0;
    return true;
  });
}

export function VistasGuardadasMenu({
  isDark,
  scope,
  userId,
  columnasValidas,
  columnasVisibles,
  onColumnasChange,
  orden,
  onOrdenChange,
  soloIncompletos,
  onSoloIncompletosChange,
  filtrosActuales,
  onAplicarFiltros,
}: VistasGuardadasMenuProps) {
  const [vistas, setVistas] = useState<VistaTablero[]>(() => loadVistas(scope, userId, columnasValidas));
  const [activaId, setActivaId] = useState<string | null>(
    () => vistas.find(v => v.predeterminada)?.id ?? null,
  );
  const [open, setOpen] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [renombrandoId, setRenombrandoId] = useState<string | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');

  // Si cambia el usuario (logout/login en la misma pestana) hay que releer:
  // las vistas estan guardadas por usuario. Se ajusta en el render y no en un
  // efecto para no pintar una vez con las del usuario anterior.
  const claveDatos = `${scope}:${userId ?? 'anon'}`;
  const [claveCargada, setClaveCargada] = useState(claveDatos);
  if (claveCargada !== claveDatos) {
    setClaveCargada(claveDatos);
    const recargadas = loadVistas(scope, userId, columnasValidas);
    setVistas(recargadas);
    setActivaId(recargadas.find(v => v.predeterminada)?.id ?? null);
  }

  const aplicarDatos = (v: VistaTablero) => {
    onColumnasChange(v.columnas);
    onOrdenChange(v.orden);
    onSoloIncompletosChange(v.soloIncompletos);
    onAplicarFiltros(v.filtros ?? {});
  };

  // Aplicar la vista fija una sola vez por montaje (y otra si cambia el
  // usuario). El ref recuerda para que clave ya se aplico: es el punto de
  // partida, no una camisa de fuerza, asi que no se re-aplica cuando el
  // usuario luego mueve algo a mano.
  const fijaAplicadaParaRef = useRef<string | null>(null);
  useEffect(() => {
    if (fijaAplicadaParaRef.current === claveDatos) return;
    fijaAplicadaParaRef.current = claveDatos;
    const fija = vistas.find(v => v.predeterminada);
    if (!fija) return;
    onColumnasChange(fija.columnas);
    onOrdenChange(fija.orden);
    onSoloIncompletosChange(fija.soloIncompletos);
    onAplicarFiltros(fija.filtros ?? {});
  }, [claveDatos, vistas, onColumnasChange, onOrdenChange, onSoloIncompletosChange, onAplicarFiltros]);

  const persistir = (siguientes: VistaTablero[]) => {
    setVistas(siguientes);
    saveVistas(scope, userId, siguientes);
  };

  const activa = vistas.find(v => v.id === activaId) || null;

  // "Hay cambios sin guardar" compara lo actual contra la vista activa, con
  // claves ordenadas a todos los niveles para que el orden de construccion
  // del objeto no cuente como diferencia.
  const fotoActual = useMemo(
    () => stringifyEstable({ c: [...columnasVisibles].sort(), orden, soloIncompletos, f: filtrosActuales }),
    [columnasVisibles, orden, soloIncompletos, filtrosActuales],
  );
  const hayCambios = useMemo(() => {
    if (!activa) return false;
    return fotoActual !== stringifyEstable({
      c: [...activa.columnas].sort(), orden: activa.orden, soloIncompletos: activa.soloIncompletos, f: activa.filtros ?? {},
    });
  }, [activa, fotoActual]);

  const aplicar = (v: VistaTablero) => {
    aplicarDatos(v);
    setActivaId(v.id);
    setOpen(false);
  };

  const fotoParaGuardar = (): Pick<VistaTablero, 'columnas' | 'orden' | 'soloIncompletos' | 'filtros'> => ({
    columnas: [...columnasVisibles],
    orden,
    soloIncompletos,
    filtros: { ...filtrosActuales },
  });

  const puedeGuardar = !!nombreNueva.trim() && columnasVisibles.length > 0;
  const guardarNueva = () => {
    if (!puedeGuardar) return;
    const v: VistaTablero = { id: nuevaVistaId(), nombre: nombreNueva.trim(), ...fotoParaGuardar() };
    persistir([...vistas, v]);
    setActivaId(v.id);
    setNombreNueva('');
  };

  const actualizarActiva = () => {
    if (!activa || columnasVisibles.length === 0) return;
    persistir(vistas.map(v => (v.id === activa.id ? { ...v, ...fotoParaGuardar() } : v)));
  };

  // Solo una fija por modulo. Marcar la que ya es fija la desmarca.
  const alternarPredeterminada = (id: string) => {
    persistir(vistas.map(v => ({ ...v, predeterminada: v.id === id ? !v.predeterminada : false })));
  };

  const eliminar = (id: string) => {
    persistir(vistas.filter(v => v.id !== id));
    if (activaId === id) setActivaId(null);
  };

  const confirmarRenombre = () => {
    const nombre = nombreEdit.trim();
    if (!renombrandoId || !nombre) { setRenombrandoId(null); return; }
    persistir(vistas.map(v => (v.id === renombrandoId ? { ...v, nombre } : v)));
    setRenombrandoId(null);
  };

  const btnOn = isDark
    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
    : 'bg-purple-50 text-purple-700 border border-purple-200';
  const btnOff = isDark
    ? 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800'
    : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200';
  const popover = `absolute left-0 top-full mt-1.5 z-[60] w-80 rounded-xl border shadow-2xl overflow-hidden ${
    isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-purple-200 bg-white'
  }`;
  const inputCls = `w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${
    isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
  }`;
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activa ? btnOn : btnOff}`}
        title="Guardar y administrar vistas: filtros, orden y columnas del tablero"
      >
        <Bookmark className="h-4 w-4" fill={activa ? 'currentColor' : 'none'} />
        {/* Con vista activa el nombre siempre se ve; sin ella, la etiqueta solo en pantallas grandes. */}
        <span className={`max-w-[140px] truncate ${activa ? '' : 'hidden xl:inline'}`}>{activa ? activa.nombre : 'Vistas'}</span>
        {hayCambios && (
          <span className="w-2 h-2 rounded-full bg-amber-400" title="Hay cambios sin guardar" />
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => { setOpen(false); setRenombrandoId(null); }} />
          <div className={popover}>
            <div className={`px-3 py-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <p className={`text-[10px] uppercase tracking-wide ${sub}`}>Mis vistas guardadas</p>
              <p className={`text-[10px] mt-0.5 ${sub}`}>Cada vista guarda filtros, orden y columnas del tablero.</p>
            </div>

            <div className="max-h-56 overflow-y-auto p-1.5">
              {vistas.length === 0 && (
                <p className={`px-2 py-3 text-xs text-center ${sub}`}>
                  Aún no tienes vistas. Configura filtros, orden o columnas y guárdalos abajo con un nombre.
                </p>
              )}
              {vistas.map(v => (
                <div
                  key={v.id}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded transition-colors ${
                    v.id === activaId
                      ? isDark ? 'bg-purple-900/40' : 'bg-purple-50'
                      : isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'
                  }`}
                >
                  {renombrandoId === v.id ? (
                    <>
                      <input
                        autoFocus
                        value={nombreEdit}
                        onChange={e => setNombreEdit(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmarRenombre();
                          if (e.key === 'Escape') setRenombrandoId(null);
                        }}
                        className={inputCls}
                      />
                      <button type="button" onClick={confirmarRenombre} className="p-1 rounded text-emerald-500 hover:bg-emerald-500/10" title="Guardar nombre">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setRenombrandoId(null)} className={`p-1 rounded ${sub} hover:bg-zinc-500/10`} title="Cancelar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => aplicar(v)}
                        className="flex-1 min-w-0 text-left"
                        title="Aplicar esta vista"
                      >
                        <span className={`block text-xs font-medium truncate ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                          {v.nombre}
                        </span>
                        <span className={`block text-[10px] ${sub}`}>
                          {v.columnas.length}/{columnasValidas.length} col · {ORDEN_RAPIDO_OPCIONES.find(o => o.value === v.orden)?.label}
                          {v.soloIncompletos && ' · incompletos'}
                          {tieneFiltros(v.filtros) && ' · filtros'}
                          {v.predeterminada && ' · fija'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarPredeterminada(v.id)}
                        className={`p-1 rounded ${v.predeterminada
                          ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                          : isDark ? 'text-zinc-500 hover:text-amber-300 hover:bg-zinc-700' : 'text-gray-400 hover:text-amber-500 hover:bg-gray-200'}`}
                        title={v.predeterminada ? 'Quitar como vista fija' : 'Usar como vista fija: se aplica sola al entrar al módulo'}
                      >
                        <Star className="h-3.5 w-3.5" fill={v.predeterminada ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRenombrandoId(v.id); setNombreEdit(v.nombre); }}
                        className={`p-1 rounded ${isDark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}
                        title="Renombrar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminar(v.id)}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        title="Eliminar vista"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className={`p-2 space-y-2 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              {activa && hayCambios && (
                <button
                  type="button"
                  onClick={actualizarActiva}
                  disabled={columnasVisibles.length === 0}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isDark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Actualizar "{activa.nombre}" con lo que tengo ahora
                </button>
              )}
              <div className="flex items-center gap-1.5">
                <input
                  value={nombreNueva}
                  onChange={e => setNombreNueva(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') guardarNueva(); }}
                  placeholder="Nombre de la vista..."
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={guardarNueva}
                  disabled={!puedeGuardar}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    !puedeGuardar
                      ? isDark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-500'
                  }`}
                >
                  Guardar
                </button>
              </div>
              {columnasVisibles.length === 0 && (
                <p className={`text-[10px] ${sub}`}>Elige al menos una columna del tablero para poder guardar.</p>
              )}
              {activa && (
                <button
                  type="button"
                  onClick={() => setActivaId(null)}
                  className={`w-full text-[10px] ${sub} hover:underline`}
                >
                  Salir de esta vista (no cambia nada en pantalla)
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
