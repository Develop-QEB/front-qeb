import { CalendarDays, Infinity as InfinityIcon } from 'lucide-react';
import {
  VigenciaBloqueo,
  VIGENCIA_INDEFINIDA,
  hoyLocalISO,
  vigenciaEsProgramada,
  fechaCorta,
} from '../../lib/bloqueoInventario';

interface Props {
  value: VigenciaBloqueo;
  onChange: (v: VigenciaBloqueo) => void;
  isDark?: boolean;
  disabled?: boolean;
}

// Vigencia del bloqueo (No Disponible / Inhabilitado). Dos modos:
//  - Indefinida: sin fechas; queda bloqueado hasta que alguien lo habilite.
//  - Con fechas: inicio (default hoy, mínimo hoy) y fin obligatorios. Al
//    cumplirse la fecha fin, a quien bloqueó le llega una tarea para
//    rehabilitar. Inicio futuro = bloqueo programado (se aplica ese día).
// Mismo patrón visual que TipoBloqueoSelector.
export function VigenciaBloqueoFields({ value, onChange, isDark = true, disabled }: Props) {
  const hoy = hoyLocalISO();
  const conFechas = value.fecha_inicio !== null;
  const programada = vigenciaEsProgramada(value);
  const finInvalido = conFechas && !!value.fecha_inicio && !!value.fecha_fin && value.fecha_fin < value.fecha_inicio;

  const opciones: Array<{ key: 'indefinida' | 'fechas'; label: string; desc: string; Icon: typeof CalendarDays }> = [
    { key: 'indefinida', label: 'Indefinida', desc: 'Hasta que alguien lo habilite manualmente.', Icon: InfinityIcon },
    { key: 'fechas', label: 'Con fechas', desc: 'Al terminar te llega una tarea para rehabilitar.', Icon: CalendarDays },
  ];

  const inputCls = `w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none ${
    isDark
      ? 'bg-zinc-800 border-zinc-700 text-white focus:border-red-500/50 [color-scheme:dark]'
      : 'bg-white border-gray-300 text-gray-900 focus:border-red-400'
  } disabled:opacity-50`;

  return (
    <div>
      <label className={`text-xs mb-1.5 block font-medium ${isDark ? 'text-zinc-400' : 'text-gray-700'}`}>
        Vigencia <span className="text-red-400">*</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        {opciones.map(({ key, label, desc, Icon }) => {
          const selected = key === 'fechas' ? conFechas : !conFechas;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(key === 'fechas' ? { fecha_inicio: hoy, fecha_fin: '' } : VIGENCIA_INDEFINIDA)}
              className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                selected
                  ? isDark ? 'bg-red-500/15 border-red-500/50 text-red-200' : 'bg-red-50 border-red-400 text-red-800'
                  : isDark ? 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{label}</span>
                <span className={`block text-[10px] leading-tight mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {conFechas && (
        <div className="mt-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-[10px] mb-0.5 block ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Desde</label>
              <input
                type="date"
                value={value.fecha_inicio ?? ''}
                min={hoy}
                disabled={disabled}
                onChange={e => onChange({ ...value, fecha_inicio: e.target.value || hoy })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={`text-[10px] mb-0.5 block ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Hasta</label>
              <input
                type="date"
                value={value.fecha_fin ?? ''}
                min={value.fecha_inicio || hoy}
                disabled={disabled}
                onChange={e => onChange({ ...value, fecha_fin: e.target.value })}
                className={`${inputCls} ${finInvalido ? 'border-red-500' : ''}`}
              />
            </div>
          </div>
          {finInvalido ? (
            <p className="text-[10px] text-red-400">La fecha fin no puede ser menor a la fecha inicio.</p>
          ) : !value.fecha_fin ? (
            <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Captura la fecha fin para continuar.</p>
          ) : programada ? (
            <p className={`text-[10px] ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              Bloqueo programado: se aplicará automáticamente el {fechaCorta(value.fecha_inicio)}. Hasta entonces la pieza sigue disponible.
            </p>
          ) : (
            <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              El {fechaCorta(value.fecha_fin)} te llegará una tarea para rehabilitar la pieza. No se habilita sola.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
