import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

// Multiselect compacto para las barras de filtros (responsables, clientes,
// asesores, usuarios, etapas, acciones...). Boton con contador + dropdown
// con buscador y checkboxes.
//
// Las opciones pueden ser strings (label === value) o pares {label, value}
// para los filtros donde el valor que viaja al back no es el texto visible
// (ej. módulo "Capa de mapa" -> 'capa_mapa').
//
// Con `grupo` las opciones se renderizan en secciones con encabezado, en el
// orden en que llegan. Es lo que usan los filtros de Módulo y Tipo de acción
// del Historial, donde una lista plana de ~20 entradas se vuelve ilegible.
export type OpcionFiltro = string | { label: string; value: string; grupo?: string };

interface Props {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  options: OpcionFiltro[];
  selected: string[];
  onChange: (next: string[]) => void;
  isDark: boolean;
  /** Texto del buscador interno. */
  placeholder?: string;
  className?: string;
  /**
   * Difiere `onChange` hasta que se cierra el dropdown: marcar casillas es
   * instantaneo en la UI pero solo se emite una vez. Usarlo cuando el filtro
   * dispara una consulta al servidor (el historial hace full scan sobre
   * `detalles` MEDIUMTEXT, un refetch por casilla es caro). Sin esta prop el
   * cambio se emite en cada click, que es lo correcto cuando se filtra en
   * cliente.
   */
  commitOnClose?: boolean;
}

const normalizar = (o: OpcionFiltro) =>
  (typeof o === 'string' ? { label: o, value: o, grupo: undefined as string | undefined } : o);
const joinKey = (xs: string[]) => xs.join('\u0000');

export function FiltroMultiple({
  label, icon: Icon, options, selected, onChange, isDark,
  placeholder = 'Buscar...', className = '', commitOnClose = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Seleccion en edicion. Con commitOnClose vive aqui hasta que se cierra el
  // dropdown; sin el, va siempre un paso detras de `selected` (que es quien
  // manda) porque cada toggle emite onChange de inmediato.
  const [draft, setDraft] = useState<string[]>(selected);
  const ref = useRef<HTMLDivElement>(null);

  const opciones = useMemo(() => options.map(normalizar), [options]);
  const labelPorValor = useMemo(
    () => new Map(opciones.map(o => [o.value, o.label])),
    [opciones],
  );

  // Resincroniza cuando el padre cambia la seleccion por fuera (ej. "Limpiar
  // todo"). Se compara por contenido: `selected` suele ser un array nuevo
  // en cada render del padre.
  const selKey = joinKey(selected);
  useEffect(() => {
    setDraft(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  const cerrar = useCallback(() => {
    setOpen(false);
    if (commitOnClose && joinKey(draft) !== selKey) onChange(draft);
  }, [commitOnClose, draft, selKey, onChange]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, cerrar]);

  const q = search.trim().toLowerCase();
  const visibles = q ? opciones.filter(o => o.label.toLowerCase().includes(q)) : opciones;
  const sel = new Set(draft);

  // Secciones en el orden en que llegan las opciones. Un grupo que se queda
  // sin opciones tras buscar simplemente no aparece.
  const secciones: { grupo?: string; items: typeof visibles }[] = [];
  for (const o of visibles) {
    const ultima = secciones[secciones.length - 1];
    if (ultima && ultima.grupo === o.grupo) ultima.items.push(o);
    else secciones.push({ grupo: o.grupo, items: [o] });
  }

  const aplicar = (next: string[]) => {
    setDraft(next);
    if (!commitOnClose) onChange(next);
  };

  const toggle = (value: string) => {
    const next = new Set(sel);
    if (next.has(value)) next.delete(value); else next.add(value);
    aplicar(Array.from(next));
  };

  // Limpiar desde el chip (control cerrado): gesto explicito, se emite ya.
  const limpiarTodo = () => {
    setDraft([]);
    onChange([]);
    setOpen(false);
  };

  const inputCls = isDark
    ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400';
  const activo = draft.length > 0;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { if (open) { cerrar(); } else { setSearch(''); setOpen(true); } }}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm min-w-[160px] transition-colors ${inputCls} ${
          activo ? 'border-purple-500 text-purple-500' : isDark ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate flex-1 text-left">
          {activo
            ? (draft.length === 1 ? (labelPorValor.get(draft[0]) ?? draft[0]) : `${label}: ${draft.length}`)
            : label}
        </span>
        {activo ? (
          <X
            className="h-3.5 w-3.5 shrink-0 hover:text-red-400"
            onClick={(e) => { e.stopPropagation(); limpiarTodo(); }}
          />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>

      {open && (
        <div className={`absolute top-full left-0 mt-1 w-72 rounded-lg border shadow-xl z-50 overflow-hidden ${
          isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'
        }`}>
          <div className="p-2 flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={placeholder}
              className={`flex-1 rounded-md border px-2.5 py-1.5 text-sm ${inputCls}`}
              autoFocus
            />
            {activo && (
              <button onClick={() => aplicar([])} className="text-xs text-red-400 hover:text-red-300 shrink-0">Limpiar</button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {secciones.map((sec, i) => (
              <div key={sec.grupo ?? `s${i}`}>
                {sec.grupo && (
                  <div className={`px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider ${
                    isDark ? 'text-zinc-500' : 'text-gray-400'
                  }`}>
                    {sec.grupo}
                  </div>
                )}
                {sec.items.map(o => {
                  const on = sel.has(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggle(o.value)}
                      className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm transition-colors ${
                        on
                          ? 'bg-purple-500/10 text-purple-500 font-medium'
                          : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-purple-500 border-purple-500' : isDark ? 'border-zinc-600' : 'border-gray-300'}`}>
                        {on && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className="truncate">{o.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {visibles.length === 0 && (
              <div className={`px-3 py-3 text-sm text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Sin resultados</div>
            )}
          </div>
          {commitOnClose && (
            <div className={`px-3 py-1.5 border-t text-[10px] ${isDark ? 'border-zinc-800 text-zinc-500' : 'border-gray-100 text-gray-400'}`}>
              Se aplica al cerrar
            </div>
          )}
        </div>
      )}
    </div>
  );
}
