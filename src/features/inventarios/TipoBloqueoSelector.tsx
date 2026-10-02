import { Ban, PowerOff } from 'lucide-react';
import {
  TIPOS_BLOQUEO_INVENTARIO,
  TIPO_BLOQUEO_TEXTOS,
  TipoBloqueoInventario,
} from '../../lib/bloqueoInventario';

interface Props {
  value: TipoBloqueoInventario;
  onChange: (tipo: TipoBloqueoInventario) => void;
  isDark?: boolean;
  disabled?: boolean;
}

const ICONOS: Record<TipoBloqueoInventario, typeof Ban> = {
  Bloqueado: Ban,
  Inhabilitado: PowerOff,
};

// Selector de clasificación del bloqueo. Ambas opciones liberan reservas y
// sacan la pieza de disponibles por igual; solo cambia la etiqueta.
export function TipoBloqueoSelector({ value, onChange, isDark = true, disabled }: Props) {
  return (
    <div>
      <label className={`text-xs mb-1.5 block font-medium ${isDark ? 'text-zinc-400' : 'text-gray-700'}`}>
        Tipo <span className="text-red-400">*</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        {TIPOS_BLOQUEO_INVENTARIO.map(tipo => {
          const Icon = ICONOS[tipo];
          const selected = value === tipo;
          const textos = TIPO_BLOQUEO_TEXTOS[tipo];
          return (
            <button
              key={tipo}
              type="button"
              disabled={disabled}
              onClick={() => onChange(tipo)}
              aria-pressed={selected}
              className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                selected
                  ? isDark ? 'bg-red-500/15 border-red-500/50 text-red-200' : 'bg-red-50 border-red-400 text-red-800'
                  : isDark ? 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{textos.opcion}</span>
                <span className={`block text-[10px] leading-tight mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                  {textos.descripcion}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
