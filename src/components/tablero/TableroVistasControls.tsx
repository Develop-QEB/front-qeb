import { useMemo, useState } from 'react';
import {
  Check, ChevronDown, Columns3, Pencil, Save, Trash2, X,
} from 'lucide-react';
import type { TableroColumna } from './TableroBoard';
import {
  ORDEN_RAPIDO_OPCIONES, ORDEN_RAPIDO_DEFAULT, loadVistas, saveVistas, nuevaVistaId,
  type OrdenRapido, type TableroScope, type VistaTablero,
} from '../../lib/tableroVistas';

// Selector de columnas y gestion de vistas guardadas del tablero.
//
// Los chips de orden rapido / incompletos viven en OrdenRapidoChips, en la
// barra de filtros de la pagina, porque aplican tambien a la Vista Tabla.
//
// Las vistas se administran aqui porque ningun otro componente las necesita:
// la pagina solo recibe columnas/orden/filtro ya resueltos.

interface TableroVistasControlsProps {
  isDark: boolean;
  scope: TableroScope;
  userId: number | string | null | undefined;
  /** Todas las columnas posibles del modulo, en orden canonico. */
  todasColumnas: readonly TableroColumna[];
  columnasVisibles: string[];
  onColumnasChange: (columnas: string[]) => void;
  orden: OrdenRapido;
  onOrdenChange: (orden: OrdenRapido) => void;
  soloIncompletos: boolean;
  onSoloIncompletosChange: (valor: boolean) => void;
}

/**
 * Selector de columnas + gestion de vistas guardadas. Vive sobre el tablero.
 *
 * Recibe `orden`/`soloIncompletos` aunque no los pinte: una vista guardada
 * incluye el orden y el filtro, no solo las columnas.
 */
