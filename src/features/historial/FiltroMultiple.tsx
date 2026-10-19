import { useEffect, useRef, useState, type ComponentType } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

// Multiselect compacto para las barras de filtros (responsables, clientes,
// asesores...). Boton con contador + dropdown con buscador y checkboxes.
interface Props {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  isDark: boolean;
  /** Texto del buscador interno. */
  placeholder?: string;
  className?: string;
}

export function FiltroMultiple({ label, icon: Icon, options, selected, onChange, isDark, placeholder = 'Buscar...', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const q = search.trim().toLowerCase();
  const visibles = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  const sel = new Set(selected);
  const toggle = (o: string) => {
    const next = new Set(sel);
    if (next.has(o)) next.delete(o); else next.add(o);
    onChange(Array.from(next));
  };

  const inputCls = isDark
    ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400';
  const activo = selected.length > 0;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setSearch(''); }}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm min-w-[160px] transition-colors ${inputCls} ${
          activo ? 'border-purple-500 text-purple-500' : isDark ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate flex-1 text-left">
          {activo ? (selected.length === 1 ? selected[0] : `${label}: ${selected.length}`) : label}
        </span>
        {activo ? (
          <X
            className="h-3.5 w-3.5 shrink-0 hover:text-red-400"
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
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
              <button onClick={() => onChange([])} className="text-xs text-red-400 hover:text-red-300 shrink-0">Limpiar</button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {visibles.map(o => {
              const on = sel.has(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggle(o)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm transition-colors ${
                    on
                      ? 'bg-purple-500/10 text-purple-500 font-medium'
                      : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-purple-500 border-purple-500' : isDark ? 'border-zinc-600' : 'border-gray-300'}`}>
                    {on && <Check className="h-2.5 w-2.5 text-white" />}
                  </span>
                  <span className="truncate">{o}</span>
                </button>
              );
            })}
            {visibles.length === 0 && (
              <div className={`px-3 py-3 text-sm text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Sin resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
