import { useMemo, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

// Chip de filtro MULTISELECT con buscador. Misma apariencia que el FilterChip
// de los listados (Solicitudes / Propuestas / Campañas), pero cada opción se
// marca/desmarca y el popover permanece abierto hasta clic afuera. Los cambios
// se aplican al instante (sin botón Aplicar). Se usa para el filtro Status,
// que mezcla estatus de la entidad y estatus de autorización de circuitos.

interface MultiSelectChipProps {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  onClear: () => void;
  isDark: boolean;
  /** Opciones que se pintan con un separador arriba (ej. las de autorización). */
  separatorBefore?: string;
}

export function MultiSelectChip({ label, options, values, onChange, onClear, isDark, separatorBefore }: MultiSelectChipProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const q = searchTerm.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(q));
  }, [options, searchTerm]);

  const selected = useMemo(() => new Set(values), [values]);
  const active = values.length > 0;

  const handleClose = () => { setOpen(false); setSearchTerm(''); };
  const toggle = (opt: string) => {
    if (selected.has(opt)) onChange(values.filter(v => v !== opt));
    else onChange([...values, opt]);
  };

  // Texto del chip: una selección se muestra tal cual; varias, la primera + "+N".
  const chipText = !active
    ? label
    : values.length === 1
      ? values[0]
      : `${values[0]} +${values.length - 1}`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        title={active ? values.join(', ') : undefined}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 max-w-[220px] ${active
          ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-50 text-purple-700 border border-purple-200'
          : `${isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'}`
          }`}
      >
        <span className="truncate">{chipText}</span>
        {active ? (
          <X className={`h-3 w-3 shrink-0 ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`} onClick={(e) => { e.stopPropagation(); onClear(); }} />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleClose} />
          <div className={`absolute top-full left-0 mt-1.5 z-50 w-64 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-purple-200 bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
            <div className={`p-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <input
                type="text"
                placeholder={`Buscar ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50`}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-56 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className={`px-3 py-3 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-center`}>
                  {options.length === 0 ? 'Sin opciones' : 'No se encontraron resultados'}
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const marcado = selected.has(option);
                  return (
                    <div key={option}>
                      {separatorBefore && option === separatorBefore && (
                        <div className={`mx-3 my-1 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`} />
                      )}
                      <button
                        onClick={() => toggle(option)}
                        className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center gap-2 ${marcado
                          ? isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-700'
                          : `${isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`
                          }`}
                      >
                        <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${marcado
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : isDark ? 'border-zinc-600' : 'border-gray-300'}`}>
                          {marcado && <Check className="h-2.5 w-2.5" />}
                        </span>
                        <span className="truncate">{option}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div className={`px-3 py-1.5 border-t flex items-center justify-between ${isDark ? 'border-zinc-800 text-zinc-500' : 'border-gray-200 text-gray-400'} text-[10px]`}>
              <span>{active ? `${values.length} seleccionado${values.length === 1 ? '' : 's'}` : `${filteredOptions.length} de ${options.length} opciones`}</span>
              {active && (
                <button
                  type="button"
                  onClick={onClear}
                  className={`font-medium ${isDark ? 'text-purple-300 hover:text-purple-200' : 'text-purple-700 hover:text-purple-900'}`}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