export function TableroVistasControls({
  isDark,
  scope,
  userId,
  todasColumnas,
  columnasVisibles,
  onColumnasChange,
  orden,
  onOrdenChange,
  soloIncompletos,
  onSoloIncompletosChange,
}: TableroVistasControlsProps) {
  const keysValidas = useMemo(() => todasColumnas.map(c => c.key), [todasColumnas]);

  const [vistas, setVistas] = useState<VistaTablero[]>(() => loadVistas(scope, userId, keysValidas));
  const [vistaActivaId, setVistaActivaId] = useState<string | null>(null);
  const [showColumnas, setShowColumnas] = useState(false);
  const [showVistas, setShowVistas] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [renombrandoId, setRenombrandoId] = useState<string | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');

  // Si cambia el usuario (logout/login en la misma pestana) hay que releer:
  // las vistas estan guardadas por usuario. Se ajusta en el render y no en un
  // efecto para no pintar una vez con las vistas del usuario anterior.
  const claveDatos = `${scope}:${userId ?? 'anon'}`;
  const [claveCargada, setClaveCargada] = useState(claveDatos);
  if (claveCargada !== claveDatos) {
    setClaveCargada(claveDatos);
    setVistas(loadVistas(scope, userId, keysValidas));
    setVistaActivaId(null);
  }

  const persistir = (siguientes: VistaTablero[]) => {
    setVistas(siguientes);
    saveVistas(scope, userId, siguientes);
  };

  const vistaActiva = vistas.find(v => v.id === vistaActivaId) || null;

  // "Hay cambios sin guardar" compara contra la vista activa. Sin vista activa,
  // basta con que la seleccion no sea la de default (todas las columnas).
  const hayCambios = useMemo(() => {
    const actual = JSON.stringify({ c: [...columnasVisibles].sort(), orden, soloIncompletos });
    if (vistaActiva) {
      const guardada = JSON.stringify({
        c: [...vistaActiva.columnas].sort(),
        orden: vistaActiva.orden,
        soloIncompletos: vistaActiva.soloIncompletos,
      });
      return actual !== guardada;
    }
    return columnasVisibles.length !== todasColumnas.length
      || orden !== ORDEN_RAPIDO_DEFAULT
      || soloIncompletos;
  }, [columnasVisibles, orden, soloIncompletos, vistaActiva, todasColumnas.length]);

  const aplicarVista = (vista: VistaTablero) => {
    onColumnasChange(vista.columnas);
    onOrdenChange(vista.orden);
    onSoloIncompletosChange(vista.soloIncompletos);
    setVistaActivaId(vista.id);
    setShowVistas(false);
  };

  const guardarNueva = () => {
    const nombre = nombreNueva.trim();
    if (!nombre || columnasVisibles.length === 0) return;
    const vista: VistaTablero = {
      id: nuevaVistaId(),
      nombre,
      columnas: [...columnasVisibles],
      orden,
      soloIncompletos,
    };
    persistir([...vistas, vista]);
    setVistaActivaId(vista.id);
    setNombreNueva('');
  };

  const actualizarActiva = () => {
    if (!vistaActiva) return;
    persistir(vistas.map(v => (
      v.id === vistaActiva.id
        ? { ...v, columnas: [...columnasVisibles], orden, soloIncompletos }
        : v
    )));
  };

  const eliminarVista = (id: string) => {
    persistir(vistas.filter(v => v.id !== id));
    if (vistaActivaId === id) setVistaActivaId(null);
  };

  const confirmarRenombre = () => {
    const nombre = nombreEdit.trim();
    if (!renombrandoId || !nombre) { setRenombrandoId(null); return; }
    persistir(vistas.map(v => (v.id === renombrandoId ? { ...v, nombre } : v)));
    setRenombrandoId(null);
  };

  // Mantiene el orden canonico de las columnas aunque se activen en otro orden:
  // el tablero debe leerse siempre como el flujo del proceso.
  const toggleColumna = (key: string) => {
    const activas = new Set(columnasVisibles);
    if (activas.has(key)) activas.delete(key);
    else activas.add(key);
    onColumnasChange(keysValidas.filter(k => activas.has(k)));
  };

  const chipBase = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border';
  const chipOff = isDark
    ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
    : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-300';
  const chipOn = isDark
    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
    : 'bg-purple-100 text-purple-700 border-purple-200';
  const popover = `absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border shadow-2xl overflow-hidden ${
    isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-purple-200 bg-white'
  }`;
  const inputCls = `w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${
    isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
  }`;
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Columnas */}
      <div className="relative">
        <button
          onClick={() => { setShowColumnas(!showColumnas); setShowVistas(false); }}
          className={`${chipBase} ${columnasVisibles.length !== todasColumnas.length ? chipOn : chipOff}`}
        >
          <Columns3 className="h-3 w-3" />
          Columnas
          <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white">
            {columnasVisibles.length}/{todasColumnas.length}
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {showColumnas && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowColumnas(false)} />
            <div className={popover}>
              <div className={`px-3 py-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <p className={`text-[10px] uppercase tracking-wide ${sub}`}>Columnas visibles</p>
              </div>
              <div className="max-h-64 overflow-y-auto p-1.5">
                {todasColumnas.map(col => {
                  const activa = columnasVisibles.includes(col.key);
                  return (
                    <button
                      key={col.key}
                      onClick={() => toggleColumna(col.key)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${
                        isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-50'
                      } ${activa ? (isDark ? 'text-purple-200' : 'text-purple-700') : (isDark ? 'text-zinc-400' : 'text-gray-500')}`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        activa ? 'bg-purple-600 border-purple-600' : isDark ? 'border-purple-500/50' : 'border-purple-300'
                      }`}>
                        {activa && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.color.dot}`} />
                      <span className="flex-1 text-left truncate">{col.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className={`flex items-center justify-between gap-2 px-3 py-2 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <button
                  onClick={() => onColumnasChange([...keysValidas])}
                  className={`text-xs ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  Todas
                </button>
                <button
                  onClick={() => onColumnasChange([])}
                  className={`text-xs ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  Ninguna
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Vistas guardadas */}
      <div className="relative">
        <button
          onClick={() => { setShowVistas(!showVistas); setShowColumnas(false); }}
          className={`${chipBase} ${vistaActiva ? chipOn : chipOff}`}
          title="Guardar y administrar vistas del tablero"
        >
          <Save className="h-3 w-3" />
          <span className="max-w-[120px] truncate">{vistaActiva ? vistaActiva.nombre : 'Vistas'}</span>
          {hayCambios && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Hay cambios sin guardar" />
          )}
          <ChevronDown className="h-3 w-3" />
        </button>
        {showVistas && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setShowVistas(false); setRenombrandoId(null); }} />
            <div className={popover}>
              <div className={`px-3 py-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <p className={`text-[10px] uppercase tracking-wide ${sub}`}>Mis vistas guardadas</p>
              </div>

              <div className="max-h-56 overflow-y-auto p-1.5">
                {vistas.length === 0 && (
                  <p className={`px-2 py-3 text-xs text-center ${sub}`}>
                    Aun no tienes vistas. Elige columnas y orden, y guardalos abajo.
                  </p>
                )}
                {vistas.map(v => (
                  <div
                    key={v.id}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded transition-colors ${
                      v.id === vistaActivaId
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
                        <button onClick={confirmarRenombre} className="p-1 rounded text-emerald-500 hover:bg-emerald-500/10" title="Guardar nombre">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setRenombrandoId(null)} className={`p-1 rounded ${sub} hover:bg-zinc-500/10`} title="Cancelar">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => aplicarVista(v)}
                          className="flex-1 min-w-0 text-left"
                          title="Aplicar esta vista"
                        >
                          <span className={`block text-xs font-medium truncate ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                            {v.nombre}
                          </span>
                          <span className={`block text-[10px] ${sub}`}>
                            {v.columnas.length} col · {ORDEN_RAPIDO_OPCIONES.find(o => o.value === v.orden)?.label}
                            {v.soloIncompletos && ' · incompletos'}
                          </span>
                        </button>
                        <button
                          onClick={() => { setRenombrandoId(v.id); setNombreEdit(v.nombre); }}
                          className={`p-1 rounded ${isDark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}
                          title="Renombrar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => eliminarVista(v.id)}
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
                {vistaActiva && hayCambios && (
                  <button
                    onClick={actualizarActiva}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isDark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Actualizar esta vista con lo que veo
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
                    onClick={guardarNueva}
                    disabled={!nombreNueva.trim() || columnasVisibles.length === 0}
                    className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      !nombreNueva.trim() || columnasVisibles.length === 0
                        ? isDark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-500'
                    }`}
                  >
                    Guardar
                  </button>
                </div>
                {columnasVisibles.length === 0 && (
                  <p className={`text-[10px] ${sub}`}>Elige al menos una columna para poder guardar.</p>
                )}
                {vistaActiva && (
                  <button
                    onClick={() => setVistaActivaId(null)}
                    className={`w-full text-[10px] ${sub} hover:underline`}
                  >
                    Salir de esta vista
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
