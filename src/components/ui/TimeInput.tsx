import { Clock } from 'lucide-react';

// Input de hora ON-SYSTEM (HH:MM 24h) para reemplazar el <input type="time">
// nativo, cuyo picker y reloj negro no combinan con el tema oscuro de QEB
// (feedback Jos). Es texto enmascarado: auto-inserta ":" al 3er dígito y, en blur,
// valida/clampa a HH:MM (00-23 / 00-59). Compacto, con ícono de reloj visible.
// El valor emitido es "HH:MM" (o '' si se vacía), igual que lo esperaba el back.
export function TimeInput({
  value,
  onChange,
  disabled,
  isDark,
  ariaLabel,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
  isDark: boolean;
  ariaLabel?: string;
}) {
  const v = value || '';

  const handleChange = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 4); // HHMM
    if (d.length <= 2) { onChange(d); return; }
    onChange(`${d.slice(0, 2)}:${d.slice(2)}`);
  };

  const handleBlur = () => {
    const d = v.replace(/\D/g, '');
    if (!d) { onChange(''); return; }
    const hh = Math.min(23, parseInt(d.slice(0, 2).padEnd(2, '0'), 10) || 0);
    const mm = Math.min(59, parseInt((d.slice(2) || '0').padEnd(2, '0'), 10) || 0);
    onChange(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  };

  return (
    <div className="relative">
      <Clock className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        placeholder="HH:MM"
        aria-label={ariaLabel}
        value={v}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        className={`w-full pl-7 pr-2 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white placeholder-zinc-600' : 'text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}
